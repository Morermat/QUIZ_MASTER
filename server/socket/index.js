const rooms = {};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Клиент подключен:', socket.id);

    socket.on('join_room', ({ roomCode, userId }) => {
      socket.join(roomCode);
      console.log(`Пользователь ${userId} присоединился к ${roomCode}`);

      if (!rooms[roomCode]) {
        rooms[roomCode] = {
          players: [],
          scores: {},
          currentQuestionIndex: -1,
          questions: [],
          creatorId: userId
        };
      }

      const room = rooms[roomCode];
      if (!room.players.includes(userId)) {
        room.players.push(userId);
        room.scores[userId] = 0;
      }

      const playersData = room.players.map(id => ({
        id,
        name: 'Игрок',
        isCreator: id === room.creatorId
      }));

      io.to(roomCode).emit('players_update', playersData);
    });

    socket.on('start_quiz', ({ roomCode, questions }) => {
      console.log('Событие start_quiz получено для комнаты:', roomCode);
      const room = rooms[roomCode];
      if (!room) {
        console.log(`Комната ${roomCode} не найдена`);
        return;
      }

      room.questions = questions && questions.length > 0 ? questions : [
        {
          id: 1,
          text: 'Сколько будет 2 + 2?',
          options: [
            { id: 1, text: '3', is_correct: false },
            { id: 2, text: '4', is_correct: true },
            { id: 3, text: '5', is_correct: false },
            { id: 4, text: '6', is_correct: false }
          ]
        }
      ];

      room.currentQuestionIndex = 0;
      const question = room.questions[0];
      
      console.log('Отправка вопроса в комнату:', roomCode, question.text);
      io.to(roomCode).emit('question', question);
      io.to(roomCode).emit('game_started');
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
      }

      const predictions = isCorrect
        ? ['Верно. Ты на верном пути.', 'Правильно. Так держать.', 'Отлично. Ты гений.']
        : ['Неверно. Попробуй ещё.', 'Ошибка. В следующий раз повезёт.', 'Мимо. Но не сдавайся.'];

      const prediction = predictions[Math.floor(Math.random() * predictions.length)];

      socket.emit('answer_result', { isCorrect, prediction });
    });

    socket.on('next_question', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) return;

      room.currentQuestionIndex++;
      if (room.currentQuestionIndex >= room.questions.length) {
        const leaderboard = room.players.map(id => ({
          user_id: id,
          name: 'Игрок',
          score: room.scores[id] || 0
        }));
        leaderboard.sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('leaderboard', leaderboard);
        delete rooms[roomCode];
        return;
      }

      const question = room.questions[room.currentQuestionIndex];
      io.to(roomCode).emit('question', question);
    });

    socket.on('disconnect', () => {
      console.log('Клиент отключен:', socket.id);
    });
  });
};