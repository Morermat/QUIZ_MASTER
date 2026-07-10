const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { users, ensureStats } = require('../store');
const { secret } = require('../config');

const sign = (user) => jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });

router.post('/anonymous', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Требуется имя' });
  const user = {
    id: uuidv4(),
    name,
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
    is_anonymous: true,
    auth_provider: 'anonymous'
  };
  users.set(user.id, user);
  ensureStats(user.id);
  res.json({ user, token: sign(user) });
});

// Заготовка: фронтенд сможет обменять код VK ID на локальную сессию,
// когда будет добавлена серверная проверка кода по официальному API VK ID.
router.post('/vk', (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Не передан код VK ID' });
  return res.status(501).json({ error: 'VK ID пока не настроен', provider: 'vk' });
});

module.exports = router;
