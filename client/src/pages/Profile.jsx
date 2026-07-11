import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AVAILABLE_ICONS = ['default.gif', 'crown.gif', 'star.gif', 'fire.gif', 'diamond.gif', 'trophy.gif'];
const AVAILABLE_MUSICS = ['default.mp3', 'win1.mp3', 'win2.mp3', 'win3.mp3', 'epic.mp3'];

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [winIcon, setWinIcon] = useState('default.gif');
  const [winMusic, setWinMusic] = useState('default.mp3');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/profile');
      setData(r.data);
      setName(r.data.user.name);
      setAvatar(r.data.user.avatar_url || '');
      setWinIcon(r.data.user.win_icon || 'default.gif');
      setWinMusic(r.data.user.win_music || 'default.mp3');
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось загрузить профиль');
    }
  };

  useEffect(() => { load(); }, []);

  const file = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Выберите изображение');
    if (f.size > 1024 * 1024) return setError('Аватар должен быть меньше 1 МБ');
    const r = new FileReader();
    r.onload = () => setAvatar(String(r.result));
    r.readAsDataURL(f);
  };

  const playAudio = (music) => {
    if (audioPreview) {
      audioPreview.pause();
      setAudioPreview(null);
    }
    const audio = new Audio(`/audio/${music}`);
    setAudioPreview(audio);
    audio.play();
    setTimeout(() => {
      audio.pause();
      setAudioPreview(null);
    }, 5000);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await api.patch('/profile', { name, avatar_url: avatar, win_icon: winIcon, win_music: winMusic });
      setUser(r.data.user);
      sessionStorage.setItem('user', JSON.stringify(r.data.user));
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) return <div className="p-8"><p className="text-red-500">{error}</p><button onClick={() => navigate('/dashboard')}>Назад</button></div>;
  if (!data) return <div className="p-8">Загрузка...</div>;

  const s = data.stats;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Профиль</h1>
      {error && <p className="text-red-500">{error}</p>}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex gap-4 items-center mb-6">
            <img src={avatar} alt="Аватар" className="w-24 h-24 rounded-full object-cover" />
            <div>
              <input value={name} maxLength={40} onChange={e => setName(e.target.value)} className="px-3 py-2 border rounded bg-[var(--bg)] w-full" />
              <input type="file" accept="image/*" onChange={file} className="mt-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[['Игр', s.gamesPlayed], ['Побед', s.wins], ['Правильных', s.correctAnswers], ['Процент', `${s.correctPercent}%`]].map(([a, b]) => (
              <div className="p-4 border rounded text-center" key={a}>
                <b className="text-2xl">{b}</b>
                <div>{a}</div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold mb-2">История игр</h2>
          {s.history.length ? s.history.map((h, i) => (
            <div key={`${h.date}-${i}`} className="p-3 border-b">{h.quizTitle} — {h.score} балла, место {h.place}, {new Date(h.date).toLocaleString()}</div>
          )) : <p>История пока пустая</p>}
        </div>

        <div className="flex-1 border-l pl-6">
          <h2 className="text-xl font-bold mb-4">🏆 Победный стиль</h2>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">🎵 Победная музыка</h3>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_MUSICS.map(music => (
                <button
                  key={music}
                  onClick={() => playAudio(music)}
                  onDoubleClick={() => setWinMusic(music)}
                  className={`p-2 rounded border text-sm ${winMusic === music ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {music} {winMusic === music && '✓'}
                  <span className="block text-xs text-gray-500">(двойной клик для выбора)</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">🏅 Победная иконка</h3>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_ICONS.map(icon => (
                <div
                  key={icon}
                  onClick={() => setWinIcon(icon)}
                  className={`p-2 rounded border cursor-pointer text-center ${winIcon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <img src={`/icons/${icon}`} alt={icon} className="w-16 h-16 mx-auto object-contain" />
                  <span className="text-xs">{icon}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full py-2" disabled={saving} onClick={save}>
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>

      <button className="mt-6" onClick={() => navigate('/dashboard')}>Назад</button>
    </div>
  );
}