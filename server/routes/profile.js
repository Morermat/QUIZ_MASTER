const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { users, ensureStats, saveUser } = require('../store');
const rooms = require('../rooms');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.fieldname === 'icon' ? 'icons' : 'audio';
    const dir = path.join(__dirname, '../uploads', type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'icon') {
    if (['image/gif', 'image/png', 'image/webp', 'video/mp4'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Неверный формат иконки (GIF, PNG, WEBP, MP4)'), false);
  } else if (file.fieldname === 'music') {
    if (['audio/mpeg', 'audio/ogg'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Неверный формат музыки (MP3, OGG)'), false);
  } else cb(new Error('Неизвестное поле'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter
});

router.get('/', auth, async (req, res) => {
  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const stats = await ensureStats(req.userId);
  const correctPercent = stats.totalAnswers ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;
  res.json({ user, stats: { ...stats, correctPercent } });
});

router.patch('/', auth, async (req, res) => {
  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const name = String(req.body.name || user.name).trim().slice(0, 40);
  const avatar = String(req.body.avatar_url || user.avatar_url || '');
  if (avatar && (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(avatar) && !/^https:\/\//i.test(avatar))) return res.status(400).json({ error: 'Недопустимый аватар' });
  if (avatar.length > 1_500_000) return res.status(400).json({ error: 'Аватар слишком большой' });
  
  Object.assign(user, { 
    name: name || user.name, 
    avatar_url: avatar
  });
  
  for (const room of Object.values(rooms)) { 
    const p = room.players?.get(req.userId); 
    if (p) room.players.set(req.userId, { ...p, name: user.name, avatar_url: user.avatar_url }); 
  }
  
  await saveUser(user);
  res.json({ user });
});

router.post('/upload', auth, upload.fields([{ name: 'icon', maxCount: 1 }, { name: 'music', maxCount: 1 }]), async (req, res) => {
  try {
    const user = users.get(req.userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const baseUrl = process.env.BASE_URL || 'https://quiz-master-backend-o9uo.onrender.com';
    const updates = {};

    if (req.files?.icon) {
      const file = req.files.icon[0];
      updates.win_icon = `${baseUrl}/uploads/icons/${file.filename}`;
    }
    if (req.files?.music) {
      const file = req.files.music[0];
      updates.win_music = `${baseUrl}/uploads/audio/${file.filename}`;
    }

    Object.assign(user, updates);
    await saveUser(user);
    res.json({ user, uploaded: updates });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.delete('/upload', auth, async (req, res) => {
  const { type } = req.query; // 'icon' или 'music'
  if (!type) return res.status(400).json({ error: 'Укажите тип: icon или music' });

  const user = users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const field = type === 'icon' ? 'win_icon' : 'win_music';
  const fileUrl = user[field];

  if (!fileUrl) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const baseUrl = process.env.BASE_URL || 'https://quiz-master-backend-o9uo.onrender.com';
  const relativePath = fileUrl.replace(baseUrl, '');
  const fullPath = path.join(__dirname, '..', relativePath);

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('Ошибка удаления файла:', err);
  }

  user[field] = null;
  await saveUser(user);

  res.json({ user });
});

module.exports = router;