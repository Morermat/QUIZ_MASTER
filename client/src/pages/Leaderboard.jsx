import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useState, useEffect, useRef } from 'react';

export default function Leaderboard() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [leaderboardData, setLeaderboardData] = useState(location.state?.leaderboard || null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [questionHistory, setQuestionHistory] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [winIcon, setWinIcon] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
  if (!leaderboardData || !user) return;
  const first = leaderboardData[0];
  if (first && first.user_id === user.id) {
    const icon = user.win_icon;
    const music = user.win_music;
    let hasAnimation = false;

    if (icon) {
      setWinIcon(icon);
      hasAnimation = true;
    }
    if (music) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(music);
      audioRef.current = audio;
      audio.play().catch(err => console.warn('Аудио не заиграло, ошибка:', err));
      hasAnimation = true;
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      }, 3000);
    }
    if (hasAnimation) setShowWin(true);
    setTimeout(() => setShowWin(false), 3000);
  }
}, [leaderboardData, user]);

  useEffect(() => {
    if (!socket) return;

    const onGameState = (data) => {
      if (data.roomCode && data.roomCode !== code) return;
      if (data.isOrganizer !== undefined) setIsOrganizer(data.isOrganizer);
      if (data.leaderboard && data.leaderboard.length > 0) {
        setLeaderboardData(data.leaderboard);
        setLoading(false);
      }
      if (data.questionHistory) {
        setQuestionHistory(data.questionHistory);
      }
      if (data.status === 'waiting') navigate(`/lobby/${code}`);
    };

    const onLeaderboard = (data) => {
      const board = data.players || data;
      setLeaderboardData(board);
      setLoading(false);
    };

    const onRestart = () => navigate(`/lobby/${code}`);

    socket.on('game_state', onGameState);
    socket.on('leaderboard', onLeaderboard);
    socket.on('quiz_restarted', onRestart);

    socket.emit('join_room', { roomCode: code }, (res) => {
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      }
    });
    socket.emit('request_state', { roomCode: code });

    return () => {
      socket.off('game_state', onGameState);
      socket.off('leaderboard', onLeaderboard);
      socket.off('quiz_restarted', onRestart);
      socket.emit('leave_room', { roomCode: code });
    };
  }, [socket, code, navigate]);

  const board = leaderboardData || [];

  if (loading) return <div className="max-w-lg mx-auto p-6 text-center">Загрузка...</div>;

  const renderDetailsModal = () => {
    if (!questionHistory || !isOrganizer) return null;
    const questionIds = Object.keys(questionHistory);
    if (questionIds.length === 0) return <p>Нет данных по вопросам</p>;

    const playerNames = {};
    board.forEach(p => { playerNames[p.user_id] = p.name; });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetails(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Статистика по вопросам</h2>
            <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Вопрос</th>
                  {board.map(p => (
                    <th key={p.user_id} className="border p-2 text-center">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questionIds.map(qId => {
                  const q = questionHistory[qId];
                  return (
                    <tr key={qId}>
                      <td className="border p-2 font-medium">{q.questionText}</td>
                      {board.map(p => {
                        const answer = q.answers[p.user_id];
                        let cell = '—';
                        let bg = '';
                        if (answer) {
                          cell = answer.isCorrect ? '✅' : '❌';
                          bg = answer.isCorrect ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20';
                        }
                        return (
                          <td key={p.user_id} className={`border p-2 text-center ${bg}`}>{cell}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-gray-500">✅ — правильно, ❌ — неправильно, — — не отвечал</div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Лидерборд</h1>
      {error && <p className="text-red-500">{error}</p>}
      {board.length === 0 ? (
        <p className="text-center text-gray-500">Нет результатов</p>
      ) : (
        <>
          <div className="grid gap-2">
            {board.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 p-3 border rounded">
                <b>{p.place || '—'}</b>
                {p.avatar_url && <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full" />}
                <span>{p.name}{p.user_id === user?.id ? ' (Вы)' : ''}</span>
                <b className="ml-auto">{p.score !== undefined ? p.score : '0'}</b>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={() => navigate('/dashboard')} className="btn-secondary">На главную</button>
            {isOrganizer && (
              <>
                <button className="btn-primary" onClick={() => socket.emit('restart_quiz', { roomCode: code })}>Перезапустить</button>
                {questionHistory && Object.keys(questionHistory).length > 0 && (
                  <button className="btn-secondary" onClick={() => setShowDetails(true)}>Детали</button>
                )}
              </>
            )}
          </div>
        </>
      )}
      {showDetails && renderDetailsModal()}
      {showWin && winIcon && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 pointer-events-none">
    <div className="animate-pulse">
      <img src={winIcon} alt="Победа!" className="w-64 h-64 object-contain" />
    </div>
  </div>
)}
    </div>
  );
}