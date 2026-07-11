const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
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

router.post('/vk', async (req, res) => {
  const { code, device_id } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Не передан код' });
  }

  const clientId = process.env.VK_CLIENT_ID || '54674075';
  const clientSecret = process.env.VK_CLIENT_SECRET;
  const redirectUri = process.env.VK_REDIRECT_URI || 'http://localhost/auth/vk-callback';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    device_id: device_id || '',
  });

  try {
    const tokenResponse = await axios.post('https://id.vk.com/oauth2/auth', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokenData = tokenResponse.data;
    if (!tokenData.access_token) {
      throw new Error('Не удалось получить access_token');
    }

    const userInfoResponse = await axios.post('https://id.vk.com/oauth2/user_info',
      new URLSearchParams({
        client_id: clientId,
        access_token: tokenData.access_token,
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
      };
      users.set(user.id, user);
      ensureStats(user.id);
    } else {
      user.name = `${vkUser.first_name} ${vkUser.last_name}`.trim() || user.name;
      user.avatar_url = vkUser.avatar || user.avatar_url;
      if (vkUser.email) user.email = vkUser.email;
      if (vkUser.phone) user.phone = vkUser.phone;
    }

    const token = sign(user);
    res.json({ user, token });
  } catch (err) {
    console.error('VK auth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка авторизации через VK: ' + (err.response?.data?.error_description || err.message) });
  }
});

module.exports = router;