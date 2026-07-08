import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CreateQuiz = () => {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { text: '', options: ['', '', '', ''], correct: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', '', '', ''], correct: 0 }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index, value) => {
    const updated = [...questions];
    updated[index].text = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const setCorrectAnswer = (qIndex, oIndex) => {
    const updated = [...questions];
    updated[qIndex].correct = oIndex;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Введите название квиза');
      return;
    }

    for (let q of questions) {
      if (!q.text.trim()) {
        setError('Все вопросы должны быть заполнены');
        return;
      }
      for (let opt of q.options) {
        if (!opt.trim()) {
          setError('Все варианты ответов должны быть заполнены');
          return;
        }
      }
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        'http://localhost:5000/quizzes',
        { title, questions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      localStorage.setItem('currentQuiz', JSON.stringify({
        id: res.data.id,
        title: title,
        questions: questions.map(q => ({
          id: Date.now() + Math.random(),
          text: q.text,
          options: q.options.map((opt, idx) => ({
            id: Date.now() + Math.random() + idx,
            text: opt,
            is_correct: idx === q.correct
          }))
        }))
      }));

      navigate(`/lobby/${res.data.code}`);
    } catch (err) {
      setError('Ошибка при создании квиза: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--text-h)' }}>
        Создание квиза
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded text-sm" style={{ background: 'rgba(255,0,0,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            Название квиза
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите название"
            className="w-full px-4 py-2 rounded border bg-[var(--bg)] text-[var(--text-h)]"
            style={{ borderColor: 'var(--border)' }}
            disabled={loading}
          />
        </div>

        {questions.map((q, qIndex) => (
          <div key={qIndex} className="mb-6 p-4 rounded" style={{ background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium" style={{ color: 'var(--text-h)' }}>
                Вопрос {qIndex + 1}
              </h3>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="text-sm px-3 py-1 rounded"
                  style={{ background: 'rgba(255,0,0,0.1)', color: '#ef4444' }}
                >
                  Удалить
                </button>
              )}
            </div>

            <input
              type="text"
              value={q.text}
              onChange={(e) => updateQuestion(qIndex, e.target.value)}
              placeholder="Введите вопрос"
              className="w-full px-4 py-2 rounded border bg-[var(--bg)] text-[var(--text-h)] mb-3"
              style={{ borderColor: 'var(--border)' }}
              disabled={loading}
            />

            <div className="space-y-2">
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={q.correct === oIndex}
                    onChange={() => setCorrectAnswer(qIndex, oIndex)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    placeholder={`Вариант ${oIndex + 1}`}
                    className="flex-1 px-4 py-2 rounded border bg-[var(--bg)] text-[var(--text-h)]"
                    style={{ borderColor: 'var(--border)' }}
                    disabled={loading}
                  />
                  {q.correct === oIndex && (
                    <span className="text-sm" style={{ color: '#22c55e' }}>Правильный</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addQuestion}
            className="btn-secondary px-6 py-2"
            disabled={loading}
          >
            Добавить вопрос
          </button>
          <button
            type="submit"
            className="btn-primary px-6 py-2"
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить квиз'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 rounded"
            style={{ background: 'var(--code-bg)', color: 'var(--text)' }}
            disabled={loading}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;