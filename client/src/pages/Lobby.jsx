import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Lobby = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [players, setPlayers] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join_room', { roomCode: code, userId: user.id, userName: user.name });

    socket.on('players_update', (data) => {
      setPlayers(data);
      const currentPlayer = data.find(p => p.id === user.id);
      if (currentPlayer) {
        setIsCreator(currentPlayer.isCreator || false);
      }
    });

    socket.on('question', (data) => {
      console.log('Получен вопрос, переходим в игру:', data);
      navigate(`/game/${code}`, { state: { question: data } });
    });

    socket.on('game_started', () => {
      console.log('Игра началась');
    });

    socket.on('quiz_restarted', () => {
      console.log('Квиз перезапущен');
      setIsRestarting(false);
      socket.emit('join_room', { roomCode: code, userId: user.id, userName: user.name });
    });

    socket.on('error', (message) => {
      alert(message);
      navigate('/dashboard');
    });

    return () => {
      socket.off('players_update');
      socket.off('question');
      socket.off('game_started');
      socket.off('quiz_restarted');
      socket.off('error');
    };
  }, [socket, code, user.id, user.name, navigate]);

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('start_quiz', { roomCode: code });
  };

  const handleRestart = () => {
    if (!socket || !isCreator) return;
    if (!confirm('Перезапустить квиз? Очки будут сброшены.')) return;
    setIsRestarting(true);
    socket.emit('restart_quiz', { roomCode: code });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-h)' }}>
            Комната {code}
          </h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded text-sm"
            style={{ background: 'var(--code-bg)', color: 'var(--text)' }}
          >
            Выйти
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text)' }}>
          Отправь этот код друзьям
        </p>

        <div className="mb-6 p-4 rounded" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
            Участники ({players.length})
          </h2>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span style={{ color: 'var(--text-h)' }}>{p.name}</span>
                {p.id === user.id && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>
                    Вы
                  </span>
                )}
                {p.isCreator && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.2)', color: '#eab308' }}>
                    Организатор
                  </span>
                )}
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text)' }}>Ожидание игроков...</p>
            )}
          </div>
        </div>

        {isCreator && players.length > 0 && (
          <button
            onClick={handleStartGame}
            className="btn-primary w-full py-2 text-lg"
            disabled={isRestarting}
          >
            Начать игру
          </button>
        )}

        {isCreator && (
          <button
            onClick={handleRestart}
            className="w-full mt-2 py-2 rounded text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
            disabled={isRestarting || players.length === 0}
          >
            {isRestarting ? 'Перезапуск...' : 'Перезапустить квиз'}
          </button>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full mt-3 py-2 rounded text-sm"
          style={{ background: 'var(--code-bg)', color: 'var(--text)' }}
        >
          На главную
        </button>
      </div>
    </div>
  );
};

export default Lobby;