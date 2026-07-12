import { useEffect, useState, useMemo, useRef } from 'react';
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
  const fileInputRef = useRef(null);

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

  const exportJSON = (quiz) => {
    api.get(`/quizzes/${quiz.id}`).then(res => {
      const data = res.data;
      const exportData = {
        version: '1.0',
        title: data.title,
        timeLimit: data.timeLimit,
        questions: data.questions.map(q => ({
          text: q.text,
          image_url: q.image_url || null,
          multiple: q.multiple || false,
          timeLimit: q.timeLimit,
          scoringType: q.scoringType || 'exact',
          options: q.options.map(o => ({
            text: o.text,
            is_correct: o.is_correct
          }))
        }))
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title}.quiz.json`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(err => setError('Ошибка экспорта: ' + err.message));
  };

  const importQuiz = async (file) => {
    try {
      if (!file.name.endsWith('.json')) {
        throw new Error('Поддерживается только формат JSON');
      }
      const text = await file.text();
      const parsedData = JSON.parse(text);
      if (!parsedData.title || !parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
        throw new Error('Неверный формат файла');
      }
      const res = await api.post('/quizzes', {
        title: parsedData.title,
        timeLimit: parsedData.timeLimit !== undefined ? parsedData.timeLimit : null,
        questions: parsedData.questions.map(q => ({
          text: q.text,
          image_url: q.image_url || null,
          multiple: q.multiple || false,
          timeLimit: q.timeLimit !== undefined ? q.timeLimit : null,
          scoringType: q.scoringType || 'exact',
          options: q.options.map(o => ({
            text: o.text,
            is_correct: o.is_correct || false
          }))
        }))
      });
      setQuizzes(prev => [...prev, { ...res.data, questionCount: parsedData.questions.length }]);
      alert('Квиз успешно импортирован!');
    } catch (e) {
      setError('Ошибка импорта: ' + e.message);
    }
  };

  if (loading) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="flex-1 p-4 md:p-8 animate-fade-in">
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
        <div className="rounded-lg p-6 border animate-float">
          <h2>Создать квиз</h2>
          <button className="btn-primary w-full mt-2" onClick={() => navigate('/create')}>Создать</button>
        </div>
        <div className="rounded-lg p-6 border animate-float">
          <h2>Присоединиться</h2>
          <div className="flex gap-2 mt-2">
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
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2>Мои квизы</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-4 py-2 rounded border bg-[var(--bg)] w-48"
            />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Импорт JSON
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={e => {
                if (e.target.files?.[0]) {
                  importQuiz(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
        {filteredQuizzes.length === 0 ? (
          <p>{searchQuery ? 'Ничего не найдено' : 'У тебя пока нет созданных квизов'}</p>
        ) : (
          filteredQuizzes.map(q => (
            <div key={q.id} className="flex justify-between items-center p-4 border rounded mt-2 flex-wrap gap-2">
              <div>
                <b>{q.title}</b>
                <div>Код: <code>{q.code}</code> · Вопросов: {q.questionCount}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-secondary text-sm" onClick={() => navigate(`/lobby/${q.code}`)}>Открыть</button>
                <button className="btn-secondary text-sm" onClick={() => exportJSON(q)}>JSON</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}