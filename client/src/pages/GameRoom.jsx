import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const GameRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.emit('join_room', { roomCode: code, userId: user.id });

    newSocket.on('players_update', (data) => {
      const currentUser = data.find(p => p.id === user.id);
      if (currentUser) {
        setIsCreator(data.length > 0 && data[0].id === user.id);
      }
    });

    newSocket.on('question', (data) => {
  console.log('Получен вопрос в GameRoom:', data);
  setQuestion(data);
  setSelectedOption(null);
  setResult(null);
});

    newSocket.on('answer_result', (data) => {
      setResult(data);
    });

    newSocket.on('leaderboard', (data) => {
      navigate(`/leaderboard/${code}`, { state: { leaderboard: data } });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [code, user.id, navigate]);

  const handleAnswer = (optionId) => {
    if (selectedOption || !socket || !question) return;
    setSelectedOption(optionId);
    socket.emit('submit_answer', {
      roomCode: code,
      userId: user.id,
      questionId: question.id,
      optionId: optionId
    });
  };

  const handleNextQuestion = () => {
    if (socket) {
      socket.emit('next_question', { roomCode: code });
    }
  };

  if (!question) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-xl" style={{ color: 'var(--text)' }}>Ожидание вопроса...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex justify-between items-center">
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            Комната {code}
          </span>
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            {user.name}
          </span>
        </div>

        <div className="mb-6 p-6 rounded-lg" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            {question.text}
          </h2>

          <div className="space-y-3">
            {question.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              let buttonStyle = {};

              if (result && isSelected) {
                buttonStyle = opt.is_correct 
                  ? { background: '#22c55e', color: 'white' }
                  : { background: '#ef4444', color: 'white' };
              } else if (result && opt.is_correct) {
                buttonStyle = { background: '#22c55e', color: 'white' };
              } else if (isSelected) {
                buttonStyle = { background: 'var(--accent)', color: 'white' };
              } else {
                buttonStyle = { background: 'var(--bg)', color: 'var(--text-h)', border: '1px solid var(--border)' };
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(opt.id)}
                  disabled={!!selectedOption}
                  className="w-full px-4 py-3 rounded text-left transition"
                  style={buttonStyle}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>

          {result && (
            <div className="mt-4 p-3 rounded" style={{ background: result.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (result.isCorrect ? '#22c55e' : '#ef4444') }}>
              <p className="font-medium" style={{ color: result.isCorrect ? '#22c55e' : '#ef4444' }}>
                {result.isCorrect ? 'Правильно' : 'Неправильно'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{result.prediction}</p>
            </div>
          )}
        </div>

        {isCreator && result && (
          <button
            onClick={handleNextQuestion}
            className="btn-primary w-full py-2"
          >
            Следующий вопрос
          </button>
        )}

        {!isCreator && result && (
          <p className="text-center text-sm" style={{ color: 'var(--text)' }}>
            Ожидайте следующего вопроса
          </p>
        )}
      </div>
    </div>
  );
};

export default GameRoom;