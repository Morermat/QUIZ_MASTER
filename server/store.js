const users = new Map();
const quizzes = [];
const userStats = new Map();
const socketPresence = new Map();
function ensureStats(userId){if(!userStats.has(userId))userStats.set(userId,{gamesPlayed:0,wins:0,correctAnswers:0,totalAnswers:0,history:[]});return userStats.get(userId)}
function addPresence(userId, socketId){if(!socketPresence.has(userId))socketPresence.set(userId,new Set());socketPresence.get(userId).add(socketId)}
function removePresence(userId,socketId){const s=socketPresence.get(userId);if(!s)return 0;s.delete(socketId);if(!s.size)socketPresence.delete(userId);return s.size}
module.exports={users,quizzes,userStats,ensureStats,addPresence,removePresence,socketPresence};
