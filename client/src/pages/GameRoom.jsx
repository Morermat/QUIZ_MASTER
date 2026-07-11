import {useEffect,useState} from 'react';
import {useParams,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSocket} from '../context/SocketContext';

export default function GameRoom() {
  const {code}=useParams();
  const nav=useNavigate();
  const {user}=useAuth();
  const {socket,status}=useSocket();
  const [state,setState]=useState(null);
  const [selected,setSelected]=useState([]);
  const [result,setResult]=useState(null);
  const [error,setError]=useState('');
  const [now,setNow]=useState(()=>Date.now());
  const isOrganizer = state?.isOrganizer || false;

  useEffect(()=>{
    if(!socket) return;

    const onState = (d) => {
      if(d.roomCode !== code) return;
      setState(d);
      setSelected(d.selectedOptionIds || []);
      setResult(d.answerResult || null);
      setError('');
    };

    const onLeaderboard = (data) => {
      const board = data.players || data;
      nav(`/leaderboard/${code}`, { state: { leaderboard: board } });
    };

    const onFinished = () => {
      nav(`/leaderboard/${code}`);
    };

    socket.on('game_state', onState);
    socket.on('leaderboard', onLeaderboard);
    socket.on('quiz_finished', onFinished);

    socket.emit('join_room', { roomCode: code }, (r) => {
      if(r?.error) setError(r.error);
    });

    return () => {
      socket.off('game_state', onState);
      socket.off('leaderboard', onLeaderboard);
      socket.off('quiz_finished', onFinished);
      socket.emit('leave_room', { roomCode: code });
    };
  }, [socket, code, nav]);

  useEffect(()=>{
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const q = state?.currentQuestion;
  const timeLeft = state?.questionEndsAt
  ? Math.max(0, Math.ceil((state.questionEndsAt - now) / 1000))
  : (state?.timeLeft !== null && state?.timeLeft !== undefined ? state.timeLeft : '∞');
  const answered = state?.hasAnswered || !!result;

  const toggle = (id) => {
    if (answered) return;
    if (q.multiple) {
      setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
    } else {
      setSelected([id]);
    }
  };

  const submit = () => {
    socket.emit('submit_answer', {
      roomCode: code,
      questionId: q.id,
      optionIds: selected
    }, (r) => {
      if (r?.error) setError(r.error);
      else setResult(r.result);
    });
  };

  if (status !== 'connected') return <div className="p-8 text-center">Соединение с сервером: {status}</div>;
  if (!q) return <div className="p-8 text-center">Ожидание вопроса...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between mb-4">
        <span>{user.name}</span>
        <span>{timeLeft === '∞' ? '∞' : `${timeLeft} сек.`}</span>
      </div>
      {error && <div className="text-red-500 mb-3">{error}</div>}
      <div className="p-6 rounded border" style={{borderColor:'var(--border)',background:'var(--code-bg)'}}>
        <h2 className="text-2xl font-semibold mb-4">{q.text}</h2>
        {q.image_url && <img src={q.image_url} alt="К вопросу" className="max-h-80 mx-auto mb-4 rounded"/>}
        {q.multiple && <p className="mb-3 text-sm">Можно выбрать несколько вариантов</p>}
        <div className="grid gap-3">
          {q.options.map(o => (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              disabled={answered || timeLeft === 0}
              className="p-3 rounded border text-left"
              style={{
                background: selected.includes(String(o.id)) ? 'var(--accent)' : 'var(--bg)',
                color: selected.includes(String(o.id)) ? 'white' : 'var(--text-h)'
              }}
            >
              {o.text}
            </button>
          ))}
        </div>
        {!answered && (
          <button
            className="btn-primary w-full mt-4 py-2"
            disabled={!selected.length || timeLeft === 0}
            onClick={submit}
          >
            Ответить
          </button>
        )}
        {isOrganizer && timeLeft === '∞' && (
  <button
    className="btn-secondary w-full mt-4 py-2"
    onClick={() => socket.emit('next_question', { roomCode: code })}
  >
    Следующий вопрос
  </button>
)}
        {result && (
          <div className="mt-4">
            <b>{result.isCorrect ? 'Правильно' : 'Ответ принят'}</b> — {result.points} балла
          </div>
        )}
      </div>
    </div>
  );
}