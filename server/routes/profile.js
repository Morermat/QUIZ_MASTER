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
  limits: { fileSize: 5 * 1024 * 1024 },
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
    const settings = user.win_settings || {};

    if (req.files?.icon) {
      const file = req.files.icon[0];
      updates.win_icon = `${baseUrl}/uploads/icons/${file.filename}`;
      settings.iconType = file.mimetype.startsWith('video') ? 'video' : 'image';
      if (!settings.iconType === 'video') {
        delete settings.start;
        delete settings.end;
      }
    }
    if (req.files?.music) {
  const file = req.files.music[0];
  updates.win_music = `${baseUrl}/uploads/audio/${file.filename}`;
  if (req.body.musicStart !== undefined) settings.musicStart = parseInt(req.body.musicStart) || 0;
  if (req.body.musicEnd !== undefined) settings.musicEnd = parseInt(req.body.musicEnd) || 0;
}

    if (req.body.start !== undefined) settings.start = parseInt(req.body.start) || 0;
    if (req.body.end !== undefined) settings.end = parseInt(req.body.end) || 0;
    if (req.body.display_size) settings.display_size = req.body.display_size || 'medium';
    if (settings.iconType !== 'video') {
      delete settings.start;
      delete settings.end;
    }

    user.win_settings = settings;
    Object.assign(user, updates);
    await saveUser(user);
    res.json({ user, uploaded: updates, settings });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.delete('/upload', auth, async (req, res) => {
  const { type } = req.query; 
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
  if (type === 'icon') {
    user.win_settings = {};
  }
  await saveUser(user);

  res.json({ user });
});

module.exports = router;