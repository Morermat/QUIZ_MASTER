const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { users, ensureStats, saveUser } = require('../store');
const { secret } = require('../config');

const sign = (user) => jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });

router.post('/anonymous', async (req, res) => {  
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Требуется имя' });
  const user = {
    id: uuidv4(),
    name,
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
    is_anonymous: true,
    auth_provider: 'anonymous',
    win_icon: 'default.gif',  
    win_music: 'default.mp3',  
    vk_id: null,
    email: null,
    phone: null,
  };
  await saveUser(user);        
  await ensureStats(user.id);  
  res.json({ user, token: sign(user) });
});

router.post('/vk', async (req, res) => {
  const { access_token, user_id } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'Не передан access_token' });
  }

  const clientId = process.env.VK_CLIENT_ID || '54674075';

  try {
    const userInfoResponse = await axios.post('https://id.vk.com/oauth2/user_info',
      new URLSearchParams({
        client_id: clientId,
        access_token: access_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const vkUser = userInfoResponse.data.user;
    if (!vkUser) {
      throw new Error('Не удалось получить данные пользователя');
    }

    let user = [...users.values()].find(u => u.vk_id === String(vkUser.user_id));
    if (!user) {
      user = {
        id: uuidv4(),
        name: `${vkUser.first_name} ${vkUser.last_name}`.trim(),
        avatar_url: vkUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(vkUser.first_name || 'User')}&background=random&size=128`,
        vk_id: String(vkUser.user_id),
        is_anonymous: false,
        auth_provider: 'vk',
        email: vkUser.email || null,
        phone: vkUser.phone || null,
        win_icon: 'default.gif',
        win_music: 'default.mp3',
      };
      await saveUser(user);
      await ensureStats(user.id);
    } else {
      user.name = `${vkUser.first_name} ${vkUser.last_name}`.trim() || user.name;
      user.avatar_url = vkUser.avatar || user.avatar_url;
      if (vkUser.email) user.email = vkUser.email;
      if (vkUser.phone) user.phone = vkUser.phone;
      if (!user.win_icon) user.win_icon = 'default.gif';
      if (!user.win_music) user.win_music = 'default.mp3';
      await saveUser(user);
    }

    const token = sign(user);
    res.json({ user, token });
  } catch (err) {
    console.error('VK auth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка авторизации через VK: ' + (err.response?.data?.error_description || err.message) });
  }
});

module.exports = router;