const rooms = require('./rooms');

function createRoom(roomCode, quizData) {
  rooms[roomCode] = {
    quizTitle: quizData.title,
    questions: quizData.questions.map(q => ({
      ...q,
      options: q.options.map(o => ({ ...o }))
    })),
    originalQuestions: quizData.questions.map(q => ({
      ...q,
      options: q.options.map(o => ({ ...o }))
    })),
    timeLimit: quizData.timeLimit || 30,
    creatorId: quizData.creatorId,
    players: [],
    scores: {},
    answered: {},
    currentQuestionIndex: -1,
    status: 'waiting',
    startedAt: null,
    finishedAt: null,
    questionStartTime: null,
    timer: null,
    isRestarting: false
  };
}

function addPlayer(roomCode, userId, userName) {
  const room = rooms[roomCode];
  if (!room) return { error: 'Комната не найдена' };
  if (room.status === 'finished') return { error: 'Квиз завершён' };
  
  if (!room.players.find(p => p.id === userId)) {
    room.players.push({ id: userId, name: userName || 'Игрок' });
    room.scores[userId] = 0;
    room.answered[userId] = false;
  }
  
  return { success: true };
}

function getGameState(roomCode, userId) {
  const room = rooms[roomCode];
  if (!room) return null;
  
  const currentQuestion = room.currentQuestionIndex >= 0 && room.currentQuestionIndex < room.questions.length 
    ? room.questions[room.currentQuestionIndex] 
    : null;
    
  let timeLeft = null;
  if (room.questionStartTime && currentQuestion) {
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    const limit = currentQuestion.timeLimit || room.timeLimit || 30;
    timeLeft = Math.max(0, Math.floor(limit - elapsed));
  }
  
  return {
    status: room.status,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isCreator: p.id === room.creatorId
    })),
    scores: room.scores,
    currentQuestion: currentQuestion,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    isCreator: room.creatorId === userId,
    timeLeft: timeLeft,
    answered: room.answered,
    quizTitle: room.quizTitle,
    creatorId: room.creatorId
  };
}

function startQuiz(roomCode, io) {
  const room = rooms[roomCode];
  if (!room) return { error: 'Комната не найдена' };
  if (room.status === 'active') return { error: 'Квиз уже идёт' };
  if (room.status === 'finished') return { error: 'Квиз завершён' };
  if (room.questions.length === 0) return { error: 'Нет вопросов' };
  
  room.status = 'active';
  room.currentQuestionIndex = 0;
  room.startedAt = Date.now();
  room.players.forEach(p => room.answered[p.id] = false);
  
  const question = room.questions[0];
  const timeLimit = question.timeLimit || room.timeLimit || 30;
  room.questionStartTime = Date.now();
  
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    advanceQuiz(roomCode, io);
  }, timeLimit * 1000 + 500);
  
  io.to(roomCode).emit('question', { question, timeLimit });
  return { success: true };
}

function submitAnswer(roomCode, userId, questionId, optionId, io) {
  const room = rooms[roomCode];
  if (!room) return { error: 'Комната не найдена' };
  if (room.status !== 'active') return { error: 'Квиз не активен' };
  if (room.currentQuestionIndex < 0) return { error: 'Нет активного вопроса' };
  
  const question = room.questions[room.currentQuestionIndex];
  if (!question || question.id !== questionId) return { error: 'Неверный вопрос' };
  
  if (room.questionStartTime) {
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    const limit = question.timeLimit || room.timeLimit || 30;
    if (elapsed > limit) return { error: 'Время вышло' };
  }
  
  if (room.answered[userId]) return { error: 'Уже отвечено' };
  
  const selected = question.options.find(o => o.id === optionId);
  if (!selected) return { error: 'Неверный вариант' };
  
  const isCorrect = selected.is_correct;
  if (isCorrect) {
    room.scores[userId] = (room.scores[userId] || 0) + 1;
  }
  
  room.answered[userId] = true;
  
  const allAnswered = room.players.every(p => room.answered[p.id] === true);
  if (allAnswered) {
    if (room.timer) clearTimeout(room.timer);
    setTimeout(() => advanceQuiz(roomCode, io), 1000);
  }
  
  return { isCorrect };
}

function advanceQuiz(roomCode, io) {
  const room = rooms[roomCode];
  if (!room) return;
  if (room.isRestarting) return;
  
  room.currentQuestionIndex++;
  
  if (room.currentQuestionIndex >= room.questions.length) {
    room.status = 'finished';
    room.finishedAt = Date.now();
    if (room.timer) clearTimeout(room.timer);
    
    const leaderboard = room.players.map(p => ({
      user_id: p.id,
      name: p.name,
      score: room.scores[p.id] || 0
    }));
    leaderboard.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    
    io.to(roomCode).emit('leaderboard', { players: leaderboard });
    io.to(roomCode).emit('quiz_finished');
    return;
  }
  
  const question = room.questions[room.currentQuestionIndex];
  const timeLimit = question.timeLimit || room.timeLimit || 30;
  room.questionStartTime = Date.now();
  room.players.forEach(p => room.answered[p.id] = false);
  
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    advanceQuiz(roomCode, io);
  }, timeLimit * 1000 + 500);
  
  io.to(roomCode).emit('question', { question, timeLimit });
}

function restartQuiz(roomCode) {
  const room = rooms[roomCode];
  if (!room) return { error: 'Комната не найдена' };
  
  room.isRestarting = true;
  
  room.status = 'waiting';
  room.currentQuestionIndex = -1;
  room.questions = JSON.parse(JSON.stringify(room.originalQuestions));
  room.scores = {};
  room.answered = {};
  room.players.forEach(p => {
    room.scores[p.id] = 0;
    room.answered[p.id] = false;
  });
  room.startedAt = null;
  room.finishedAt = null;
  room.questionStartTime = null;
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  
  room.isRestarting = false;
  return { success: true };
}

module.exports = {
  createRoom,
  addPlayer,
  getGameState,
  startQuiz,
  submitAnswer,
  advanceQuiz,
  restartQuiz
};