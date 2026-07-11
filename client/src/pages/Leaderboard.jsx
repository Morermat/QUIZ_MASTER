import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Leaderboard() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const onGameState = (data) => {
      if (data.roomCode && data.roomCode !== code) return;
      if (data.isOrganizer !== undefined) setIsOrganizer(data.isOrganizer);
      if (data.leaderboard && data.leaderboard.length > 0) {
        setLeaderboardData(data.leaderboard);
        setLoading(false);
      }
      if (data.status === 'waiting') navigate(`/lobby/${code}`);
    };

    const onLeaderboard = (data) => {
      const board = data.players || data;
      setLeaderboardData(board);
      setLoading(false);
    };

    const onRestart = () => {
      navigate(`/lobby/${code}`);
    };

    socket.on('game_state', onGameState);
    socket.on('leaderboard', onLeaderboard);
    socket.on('quiz_restarted', onRestart);

    socket.emit('join_room', { roomCode: code }, (res) => {
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      }
    });

    socket.emit('request_state', { roomCode: code }, (res) => {
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      }
    });

    return () => {
      socket.off('game_state', onGameState);
      socket.off('leaderboard', onLeaderboard);
      socket.off('quiz_restarted', onRestart);
      socket.emit('leave_room', { roomCode: code });
    };
  }, [socket, code, navigate]);

  const board = leaderboardData || [];

  if (loading) {
    return <div className="max-w-lg mx-auto p-6 text-center">Загрузка результатов...</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Лидерборд</h1>
      {error && <p className="text-red-500">{error}</p>}
      {board.length === 0 ? (
        <p className="text-center text-gray-500">Нет результатов</p>
      ) : (
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
      )}
      <div className="mt-5 flex gap-3">
        <button onClick={() => navigate('/dashboard')}>На главную</button>
        {isOrganizer && (
          <button
            className="btn-primary px-4 py-2"
            onClick={() => socket.emit('restart_quiz', { roomCode: code }, (r) => r?.error && setError(r.error))}
          >
            Перезапустить
          </button>
        )}
      </div>
    </div>
  );
}