const gameLogic = require('../gameLogic');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Клиент подключен:', socket.id);

    socket.on('join_room', ({ roomCode, userId, userName }) => {
      console.log('join_room:', { roomCode, userId, userName, socketId: socket.id });
      const roomState = gameLogic.getGameState(roomCode, userId);
      if (!roomState) {
        socket.emit('error', 'Комната не найдена');
        console.log('error Комната не найдена', { roomCode, userId, userName, socketId: socket.id });
        return;
      }

      const result = gameLogic.addPlayer(roomCode, userId, userName);
      if (result.error) {
        socket.emit('error', result.error);
        return;
      }

      socket.join(roomCode);
      
      const state = gameLogic.getGameState(roomCode, userId);
      if (state) {
        socket.emit('game_state', state);
        io.to(roomCode).emit('players_update', state.players);
      }
    });

    socket.on('start_quiz', ({ roomCode, userId }) => {
      console.log('start_quiz:', { roomCode, userId, socketId: socket.id });
      const state = gameLogic.getGameState(roomCode, userId);
      if (!state) {
        socket.emit('error', 'Комната не найдена');
        return;
      }
      if (!state.isCreator) {
        socket.emit('error', 'Только организатор может начать игру');
        return;
      }
      
      const result = gameLogic.startQuiz(roomCode, io);
      if (result.error) {
        socket.emit('error', result.error);
      }
    });

    socket.on('submit_answer', ({ roomCode, userId, questionId, optionId }) => {
      console.log('submit_answer:', { roomCode, userId, questionId, optionId, socketId: socket.id });
      const result = gameLogic.submitAnswer(roomCode, userId, questionId, optionId, io);
      if (result.error) {
        socket.emit('error', result.error);
        return;
      }
      socket.emit('answer_result', { isCorrect: result.isCorrect });
    });

    socket.on('restart_quiz', ({ roomCode, userId }) => {
      console.log('restart_quiz:', { roomCode, userId, socketId: socket.id });
      const state = gameLogic.getGameState(roomCode, userId);
      if (!state) {
        socket.emit('error', 'Комната не найдена');
        return;
      }
      if (!state.isCreator) {
        socket.emit('error', 'Только организатор может перезапустить игру');
        return;
      }
      
      const result = gameLogic.restartQuiz(roomCode);
      if (result.error) {
        socket.emit('error', result.error);
        return;
      }
      
      io.to(roomCode).emit('quiz_restarted');
      const newState = gameLogic.getGameState(roomCode, userId);
      if (newState) {
        io.to(roomCode).emit('game_state', newState);
        io.to(roomCode).emit('players_update', newState.players);
      }
    });

    socket.on('disconnect', () => {
      console.log('Клиент отключен:', socket.id);
    });
  });
};