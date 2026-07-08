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

  useEffect(() => {
    if (!socket) return;

    socket.emit('join_room', { roomCode: code, userId: user.id });

    socket.on('players_update', (data) => {
      setPlayers(data);
      const currentPlayer = data.find(p => p.id === user.id);
      if (currentPlayer) {
        setIsCreator(currentPlayer.isCreator || false);
      }
    });

    socket.on('question', (data) => {
      console.log('Получен вопрос в Lobby, переходим в игру:', data);
      navigate(`/game/${code}`, { state: { question: data } });
    });

    socket.on('game_started', () => {
      console.log('Получен game_started, но вопрос уже должен быть обработан');
    });

    return () => {
      socket.off('players_update');
      socket.off('question');
      socket.off('game_started');
    };
  }, [socket, code, user.id, navigate]);

  const handleStartGame = () => {
    if (!socket) return;

    const storedQuiz = JSON.parse(localStorage.getItem('currentQuiz') || '{}');
    const questions = storedQuiz.questions || [];
    console.log('Отправка start_quiz:', { roomCode: code, questions });

    socket.emit('start_quiz', {
      roomCode: code,
      questions: questions
    });
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
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
          Отправь этот код друзьям, чтобы они присоединились
        </p>

        <div className="mb-6 p-4 rounded" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
            Участники ({players.length})
          </h2>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <img
                  src={p.avatar_url || 'https://ui-avatars.com/api/?name=' + p.name}
                  alt={p.name}
                  className="w-8 h-8 rounded-full"
                />
                <span style={{ color: 'var(--text-h)' }}>{p.name}</span>
                {p.id === user.id && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>
                    Вы
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
          >
            Начать игру
          </button>
        )}

        {isCreator && players.length === 0 && (
          <p className="text-sm text-center" style={{ color: 'var(--text)' }}>
            Подождите, пока кто-нибудь присоединится
          </p>
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