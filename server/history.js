const history = [];

function saveGameResult(roomCode, quizTitle, players, scores) {
  const sorted = players.map(p => ({
    name: p.name,
    score: scores[p.id] || 0
  })).sort((a, b) => b.score - a.score);

  history.push({
    roomCode,
    quizTitle,
    date: new Date().toISOString(),
    players: sorted,
    winner: sorted.length > 0 ? sorted[0].name : null
  });
}

function getHistory() {
  return history;
}

function getHistoryByUser(userId) {
  return history;
}

module.exports = { saveGameResult, getHistory, getHistoryByUser };