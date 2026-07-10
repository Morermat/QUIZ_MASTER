const rooms = require('./rooms');
const { ensureStats } = require('./store');

const clone = (v) => JSON.parse(JSON.stringify(v));
const normalizeIds = (ids) => [...new Set((Array.isArray(ids) ? ids : [ids]).filter(v => v !== undefined && v !== null).map(String))].sort();

function getRoom(code) { return rooms[code] || null; }

function createRoom(roomCode, quizData) {
  rooms[roomCode] = {
    quizTitle: quizData.title,
    questions: clone(quizData.questions),
    originalQuestions: clone(quizData.questions),
    timeLimit: quizData.timeLimit || 30,
    creatorId: quizData.creatorId,
    organizers: new Set([quizData.creatorId]),
    players: new Map(),
    scores: {},
    answers: {},
    answered: {},
    participated: new Set(),
    currentQuestionIndex: -1,
    status: 'waiting',
    startedAt: null,
    finishedAt: null,
    questionStartTime: null,
    timer: null,
    advancePending: false,
    resultSaved: false
  };
}

function addPlayer(roomCode, user) {
  const room = rooms[roomCode];
  if (!room) return { error: 'Комната не найдена' };
  if (room.status === 'active' && !room.players.has(user.id)) {
    return { error: 'Игра уже началась' };
  }
  const previous = room.players.get(user.id) || {};
  room.players.set(user.id, {
    id: user.id,
    name: user.name || previous.name || 'Игрок',
    avatar_url: user.avatar_url || previous.avatar_url || ''
  });
  if (room.scores[user.id] == null) room.scores[user.id] = 0;
  if (room.answered[user.id] == null) room.answered[user.id] = false;
  return { success: true };
}

function removePlayer(roomCode, userId) {
  const room = rooms[roomCode];
  if (!room) return;
  if (room.status === 'active') return;
  room.players.delete(userId);
  delete room.scores[userId];
  delete room.answered[userId];
  delete room.answers[userId];
  if (userId !== room.creatorId) room.organizers.delete(userId);
}

function publicQuestion(question, reveal = false) {
  if (!question) return null;
  return {
    id: question.id,
    text: question.text,
    image_url: question.image_url || null,
    multiple: question.multiple === true || question.options.filter(o => o.is_correct).length > 1,
    timeLimit: question.timeLimit,
    options: question.options.map(o => ({
      id: o.id,
      text: o.text,
      ...(reveal ? { is_correct: !!o.is_correct } : {})
    }))
  };
}

function leaderboard(room) {
  let rank = 0, last = null;
  return [...room.players.values()]
    .map(p => ({
      user_id: p.id,
      name: p.name,
      avatar_url: p.avatar_url,
      score: +(room.scores[p.id] || 0).toFixed(2)
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((p, i) => {
      if (p.score !== last) {
        rank = i + 1;
        last = p.score;
      }
      return { ...p, place: rank };
    });
}

function getGameState(roomCode, userId) {
  const room = rooms[roomCode];
  if (!room) return null;
  const question = room.questions[room.currentQuestionIndex] || null;
  const limit = question?.timeLimit || room.timeLimit || 30;
  const timeLeft = room.questionStartTime && question
    ? Math.max(0, Math.ceil(limit - (Date.now() - room.questionStartTime) / 1000))
    : null;
  const answer = room.answers[userId];
  return {
    roomCode: roomCode,
    status: room.status,
    players: [...room.players.values()].map(p => ({
      ...p,
      isCreator: p.id === room.creatorId,
      isOrganizer: room.organizers.has(p.id)
    })),
    scores: room.scores,
    currentQuestion: publicQuestion(question, room.status === 'finished'),
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    isCreator: room.creatorId === userId,
    isOrganizer: room.organizers.has(userId),
    timeLeft: timeLeft,
    questionEndsAt: room.questionStartTime ? room.questionStartTime + limit * 1000 : null,
    hasAnswered: !!room.answered[userId],
    selectedOptionIds: answer?.optionIds || [],
    answerResult: answer ? {
      isCorrect: answer.isCorrect,
      points: +answer.points.toFixed(2)
    } : null,
    quizTitle: room.quizTitle,
    creatorId: room.creatorId,
    organizers: [...room.organizers],
    leaderboard: room.status === 'finished' ? leaderboard(room) : null
  };
}

function emitState(io, code) {
  const room = rooms[code];
  if (!room) return;
  for (const socketId of io.sockets.adapter.rooms.get(code) || []) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket?.data.user) {
      socket.emit('game_state', getGameState(code, socket.data.user.id));
    }
  }
}

function scheduleAdvance(code, io, delay = 900) {
  const room = rooms[code];
  if (!room || room.advancePending) return;
  room.advancePending = true;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    room.advancePending = false;
    advanceQuiz(code, io);
  }, delay);
}

function startQuiz(code, io) {
  const room = rooms[code];
  if (!room) return { error: 'Комната не найдена' };
  if (room.status !== 'waiting') return { error: 'Сначала перезапустите квиз' };
  if (!room.questions.length) return { error: 'Нет вопросов' };
  if (!room.players.size) return { error: 'Нет участников' };
  
  room.status = 'active';
  room.currentQuestionIndex = 0;
  room.startedAt = Date.now();
  room.finishedAt = null;
  room.resultSaved = false;
  room.scores = {};
  room.answers = {};
  room.answered = {};
  room.participated = new Set();
  
  for (const id of room.players.keys()) {
    room.scores[id] = 0;
    room.answered[id] = false;
  }
  
  room.questionStartTime = Date.now();
  const question = room.questions[0];
  const limit = question.timeLimit || room.timeLimit;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => advanceQuiz(code, io), limit * 1000 + 250);
  emitState(io, code);
  return { success: true };
}

function submitAnswer(code, userId, questionId, optionIds, io) {
  const room = rooms[code];
  if (!room) return { error: 'Комната не найдена' };
  if (!room.players.has(userId)) return { error: 'Сначала войдите в комнату' };
  if (room.status !== 'active') return { error: 'Квиз не активен' };
  
  const question = room.questions[room.currentQuestionIndex];
  if (!question || String(question.id) !== String(questionId)) {
    return { error: 'Неверный вопрос' };
  }
  
  const limit = question.timeLimit || room.timeLimit;
  if (Date.now() - room.questionStartTime > limit * 1000) {
    return { error: 'Время вышло' };
  }
  if (room.answered[userId]) return { error: 'Ответ уже отправлен' };
  
  const selected = normalizeIds(optionIds);
  const validOptionIds = new Set(question.options.map(o => String(o.id)));
  if (!selected.length || selected.some(id => !validOptionIds.has(id))) {
    return { error: 'Неверный вариант ответа' };
  }
  
  const correct = normalizeIds(question.options.filter(o => o.is_correct).map(o => o.id));
  if (!question.multiple && correct.length <= 1 && selected.length !== 1) {
    return { error: 'Можно выбрать только один вариант' };
  }
  
  const correctSelected = selected.filter(id => correct.includes(id)).length;
  const wrongSelected = selected.length - correctSelected;
  const exact = selected.length === correct.length && selected.every(id => correct.includes(id));
  
  const points = exact
    ? 1
    : Math.max(0, correctSelected / correct.length - wrongSelected / Math.max(1, question.options.length - correct.length));
  
  room.scores[userId] = (room.scores[userId] || 0) + points;
  room.answered[userId] = true;
  room.answers[userId] = {
    questionId: question.id,
    optionIds: selected,
    isCorrect: exact,
    points: points
  };
  room.participated.add(userId);
  console.log(`[LOG] submitAnswer: userId=${userId}, points=${points}, participated size=${room.participated.size}, players count=${room.players.size}`);
  
  const stats = ensureStats(userId);
  stats.totalAnswers++;
  if (exact) stats.correctAnswers++;
  
  const allAnswered = [...room.players.keys()].every(id => room.answered[id]);
  if (allAnswered) scheduleAdvance(code, io);
  
  emitState(io, code);
  return {
    isCorrect: exact,
    points: +points.toFixed(2)
  };
}

function saveResults(room, code) {
  if (room.resultSaved) return;
  
  for (const id of room.players.keys()) {
    if (!room.participated.has(id)) {
      room.participated.add(id);
      console.log(`[LOG] saveResults: добавлен игрок ${id} в participated (не ответил)`);
    }
  }
  
  const board = leaderboard(room).filter(p => room.participated.has(p.user_id));
  console.log(`[LOG] saveResults: board length=${board.length}, participated size=${room.participated.size}, players size=${room.players.size}`);
  console.log('[LOG] saveResults: board =', JSON.stringify(board, null, 2));
  
  const topScore = board[0]?.score;
  
  for (const player of board) {
    const stats = ensureStats(player.user_id);
    stats.gamesPlayed++;
    const isWinner = player.score === topScore;
    if (isWinner) stats.wins++;
    stats.history.unshift({
      roomCode: code,
      quizTitle: room.quizTitle,
      date: new Date().toISOString(),
      score: player.score,
      place: player.place,
      won: isWinner
    });
    stats.history = stats.history.slice(0, 50);
  }
  room.resultSaved = true;
}

function advanceQuiz(code, io) {
  const room = rooms[code];
  if (!room || room.status !== 'active') return;
  
  room.currentQuestionIndex++;
  room.advancePending = false;
  
  if (room.currentQuestionIndex >= room.questions.length) {
    room.status = 'finished';
    room.finishedAt = Date.now();
    room.questionStartTime = null;
    clearTimeout(room.timer);
    room.timer = null;
    
    for (const id of room.players.keys()) {
      if (!room.participated.has(id)) {
        room.participated.add(id);
      }
    }
    
    saveResults(room, code);
        const board = leaderboard(room);
    io.to(code).emit('leaderboard', { players: board });
    io.to(code).emit('quiz_finished');
    
    emitState(io, code);
    return;
  }
  
  const question = room.questions[room.currentQuestionIndex];
  const limit = question.timeLimit || room.timeLimit;
  room.questionStartTime = Date.now();
  room.answers = {};
  for (const id of room.players.keys()) {
    room.answered[id] = false;
  }
  clearTimeout(room.timer);
  room.timer = setTimeout(() => advanceQuiz(code, io), limit * 1000 + 250);
  emitState(io, code);
}

function restartQuiz(code, io) {
  const room = rooms[code];
  if (!room) return { error: 'Комната не найдена' };
  clearTimeout(room.timer);
  room.status = 'waiting';
  room.currentQuestionIndex = -1;
  room.questions = clone(room.originalQuestions);
  room.scores = {};
  room.answers = {};
  room.answered = {};
  room.participated = new Set();
  room.startedAt = null;
  room.finishedAt = null;
  room.questionStartTime = null;
  room.timer = null;
  room.advancePending = false;
  room.resultSaved = false;
  for (const id of room.players.keys()) {
    room.scores[id] = 0;
    room.answered[id] = false;
  }
  emitState(io, code);
  io?.to(code).emit('quiz_restarted');
  return { success: true };
}

function setOrganizer(code, actorId, targetId, enabled) {
  const room = rooms[code];
  if (!room) return { error: 'Комната не найдена' };
  if (!room.organizers.has(actorId)) return { error: 'Недостаточно прав' };
  if (!room.players.has(targetId)) return { error: 'Игрок не найден' };
  if (targetId === room.creatorId && !enabled) {
    return { error: 'Создателя нельзя лишить прав' };
  }
  if (enabled) {
    room.organizers.add(targetId);
  } else {
    room.organizers.delete(targetId);
  }
  return { success: true };
}

module.exports = {
  getRoom,
  createRoom,
  addPlayer,
  removePlayer,
  getGameState,
  emitState,
  startQuiz,
  submitAnswer,
  advanceQuiz,
  restartQuiz,
  setOrganizer
};