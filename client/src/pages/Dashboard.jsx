import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    
    setUser(JSON.parse(userData));
    fetchQuizzes(token);
  }, [navigate]);

  const fetchQuizzes = async (token) => {
    try {
      const res = await axios.get('http://localhost:5000/quizzes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuizzes(res.data);
    } catch (err) {
      console.error('Ошибка загрузки квизов:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleCreateQuiz = () => {
    navigate('/create');
  };

  const handleJoinQuiz = (code) => {
    if (code && code.length === 6) {
      navigate(`/lobby/${code}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-xl" style={{ color: 'var(--text)' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-h)' }}>
            Привет, {user?.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Здесь ты можешь создавать квизы или присоединяться к играм
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded text-sm transition"
          style={{ background: 'var(--code-bg)', color: 'var(--text)' }}
        >
          Выйти
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Создание квиза */}
        <div className="rounded-lg p-6" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-h)' }}>
            Создать квиз
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
            Создай свой квиз и пригласи друзей
          </p>
          <button
            onClick={handleCreateQuiz}
            className="btn-primary w-full"
          >
            Создать
          </button>
        </div>

        {/* Присоединение */}
        <div className="rounded-lg p-6" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-h)' }}>
            Присоединиться
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
            Введи код комнаты и присоединись к игре
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Код комнаты"
              className="flex-1 px-4 py-2 rounded border bg-[var(--bg)] text-[var(--text-h)]"
              style={{ borderColor: 'var(--border)' }}
              maxLength={6}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                if (value.length <= 6) {
                  e.target.value = value;
                }
              }}
            />
            <button
              className="btn-primary"
              onClick={(e) => {
                const input = e.target.previousSibling;
                handleJoinQuiz(input.value);
              }}
            >
              Войти
            </button>
          </div>
        </div>
      </div>

      {/* Мои квизы */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
          Мои квизы
        </h2>
        {quizzes.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text)' }}>
            <p>У тебя пока нет созданных квизов</p>
            <p className="text-sm">Создай свой первый квиз!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex justify-between items-center p-4 rounded"
                style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}
              >
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--text-h)' }}>{quiz.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    Код: <code>{quiz.code}</code> • Статус: {quiz.status}
                  </p>
                </div>
                <button
                  className="px-4 py-1 rounded text-sm transition"
                  style={{ background: 'var(--accent)', color: 'white' }}
                  onClick={() => navigate(`/lobby/${quiz.code}`)}
                >
                  Открыть
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;