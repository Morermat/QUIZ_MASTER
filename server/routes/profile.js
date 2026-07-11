const express = require('express');
const auth = require('../middleware/auth');
const { users, ensureStats } = require('../store');
const rooms = require('../rooms');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const stats = ensureStats(req.userId);
  const correctPercent = stats.totalAnswers ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;
  res.json({ user, stats: { ...stats, correctPercent } });
});

router.patch('/', auth, (req, res) => {
  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const name = String(req.body.name || user.name).trim().slice(0, 40);
  const avatar = String(req.body.avatar_url || user.avatar_url || '');
  if (avatar && (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(avatar) && !/^https:\/\//i.test(avatar))) return res.status(400).json({ error: 'Недопустимый аватар' });
  if (avatar.length > 1_500_000) return res.status(400).json({ error: 'Аватар слишком большой' });
  Object.assign(user, { name: name || user.name, avatar_url: avatar });
  for (const room of Object.values(rooms)) { const p = room.players?.get(req.userId); if (p) room.players.set(req.userId, { ...p, name: user.name, avatar_url: user.avatar_url }); }
  res.json({ user });
});

module.exports = router;
