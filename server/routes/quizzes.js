const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const auth = require('../middleware/auth');
const game = require('../gameLogic');
const { quizzes } = require('../store');

const clampOrNull = (value, min, max, fallback) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, Math.round(num)));
};

const code = () => {
  let c;
  do c = Math.floor(100000 + Math.random() * 900000).toString();
  while (game.getRoom(c));
  return c;
};

function sanitizeQuestions(input, defaultTime) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new Error('Количество вопросов: от 1 до 100');
  }
  return input.map(q => {
    const text = String(q.text || '').trim().slice(0, 500);
    if (!text) throw new Error('Пустой текст вопроса');
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) {
      throw new Error('Вариантов ответа должно быть от 2 до 8');
    }
    const opts = q.options.map(o => ({
      id: uuid(),
      text: String(o.text || '').trim().slice(0, 200),
      is_correct: !!o.is_correct
    }));
    if (opts.some(o => !o.text)) throw new Error('Пустой вариант ответа');
    const correct = opts.filter(o => o.is_correct).length;
    if (!correct) throw new Error('У каждого вопроса должен быть правильный ответ');
    const image = q.image_url ? String(q.image_url) : null;
    if (image && (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(image) || image.length > 2800000)) {
      throw new Error('Недопустимое изображение');
    }
    const scoringType = q.scoringType || 'exact';
    const timeLimit = q.timeLimit !== null && q.timeLimit !== undefined 
      ? clampOrNull(q.timeLimit, 5, 300, defaultTime)
      : null;
    return {
      id: uuid(),
      text,
      image_url: image,
      multiple: !!q.multiple || correct > 1,
      timeLimit: timeLimit,
      scoringType: scoringType,
      options: opts
    };
  });
}

router.post('/', auth, (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'Введите название' });
    let timeLimit = req.body.timeLimit !== undefined ? req.body.timeLimit : 30;
    if (timeLimit !== null) {
      timeLimit = clampOrNull(timeLimit, 5, 300, 30);
    }
    const questions = sanitizeQuestions(req.body.questions, timeLimit);
    const roomCode = code();
    const quiz = {
      id: uuid(),
      title,
      code: roomCode,
      created_by: req.userId,
      status: 'waiting',
      questions,
      timeLimit
    };
    quizzes.push(quiz);
    game.createRoom(roomCode, { title, questions, timeLimit, creatorId: req.userId });
    res.json({ ...quiz, questions: undefined });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/', auth, (req, res) => {
  res.json(quizzes
    .filter(q => q.created_by === req.userId)
    .map(({ questions, ...q }) => ({ ...q, questionCount: questions.length }))
  );
});

router.get('/:id', auth, (req, res) => {
  const q = quizzes.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Квиз не найден' });
  if (q.created_by !== req.userId) return res.status(403).json({ error: 'Нет доступа' });
  res.json(q);
});

module.exports = router;