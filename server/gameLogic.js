const rooms = require('./rooms');
const { ensureStats, saveStats } = require('./store'); 

const clone = (v) => JSON.parse(JSON.stringify(v));
const normalizeIds = (ids) => [...new Set((Array.isArray(ids) ? ids : [ids]).filter(v => v !== undefined && v !== null).map(String))].sort();

function getRoom(code) { return rooms[code] || null; }

function createRoom(roomCode, quizData) {
  const timeLimit = quizData.timeLimit !== undefined ? quizData.timeLimit : 30;
  rooms[roomCode] = {
    quizTitle: quizData.title,
    questions: clone(quizData.questions),
    originalQuestions: clone(quizData.questions),
    timeLimit: timeLimit,
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
    resultSaved: false,
    _leaderboardCache: null,
    _questionHistory: null,
    _questionHistoryCache: null
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

  let limit = question?.timeLimit !== undefined ? question.timeLimit : room.timeLimit;
  const hasTimer = (limit !== null && limit !== undefined && limit > 0);

  let timeLeft = null;
  let questionEndsAt = null;
  if (hasTimer && room.questionStartTime) {
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    timeLeft = Math.max(0, Math.ceil(limit - elapsed));
    questionEndsAt = room.questionStartTime + limit * 1000;
  }

  const answer = room.answers[userId];
  
  let leaderboardData = null;
  if (room.status === 'finished') {
    leaderboardData = room._leaderboardCache || leaderboard(room);
  }
  
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
    questionEndsAt: questionEndsAt,
    hasAnswered: !!room.answered[userId],
    selectedOptionIds: answer?.optionIds || [],
    answerResult: answer ? {
      isCorrect: answer.isCorrect,
      points: +answer.points.toFixed(2)
    } : null,
    quizTitle: room.quizTitle,
    creatorId: room.creatorId,
    organizers: [...room.organizers],
    leaderboard: leaderboardData,
    questionHistory: room.organizers.has(userId) ? (room._questionHistoryCache || room._questionHistory || null) : null
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
  room.timer = setTimeout(async () => {
    room.advancePending = false;
    await advanceQuiz(code, io);
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
  room._leaderboardCache = null;
  room._questionHistory = {};
  room._questionHistoryCache = null;
  
  for (const id of room.players.keys()) {
    room.scores[id] = 0;
    room.answered[id] = false;
  }
  
  const question = room.questions[0];
  let limit = question?.timeLimit !== undefined ? question.timeLimit : room.timeLimit;
  const hasTimer = (limit !== null && limit !== undefined && limit > 0);
  
  if (hasTimer) {
    room.questionStartTime = Date.now();
    room.timer = setTimeout(() => advanceQuiz(code, io), limit * 1000 + 250);
  } else {
    room.questionStartTime = null;
  }
  
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

  let limit = question?.timeLimit !== undefined ? question.timeLimit : room.timeLimit;
  const hasTimer = (limit !== null && limit !== undefined && limit > 0);
  if (hasTimer && room.questionStartTime) {
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    if (elapsed > limit) {
      return { error: 'Время вышло' };
    }
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

  const scoringType = question.scoringType || 'exact';
  let points = 0;
  
  if (scoringType === 'exact') {
    points = exact ? 1 : 0;
  } else if (scoringType === 'partial') {
    const raw = (correctSelected - wrongSelected) / correct.length;
    points = Math.max(0, Math.min(1, raw));
  } else if (scoringType === 'perCorrect') {
    points = correctSelected * (1 / correct.length);
  }

  room.scores[userId] = (room.scores[userId] || 0) + points;
  room.answered[userId] = true;
  room.answers[userId] = {
    questionId: question.id,
    optionIds: selected,
    isCorrect: exact,
    points: points
  };
  room.participated.add(userId);

  if (!room._questionHistory) {
    room._questionHistory = {};
  }
  if (!room._questionHistory[question.id]) {
    room._questionHistory[question.id] = {
      questionText: question.text,
      answers: {}
    };
  }
  room._questionHistory[question.id].answers[userId] = {
    optionIds: selected,
    isCorrect: exact,
    points: points
  };

ensureStats(userId).then(stats => {
  stats.totalAnswers++;
  if (exact) stats.correctAnswers++;
  return saveStats(userId);
}).catch(console.error);

  const allAnswered = [...room.players.keys()].every(id => room.answered[id]);
  if (allAnswered) scheduleAdvance(code, io);

  emitState(io, code);
  return {
    isCorrect: exact,
    points: +points.toFixed(2)
  };
}

async function saveResults(room, code) {
  if (room.resultSaved) return;
  
  for (const id of room.players.keys()) {
    if (!room.participated.has(id)) {
      room.participated.add(id);
    }
  }
  
  const board = leaderboard(room).filter(p => room.participated.has(p.user_id));
  const topScore = board[0]?.score;
  
  for (const player of board) {
  try {
    const stats = await ensureStats(player.user_id);
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
    await saveStats(player.user_id, stats); // ← добавляем сохранение
  } catch (err) {
    console.error('Error saving stats for user', player.user_id, err);
  }
}

  
  room._leaderboardCache = board;
  room._questionHistoryCache = room._questionHistory || null;
  room.resultSaved = true;
}

async function advanceQuiz(code, io) {
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
    
    await saveResults(room, code);
    const board = room._leaderboardCache || leaderboard(room);
    io.to(code).emit('leaderboard', { players: board });
    io.to(code).emit('quiz_finished');
    emitState(io, code);
    return;
  }
  
  const question = room.questions[room.currentQuestionIndex];
  let limit = question?.timeLimit !== undefined ? question.timeLimit : room.timeLimit;
  const hasTimer = (limit !== null && limit !== undefined && limit > 0);
  
  if (hasTimer) {
    room.questionStartTime = Date.now();
    room.timer = setTimeout(() => advanceQuiz(code, io), limit * 1000 + 250);
  } else {
    room.questionStartTime = null;
  }
  
  room.answers = {};
  for (const id of room.players.keys()) {
    room.answered[id] = false;
  }
  clearTimeout(room.timer);
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
  room._leaderboardCache = null;
  room._questionHistory = null;
  room._questionHistoryCache = null;
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