module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Клиент подключен:', socket.id);
    
    socket.on('join_room', ({ roomCode, userId }) => {
      socket.join(roomCode);
      console.log(`Пользователь ${userId} присоединился к ${roomCode}`);
      io.to(roomCode).emit('players_update', [{ id: userId, name: 'Player' }]);
    });
    
    socket.on('disconnect', () => {
      console.log('Клиент отключен:', socket.id);
    });
  });
};