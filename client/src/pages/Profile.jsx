import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [winIcon, setWinIcon] = useState(null);
  const [winMusic, setWinMusic] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/profile');
      setData(r.data);
      setName(r.data.user.name || '');
      setAvatar(r.data.user.avatar_url || '');
      setWinIcon(r.data.user.win_icon || null);
      setWinMusic(r.data.user.win_music || null);
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось загрузить профиль');
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (type, file) => {
    if (!file) return;
    if (type === 'icon' && !['image/gif', 'image/png', 'image/webp', 'video/mp4'].includes(file.type)) {
      setError('Разрешены только GIF, PNG, WEBP, MP4');
      return;
    }
    if (type === 'music' && !['audio/mpeg', 'audio/ogg'].includes(file.type)) {
      setError('Разрешены только MP3, OGG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Файл должен быть меньше 2 МБ');
      return;
    }
    if (type === 'icon') setIconFile(file);
    else setMusicFile(file);
    setError('');
  };

  const uploadFiles = async () => {
    if (!iconFile && !musicFile) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    if (iconFile) formData.append('icon', iconFile);
    if (musicFile) formData.append('music', musicFile);
    try {
      const r = await api.post('/profile/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(r.data.user);
      setWinIcon(r.data.user.win_icon || null);
      setWinMusic(r.data.user.win_music || null);
      setIconFile(null);
      setMusicFile(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const resetFile = async (type) => {
    try {
      const r = await api.delete(`/profile/upload?type=${type}`);
      setUser(r.data.user);
      if (type === 'icon') setWinIcon(null);
      else setWinMusic(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка удаления');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await api.patch('/profile', { name, avatar_url: avatar });
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

  const s = data.stats || { gamesPlayed: 0, wins: 0, correctAnswers: 0, correctPercent: 0, history: [] };

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
              <input type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setAvatar(reader.result);
                reader.readAsDataURL(f);
              }} className="mt-2" />
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
          {s.history && s.history.length ? s.history.map((h, i) => (
            <div key={`${h.date}-${i}`} className="p-3 border-b">{h.quizTitle} — {h.score} балла, место {h.place}, {new Date(h.date).toLocaleString()}</div>
          )) : <p>История пока пустая</p>}
        </div>

        <div className="flex-1 border-l pl-6">
          <h2 className="text-xl font-bold mb-4">Победный стиль</h2>

          <div className="mb-4">
            <h3 className="font-semibold mb-1">Победная музыка</h3>
            <input type="file" accept=".mp3,.ogg" onChange={e => handleFileChange('music', e.target.files?.[0])} />
            {musicFile && <span className="block text-sm text-green-600 mt-1">Выбран: {musicFile.name}</span>}
            {winMusic && (
              <div className="mt-2 flex items-center gap-3">
                <audio controls src={winMusic} className="max-w-xs" />
                <button onClick={() => resetFile('music')} className="text-red-500 text-sm">Обнулить</button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-1">Победная иконка</h3>
            <input type="file" accept=".gif,.png,.webp,.mp4" onChange={e => handleFileChange('icon', e.target.files?.[0])} />
            {iconFile && <span className="block text-sm text-green-600 mt-1">Выбран: {iconFile.name}</span>}
            {winIcon && (
              <div className="mt-2 flex items-center gap-3">
                <img src={winIcon} alt="Иконка победы" className="w-16 h-16 object-contain" />
                <button onClick={() => resetFile('icon')} className="text-red-500 text-sm">Обнулить</button>
              </div>
            )}
          </div>

          <button className="btn-secondary w-full py-2 mb-2" disabled={uploading || (!iconFile && !musicFile)} onClick={uploadFiles}>
            {uploading ? 'Загрузка...' : 'Загрузить файлы'}
          </button>

          <button className="btn-primary w-full py-2" disabled={saving} onClick={saveProfile}>
            {saving ? 'Сохранение...' : 'Сохранить профиль'}
          </button>
        </div>
      </div>

      <button className="mt-6" onClick={() => navigate('/dashboard')}>Назад</button>
    </div>
  );
}