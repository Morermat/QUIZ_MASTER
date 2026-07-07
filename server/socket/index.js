module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);
    
    socket.on('join_room', ({ roomCode, userId }) => {
      socket.join(roomCode);
      console.log(`User ${userId} joined room ${roomCode}`);
      io.to(roomCode).emit('players_update', [{ id: userId, name: 'Player' }]);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });
};