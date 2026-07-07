const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Временно храним квизы в памяти (потом заменим на БД)
const quizzes = [];
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Создать квиз
router.post('/', (req, res) => {
  const { title, questions } = req.body;
  const userId = req.userId || 'temp_user';
  const code = generateCode();
  
  const quiz = {
    id: uuidv4(),
    title,
    code,
    created_by: userId,
    status: 'waiting',
    questions: questions || []
  };
  
  quizzes.push(quiz);
  res.json(quiz);
});

// Получить все квизы пользователя
router.get('/', (req, res) => {
  const userId = req.userId || 'temp_user';
  const userQuizzes = quizzes.filter(q => q.created_by === userId);
  res.json(userQuizzes);
});

// Получить квиз по ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json(quiz);
});

module.exports = router;