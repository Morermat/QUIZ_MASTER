import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const GameRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const socket = useSocket();
  const [question, setQuestion] = useState(location.state?.question || null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join_room', { roomCode: code, userId: user.id, userName: user.name });

    socket.on('game_state', (data) => {
      console.log('Восстановление состояния:', data);
      setIsCreator(data.isCreator);
      if (data.currentQuestion) {
        setQuestion(data.currentQuestion);
        setSelectedOption(null);
        setResult(null);
        setIsAnswered(false);
        setTimeLeft(data.timeLeft);
        if (data.timeLeft > 0) {
          startTimer(data.timeLeft);
        }
      } else {
        setQuestion(null);
      }
    });

    socket.on('question', (data) => {
      console.log('Новый вопрос:', data);
      setQuestion(data.question);
      setSelectedOption(null);
      setResult(null);
      setIsAnswered(false);
      const limit = data.timeLimit || 30;
      setTimeLeft(limit);
      startTimer(limit);
    });

    socket.on('answer_result', (data) => {
      setResult({ isCorrect: data.isCorrect });
      setIsAnswered(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
    });

    socket.on('players_update', (data) => {
      const currentUser = data.find(p => p.id === user.id);
      if (currentUser) {
        setIsCreator(currentUser.isCreator || false);
      }
    });

    socket.on('leaderboard', (data) => {
      navigate(`/leaderboard/${code}`, { state: data });
    });

    socket.on('quiz_finished', () => {
      navigate(`/leaderboard/${code}`);
    });

    socket.on('error', (message) => {
      alert(message);
      navigate('/dashboard');
    });

    return () => {
      socket.off('game_state');
      socket.off('question');
      socket.off('answer_result');
      socket.off('players_update');
      socket.off('leaderboard');
      socket.off('quiz_finished');
      socket.off('error');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, code, user.id, user.name, navigate]);

  const startTimer = (duration) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (optionId) => {
    if (isAnswered || !socket || !question) return;
    setSelectedOption(optionId);
    socket.emit('submit_answer', {
      roomCode: code,
      userId: user.id,
      questionId: question.id,
      optionId: optionId
    });
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
            {user.name} {timeLeft !== null && timeLeft > 0 && `| Осталось: ${timeLeft}с`}
            {timeLeft === 0 && '| Время вышло'}
          </span>
        </div>

        <div className="mb-6 p-6 rounded-lg" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            {question.text}
          </h2>

          <div className="space-y-3">
            {question.options && question.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              let buttonStyle = {};

              if (isAnswered && isSelected) {
                buttonStyle = opt.is_correct 
                  ? { background: '#22c55e', color: 'white' }
                  : { background: '#ef4444', color: 'white' };
              } else if (isAnswered && opt.is_correct) {
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
                  disabled={isAnswered || timeLeft === 0}
                  className="w-full px-4 py-3 rounded text-left transition"
                  style={buttonStyle}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>

          {timeLeft === 0 && !isAnswered && (
            <div className="mt-4 p-3 rounded" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444' }}>
              <p className="text-sm" style={{ color: '#ef4444' }}>Время вышло</p>
            </div>
          )}

          {result && (
            <div className="mt-4 p-3 rounded" style={{ background: result.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (result.isCorrect ? '#22c55e' : '#ef4444') }}>
              <p className="font-medium" style={{ color: result.isCorrect ? '#22c55e' : '#ef4444' }}>
                {result.isCorrect ? 'Правильно' : 'Неправильно'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameRoom;