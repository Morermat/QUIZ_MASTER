import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await api.get('/quizzes');
        if (live) setQuizzes(res.data);
      } catch (e) {
        if (live) setError(e.response?.data?.error || 'Не удалось загрузить квизы');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const filteredQuizzes = useMemo(() => {
    if (!searchQuery.trim()) return quizzes;
    const query = searchQuery.toLowerCase().trim();
    return quizzes.filter(q => q.title.toLowerCase().includes(query));
  }, [quizzes, searchQuery]);

  const join = () => {
    /^\d{6}$/.test(code) ? navigate(`/lobby/${code}`) : setError('Введите шестизначный код комнаты');
  };

  if (loading) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Привет, {user?.name}</h1>
          <p>Создавай квизы или присоединяйся к играм</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/profile')}>Профиль</button>
          <button onClick={() => { logout(); navigate('/login'); }}>Выйти</button>
        </div>
      </div>

      {error && <div className="mb-4 text-red-500">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg p-6 border">
          <h2>Создать квиз</h2>
          <button className="btn-primary w-full" onClick={() => navigate('/create')}>Создать</button>
        </div>
        <div className="rounded-lg p-6 border">
          <h2>Присоединиться</h2>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="flex-1 px-4 py-2 rounded border bg-[var(--bg)]"
              placeholder="Код комнаты"
              inputMode="numeric"
            />
            <button className="btn-primary" onClick={join}>Войти</button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2>Мои квизы</h2>
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 rounded border bg-[var(--bg)] w-64"
          />
        </div>
        {filteredQuizzes.length === 0 ? (
          <p>{searchQuery ? 'Ничего не найдено' : 'У тебя пока нет созданных квизов'}</p>
        ) : (
          filteredQuizzes.map(q => (
            <div key={q.id} className="flex justify-between p-4 border rounded mt-2">
              <div>
                <b>{q.title}</b>
                <div>Код: <code>{q.code}</code> · Вопросов: {q.questionCount}</div>
              </div>
              <button onClick={() => navigate(`/lobby/${q.code}`)}>Открыть</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}