const rooms = require('../rooms');

function sortLeaderboard(players, scores, lastAnswerTimes) {
  const sorted = players.map(p => ({
    user_id: p.id,
    name: p.name,
    score: scores[p.id] || 0,
    lastAnswerTime: lastAnswerTimes[p.id] || null
  }));

  sorted.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.lastAnswerTime || Infinity) - (b.lastAnswerTime || Infinity);
  });
  
  return sorted;
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Клиент подключен:', socket.id);

    socket.on('join_room', ({ roomCode, userId, userName }) => {
      if (!rooms[roomCode]) {
        socket.emit('error', 'Комната не найдена');
        socket.disconnect();
        return;
      }

      const room = rooms[roomCode];
      
      if (room.status === 'finished') {
        socket.emit('error', 'Квиз завершён, создайте новый');
        socket.disconnect();
        return;
      }

      socket.join(roomCode);
      console.log(`Пользователь ${userId} (${userName}) присоединился к ${roomCode}`);

      const existing = room.players.find(p => p.id === userId);
      if (!existing) {
        room.players.push({ id: userId, name: userName || 'Игрок' });
        room.scores[userId] = 0;
        room.lastAnswerTimes[userId] = null;
      }

      const playersData = room.players.map(p => ({
        id: p.id,
        name: p.name,
        isCreator: p.id === room.creatorId
      }));
      io.to(roomCode).emit('players_update', playersData);

      if (room.currentQuestionIndex >= 0 && room.questions.length > 0) {
        const currentQuestion = room.questions[room.currentQuestionIndex];
        if (currentQuestion) {
          socket.emit('game_state', {
            question: currentQuestion,
            scores: room.scores,
            isCreator: room.creatorId === userId,
            currentQuestionIndex: room.currentQuestionIndex,
            totalQuestions: room.questions.length,
            timeLimit: room.timeLimit
          });
        }
      }
    });

    socket.on('start_quiz', ({ roomCode }) => {
      console.log('Старт квиза в комнате:', roomCode);
      const room = rooms[roomCode];
      if (!room) return;

      if (room.status === 'finished') {
        socket.emit('error', 'Квиз уже завершён');
        return;
      }

      if (room.questions.length === 0) {
        socket.emit('error', 'Нет вопросов');
        return;
      }

      room.currentQuestionIndex = 0;
      room.status = 'active';
      room.startedAt = new Date();
      
      const question = room.questions[0];
      const timeLimit = question.timeLimit || room.timeLimit || 30;

      io.to(roomCode).emit('question', { ...question, timeLimit });
      io.to(roomCode).emit('game_started');
    });

    socket.on('restart_quiz', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) return;
      
      if (room.creatorId !== socket.id) {
        socket.emit('error', 'Только организатор может перезапустить');
        return;
      }

      room.status = 'waiting';
      room.currentQuestionIndex = -1;
      room.questions = JSON.parse(JSON.stringify(room.originalQuestions || []));
      room.scores = {};
      room.lastAnswerTimes = {};
      room.players.forEach(p => {
        room.scores[p.id] = 0;
        room.lastAnswerTimes[p.id] = null;
      });
      room.startedAt = null;
      room.finishedAt = null;

      const playersData = room.players.map(p => ({
        id: p.id,
        name: p.name,
        isCreator: p.id === room.creatorId
      }));

      io.to(roomCode).emit('quiz_restarted');
      io.to(roomCode).emit('players_update', playersData);
      
      console.log(`Квиз ${roomCode} перезапущен`);
    });

    socket.on('submit_answer', ({ roomCode, userId, questionId, optionId }) => {
      const room = rooms[roomCode];
      if (!room) return;

      const question = room.questions.find(q => q.id === questionId);
      if (!question) return;

      const selectedOption = question.options.find(o => o.id === optionId);
      const isCorrect = selectedOption ? selectedOption.is_correct : false;

      if (isCorrect) {
        room.scores[userId] = (room.scores[userId] || 0) + 1;
        room.lastAnswerTimes[userId] = Date.now();
      }

      const predictions = isCorrect
        ? ['Верно', 'Правильно', 'Отлично']
        : ['Неверно', 'Ошибка', 'Мимо'];

      const prediction = predictions[Math.floor(Math.random() * predictions.length)];

      socket.emit('answer_result', { isCorrect, prediction });
    });

    socket.on('next_question', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) return;

      room.currentQuestionIndex++;
      if (room.currentQuestionIndex >= room.questions.length) {
        room.status = 'finished';
        room.finishedAt = new Date();
        const leaderboard = sortLeaderboard(room.players, room.scores, room.lastAnswerTimes);
        io.to(roomCode).emit('leaderboard', { players: leaderboard });
        return;
      }

      const question = room.questions[room.currentQuestionIndex];
      const timeLimit = question.timeLimit || room.timeLimit || 30;
      io.to(roomCode).emit('question', { ...question, timeLimit });
    });

    socket.on('disconnect', () => {
      console.log('Клиент отключен:', socket.id);
    });
  });
};