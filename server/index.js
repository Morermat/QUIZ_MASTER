require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const setupSocket = require('./socket');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/quizzes', quizRoutes);

app.get('/', (req, res) => {
  res.send('Сервер запущен!');
});

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  } 
});
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));