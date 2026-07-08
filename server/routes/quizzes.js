const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

const quizzes = [];
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post('/', auth, (req, res) => {
  const { title, questions } = req.body;
  const userId = req.userId;
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

router.get('/', auth, (req, res) => {
  const userId = req.userId;
  const userQuizzes = quizzes.filter(q => q.created_by === userId);
  res.json(userQuizzes);
});

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не был найден' });
  res.json(quiz);
});

module.exports = router;