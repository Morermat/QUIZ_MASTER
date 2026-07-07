const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const users = [];

router.post('/anonymous', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Требуется имя' });
  const user = {
    id: uuidv4(),
    name,
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
    is_anonymous: true
  };
  users.push(user);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key');
  res.json({ user, token });
});

router.post('/vk', async (req, res) => {
  const { code } = req.body;
  const vk_id = code || 'mock_vk_' + Date.now();
  let existing = users.find(u => u.vk_id === vk_id);
  if (existing) {
    const token = jwt.sign({ userId: existing.id }, process.env.JWT_SECRET || 'secret_key');
    return res.json({ user: existing, token });
  }
  const user = {
    id: uuidv4(),
    name: 'VK User',
    avatar_url: 'https://vk.com/images/avatar_default.jpg',
    vk_id,
    is_anonymous: false
  };
  users.push(user);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key');
  res.json({ user, token });
});

module.exports = router;