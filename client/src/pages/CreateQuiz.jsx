import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

const blankQuestion = (timeLimit = 30) => ({
  text: '',
  image_url: '',
  options: ['', '', '', ''],
  correct: [0],
  multiple: false,
  timeLimit,
  scoringType: 'exact'
});

function QuestionContent({ question, index, isDragOverlay = false }) {
  return (
    <div className={`p-4 rounded border ${isDragOverlay ? 'shadow-lg opacity-90' : ''}`} style={{borderColor:'var(--border)', background: isDragOverlay ? 'var(--bg)' : 'var(--code-bg)'}}>
      <div className="flex justify-between items-center gap-3 mb-3">
        <b>Вопрос {index + 1}</b>
        <span className="text-gray-400">⠿</span>
      </div>
      <div className="font-medium">{question.text || '(пустой вопрос)'}</div>
      <div className="text-sm text-gray-500 mt-1">
        {question.options.filter(o => o).length} вариантов
        {question.multiple && ' · Множественный выбор'}
        {question.scoringType && ` · ${question.scoringType}`}
      </div>
    </div>
  );
}

function SortableQuestion({ question, index, onUpdate, onDelete, timeLimit, isOnly, isOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
  };

  const patchQ = (patch) => onUpdate(index, patch);

  const toggleCorrect = (oi) => {
    const q = question;
    if (!q.multiple) return patchQ({ correct: [oi] });
    const next = q.correct.includes(oi) ? q.correct.filter(x => x !== oi) : [...q.correct, oi];
    patchQ({ correct: next });
  };

  const handleOptionChange = (oi, value) => {
    const newOptions = [...question.options];
    newOptions[oi] = value;
    patchQ({ options: newOptions });
  };

  const addOption = () => {
    if (question.options.length < 8) {
      patchQ({ options: [...question.options, ''] });
    }
  };

  const removeOption = (oi) => {
    if (question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== oi);
      const newCorrect = question.correct.filter(c => c !== oi).map(c => c > oi ? c - 1 : c);
      patchQ({ options: newOptions, correct: newCorrect });
    }
  };

  if (isOverlay) {
    return <QuestionContent question={question} index={index} isDragOverlay />;
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4 p-4 rounded border" style={{borderColor: isDragging ? 'var(--accent)' : 'var(--border)', background:'var(--code-bg)'}}>
      <div className="flex justify-between items-center gap-3 mb-3">
        <b>Вопрос {index + 1}</b>
        <div className="flex gap-2">
          <button type="button" onClick={() => onDelete(index)} disabled={isOnly}>Удалить</button>
          <span {...attributes} {...listeners} className="cursor-grab text-gray-400 select-none" style={{ fontSize: '20px', padding: '0 4px' }}>
            ⠿
          </span>
        </div>
      </div>
      <input
        className="w-full px-4 py-2 rounded border bg-[var(--bg)] mb-3"
        placeholder="Текст вопроса"
        value={question.text}
        onChange={e => patchQ({ text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="mb-3">
        <input type="file" accept="image/*" onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) return;
          if (file.size > 2 * 1024 * 1024) return;
          const reader = new FileReader();
          reader.onload = () => patchQ({ image_url: reader.result });
          reader.readAsDataURL(file);
        }} />
        {question.image_url && <div className="mt-2">
          <img src={question.image_url} alt="Предпросмотр" className="max-h-48 rounded" />
          <button type="button" onClick={() => patchQ({ image_url: '' })} className="text-sm text-red-500">Убрать</button>
        </div>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={question.multiple} onChange={e => patchQ({ multiple: e.target.checked, correct: e.target.checked ? question.correct : (question.correct.length > 0 ? [question.correct[0]] : []) })} />
          Множественный выбор
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm">Система баллов:</span>
          <select
            value={question.scoringType || 'exact'}
            onChange={e => patchQ({ scoringType: e.target.value })}
            className="px-2 py-1 rounded border bg-[var(--bg)] text-sm"
          >
            <option value="exact">Точный набор ответов</option>
            <option value="partial">Частичное начисление (штрафы)</option>
            <option value="perCorrect">За каждый правильный</option>
          </select>
        </div>
      </div>
      <div className="space-y-2 mb-2">
        {question.options.map((opt, oi) => (
          <div key={oi} className="flex gap-2 items-center">
            <input
              type={question.multiple ? 'checkbox' : 'radio'}
              name={`correct-${index}`}
              checked={question.correct.includes(oi)}
              onChange={() => toggleCorrect(oi)}
            />
            <input
              className="flex-1 px-4 py-2 rounded border bg-[var(--bg)]"
              placeholder={`Вариант ${oi + 1}`}
              value={opt}
              onChange={e => handleOptionChange(oi, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => removeOption(oi)}
              className="text-red-500 hover:text-red-700 disabled:opacity-40"
              disabled={question.options.length <= 2}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={addOption}
          className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-40"
          disabled={question.options.length >= 8}
        >
          + Добавить вариант
        </button>
        <span className="text-xs text-gray-400">({question.options.length}/8)</span>
      </div>
      <label className="text-sm">Таймер: <input type="number" min="5" max="300" className="w-20 px-2 py-1 rounded border bg-[var(--bg)]" value={question.timeLimit} onChange={e => patchQ({ timeLimit: Number(e.target.value) || timeLimit })} onPointerDown={(e) => e.stopPropagation()} /></label>
    </div>
  );
}

export default function CreateQuiz() {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([{ ...blankQuestion(), id: Date.now() }]);
  const [timeLimit, setTimeLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      setQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const addQuestion = () => {
    setQuestions([...questions, { ...blankQuestion(timeLimit), id: Date.now() + Math.random() }]);
  };

  const deleteQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index, patch) => {
    setQuestions(qs => qs.map((q, i) => i === index ? { ...q, ...patch } : q));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Введите название квиза');
    for (const q of questions) {
      if (!q.text.trim() || q.options.some(o => !o.trim())) return setError('Заполните вопросы и все варианты ответов');
      if (!q.correct.length) return setError('У каждого вопроса должен быть правильный ответ');
    }
    setLoading(true);
    try {
      const formatted = questions.map((q, qi) => ({
        id: `${Date.now()}-${qi}`,
        text: q.text.trim(),
        image_url: q.image_url || null,
        multiple: q.multiple,
        timeLimit: Number(q.timeLimit) || timeLimit,
        scoringType: q.scoringType || 'exact',
        options: q.options.map((text, oi) => ({
          id: `${Date.now()}-${qi}-${oi}`,
          text: text.trim(),
          is_correct: q.correct.includes(oi)
        }))
      }));
      const { data } = await api.post('/quizzes', { title, questions: formatted, timeLimit });
      navigate(`/lobby/${data.code}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeQuestion = activeId ? questions.find(q => q.id === activeId) : null;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Создание квиза</h1>
      {error && <div className="mb-4 p-3 rounded border border-red-500 text-red-500">{error}</div>}
      <form onSubmit={submit}>
        <input className="w-full px-4 py-2 rounded border bg-[var(--bg)] mb-4" placeholder="Название квиза" value={title} onChange={e => setTitle(e.target.value)} />
        <label className="block mb-4">Таймер по умолчанию, сек.
          <input type="number" min="5" max="300" className="ml-3 px-3 py-2 rounded border bg-[var(--bg)]" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value) || 30)} />
        </label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map((q, index) => (
              <SortableQuestion
                key={q.id}
                question={q}
                index={index}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                timeLimit={timeLimit}
                isOnly={questions.length === 1}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeQuestion ? (
              <QuestionContent question={activeQuestion} index={questions.findIndex(q => q.id === activeQuestion.id)} isDragOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
        <div className="flex gap-3 flex-wrap">
          <button type="button" className="btn-secondary px-5 py-2" onClick={addQuestion}>Добавить вопрос</button>
          <button className="btn-primary px-5 py-2" disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить квиз'}</button>
          <button type="button" onClick={() => navigate('/dashboard')}>Отмена</button>
        </div>
      </form>
    </div>
  );
}