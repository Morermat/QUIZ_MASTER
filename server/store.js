const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const users = new Map();
let quizzes = [];
let userStats = new Map();
const socketPresence = new Map();

async function loadUsers() {
  try {
    const res = await pool.query('SELECT * FROM users');
    res.rows.forEach(row => {
      if (row.win_settings) {
        try { row.win_settings = JSON.parse(row.win_settings); } catch { row.win_settings = {}; }
      } else {
        row.win_settings = {};
      }
      users.set(row.id, row);
    });
    const statsRes = await pool.query('SELECT * FROM stats');
    statsRes.rows.forEach(row => {
      userStats.set(row.user_id, {
        gamesPlayed: row.games_played,
        wins: row.wins,
        correctAnswers: row.correct_answers,
        totalAnswers: row.total_answers,
        history: row.history || []
      });
    });
    console.log('Users and stats loaded from DB');
  } catch (err) {
    console.error('Failed to load users from DB:', err.message);
  }
}

async function ensureStats(userId) {
  if (userStats.has(userId)) {
    return userStats.get(userId);
  }
  try {
    await pool.query(
      'INSERT INTO stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
  } catch (err) {
    console.error('Failed to insert stats for user', userId, err.message);
  }
  const stats = { gamesPlayed: 0, wins: 0, correctAnswers: 0, totalAnswers: 0, history: [] };
  userStats.set(userId, stats);
  return stats;
}

async function saveStats(userId, stats) {
  if (!stats) {
    console.warn('saveStats called without stats object for user', userId);
    return;
  }
  await pool.query(
    `UPDATE stats 
     SET games_played = $1, wins = $2, correct_answers = $3, total_answers = $4, history = $5
     WHERE user_id = $6`,
    [stats.gamesPlayed, stats.wins, stats.correctAnswers, stats.totalAnswers, JSON.stringify(stats.history), userId]
  );
  userStats.set(userId, stats);
}

async function saveUser(user) {
  const winSettings = user.win_settings ? JSON.stringify(user.win_settings) : '{}';
  await pool.query(
    `INSERT INTO users (id, name, avatar_url, vk_id, is_anonymous, auth_provider, email, phone, win_icon, win_music, win_settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       avatar_url = EXCLUDED.avatar_url,
       vk_id = EXCLUDED.vk_id,
       is_anonymous = EXCLUDED.is_anonymous,
       auth_provider = EXCLUDED.auth_provider,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       win_icon = EXCLUDED.win_icon,
       win_music = EXCLUDED.win_music,
       win_settings = EXCLUDED.win_settings`,
    [user.id, user.name, user.avatar_url, user.vk_id, user.is_anonymous, user.auth_provider, user.email, user.phone, user.win_icon || null, user.win_music || null, winSettings]
  );
  users.set(user.id, user);
}

function addPresence(userId, socketId) {
  if (!socketPresence.has(userId)) socketPresence.set(userId, new Set());
  socketPresence.get(userId).add(socketId);
}

function removePresence(userId, socketId) {
  const s = socketPresence.get(userId);
  if (!s) return 0;
  s.delete(socketId);
  if (!s.size) socketPresence.delete(userId);
  return s.size;
}

module.exports = { 
  pool, 
  users, 
  quizzes, 
  userStats, 
  ensureStats, 
  saveUser, 
  saveStats,
  addPresence, 
  removePresence, 
  socketPresence, 
  loadUsers 
};