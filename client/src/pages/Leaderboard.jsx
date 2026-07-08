import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Leaderboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { code } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const data = location.state || {};
  const leaderboard = data.players || [];
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    socket.emit('join_room', { roomCode: code, userId: user.id, userName: user.name });
    
    socket.on('players_update', (data) => {
      const currentUser = data.find(p => p.id === user.id);
      if (currentUser) {
        setIsCreator(data.length > 0 && data[0].id === user.id);
      }
    });

    socket.on('quiz_restarted', () => {
      navigate(`/lobby/${code}`);
    });

    return () => {
      socket.off('players_update');
      socket.off('quiz_restarted');
    };
  }, [socket, code, user.id, user.name, navigate]);

  const handleRestart = () => {
    if (!socket || !isCreator) return;
    if (!confirm('Перезапустить квиз?')) return;
    socket.emit('restart_quiz', { roomCode: code });
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <h1 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--text-h)' }}>
        Лидерборд
      </h1>

      {leaderboard.length === 0 ? (
        <p className="text-lg" style={{ color: 'var(--text)' }}>Нет результатов</p>
      ) : (
        <table className="w-full max-w-md border-collapse">
          <thead>
            <tr>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Место</th>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Игрок</th>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Очки</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((item, index) => (
              <tr key={item.user_id} style={{ 
                background: item.user_id === user.id ? 'rgba(170,59,255,0.2)' : 'transparent',
                fontWeight: item.user_id === user.id ? 'bold' : 'normal'
              }}>
                <td className="border p-2 text-center" style={{ borderColor: 'var(--border)' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td className="border p-2" style={{ borderColor: 'var(--border)' }}>
                  {item.name || 'Игрок'} {item.user_id === user.id && '(Вы)'}
                </td>
                <td className="border p-2 text-center" style={{ borderColor: 'var(--border)' }}>{item.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary px-6 py-2"
        >
          На главную
        </button>
        {isCreator && (
          <button
            onClick={handleRestart}
            className="px-6 py-2 rounded"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
          >
            Перезапустить
          </button>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;