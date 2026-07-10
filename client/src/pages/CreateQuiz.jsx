import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const blankQuestion = (timeLimit = 30) => ({ text: '', image_url: '', options: ['', '', '', ''], correct: [0], multiple: false, timeLimit });

export default function CreateQuiz() {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [timeLimit, setTimeLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const patchQ = (i, patch) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const imageToDataUrl = (file, i) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Можно загружать только изображения');
    if (file.size > 2 * 1024 * 1024) return setError('Изображение должно быть меньше 2 МБ');
    const reader = new FileReader(); reader.onload = () => patchQ(i, { image_url: reader.result }); reader.readAsDataURL(file);
  };
  const toggleCorrect = (qi, oi) => {
    const q = questions[qi];
    if (!q.multiple) return patchQ(qi, { correct: [oi] });
    const next = q.correct.includes(oi) ? q.correct.filter(x => x !== oi) : [...q.correct, oi];
    patchQ(qi, { correct: next });
  };

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!title.trim()) return setError('Введите название квиза');
    for (const q of questions) {
      if (!q.text.trim() || q.options.some(o => !o.trim())) return setError('Заполните вопросы и все варианты ответов');
      if (!q.correct.length) return setError('У каждого вопроса должен быть правильный ответ');
    }
    setLoading(true);
    try {
      const formatted = questions.map((q, qi) => ({
        id: `${Date.now()}-${qi}`,
        text: q.text.trim(), image_url: q.image_url || null, multiple: q.multiple,
        timeLimit: Number(q.timeLimit) || timeLimit,
        options: q.options.map((text, oi) => ({ id: `${Date.now()}-${qi}-${oi}`, text: text.trim(), is_correct: q.correct.includes(oi) }))
      }));
      const { data } = await api.post('/quizzes', { title, questions: formatted, timeLimit });
      navigate(`/lobby/${data.code}`);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  };

  return <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
    <h1 className="text-3xl font-bold mb-6">Создание квиза</h1>
    {error && <div className="mb-4 p-3 rounded border border-red-500 text-red-500">{error}</div>}
    <form onSubmit={submit}>
      <input className="w-full px-4 py-2 rounded border bg-[var(--bg)] mb-4" placeholder="Название квиза" value={title} onChange={e=>setTitle(e.target.value)} />
      <label className="block mb-4">Таймер по умолчанию, сек.
        <input type="number" min="5" max="300" className="ml-3 px-3 py-2 rounded border bg-[var(--bg)]" value={timeLimit} onChange={e=>setTimeLimit(Number(e.target.value)||30)} />
      </label>
      {questions.map((q, qi) => <div key={qi} className="mb-6 p-4 rounded border" style={{borderColor:'var(--border)',background:'var(--code-bg)'}}>
        <div className="flex justify-between gap-3 mb-3"><b>Вопрос {qi+1}</b><button type="button" onClick={()=>setQuestions(v=>v.filter((_,i)=>i!==qi))} disabled={questions.length===1}>Удалить</button></div>
        <input className="w-full px-4 py-2 rounded border bg-[var(--bg)] mb-3" placeholder="Текст вопроса" value={q.text} onChange={e=>patchQ(qi,{text:e.target.value})}/>
        <div className="mb-3">
          <input type="file" accept="image/*" onChange={e=>imageToDataUrl(e.target.files?.[0],qi)}/>
          {q.image_url && <div><img src={q.image_url} alt="Предпросмотр" className="mt-2 max-h-48 rounded"/><button type="button" onClick={()=>patchQ(qi,{image_url:''})}>Убрать картинку</button></div>}
        </div>
        <label className="block mb-3"><input type="checkbox" checked={q.multiple} onChange={e=>patchQ(qi,{multiple:e.target.checked,correct:q.correct.slice(0,e.target.checked?undefined:1)})}/> Множественный выбор</label>
        {q.options.map((opt,oi)=><div key={oi} className="flex gap-2 mb-2 items-center">
          <input type={q.multiple?'checkbox':'radio'} name={`correct-${qi}`} checked={q.correct.includes(oi)} onChange={()=>toggleCorrect(qi,oi)}/>
          <input className="flex-1 px-4 py-2 rounded border bg-[var(--bg)]" placeholder={`Вариант ${oi+1}`} value={opt} onChange={e=>patchQ(qi,{options:q.options.map((x,i)=>i===oi?e.target.value:x)})}/>
        </div>)}
        <label>Таймер: <input type="number" min="5" max="300" className="w-24 px-2 py-1 rounded border bg-[var(--bg)]" value={q.timeLimit} onChange={e=>patchQ(qi,{timeLimit:Number(e.target.value)||timeLimit})}/></label>
      </div>)}
      <div className="flex gap-3 flex-wrap"><button type="button" className="btn-secondary px-5 py-2" onClick={()=>setQuestions(v=>[...v,blankQuestion(timeLimit)])}>Добавить вопрос</button><button className="btn-primary px-5 py-2" disabled={loading}>{loading?'Сохранение...':'Сохранить квиз'}</button><button type="button" onClick={()=>navigate('/dashboard')}>Отмена</button></div>
    </form>
  </div>;
}
