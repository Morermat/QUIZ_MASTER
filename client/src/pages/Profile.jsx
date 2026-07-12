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
  const [winSettings, setWinSettings] = useState({});
  const [iconFile, setIconFile] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [displaySize, setDisplaySize] = useState('medium');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [musicStart, setMusicStart] = useState(0);
  const [musicEnd, setMusicEnd] = useState(0);

  const load = async () => {
    try {
      const r = await api.get('/profile');
      setData(r.data);
      setName(r.data.user.name || '');
      setAvatar(r.data.user.avatar_url || '');
      setWinIcon(r.data.user.win_icon || null);
      setWinMusic(r.data.user.win_music || null);
      const settings = r.data.user.win_settings || {};
      setWinSettings(settings);
      setStart(settings.start || 0);
      setEnd(settings.end || 0);
      setDisplaySize(settings.display_size || 'medium');
      setIsVideo(settings.iconType === 'video');
      setMusicStart(settings.musicStart || 0);
      setMusicEnd(settings.musicEnd || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось загрузить профиль');
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (type, file) => {
    if (!file) return;
    if (type === 'icon') {
      if (!['image/gif', 'image/png', 'image/webp', 'video/mp4'].includes(file.type)) {
        setError('Разрешены только GIF, PNG, WEBP, MP4');
        return;
      }
      setIsVideo(file.type.startsWith('video'));
      setIconFile(file);
    }
    if (type === 'music') {
      if (!['audio/mpeg', 'audio/ogg'].includes(file.type)) {
        setError('Разрешены только MP3, OGG');
        return;
      }
      setMusicFile(file);
    }
    setError('');
  };

  const uploadFiles = async () => {
    if (!iconFile && !musicFile) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    if (iconFile) formData.append('icon', iconFile);
    if (musicFile) formData.append('music', musicFile);
    if (isVideo) {
      formData.append('start', start);
      formData.append('end', end);
    }
    if (musicFile) {
      formData.append('musicStart', musicStart);
      formData.append('musicEnd', musicEnd);
    }
    formData.append('display_size', displaySize);
    try {
      const r = await api.post('/profile/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(r.data.user);
      setWinIcon(r.data.user.win_icon || null);
      setWinMusic(r.data.user.win_music || null);
      const settings = r.data.user.win_settings || {};
      setWinSettings(settings);
      setStart(settings.start || 0);
      setEnd(settings.end || 0);
      setDisplaySize(settings.display_size || 'medium');
      setIsVideo(settings.iconType === 'video');
      setMusicStart(settings.musicStart || 0);
      setMusicEnd(settings.musicEnd || 0);
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
      if (type === 'icon') {
        setWinIcon(null);
        setWinSettings({});
        setStart(0);
        setEnd(0);
        setIsVideo(false);
      } else {
        setWinMusic(null);
        setMusicStart(0);
        setMusicEnd(0);
      }
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
    <div className="max-w-5xl mx-auto p-6 animate-fade-in">
      <h1 className="text-3xl font-bold mb-6">Профиль</h1>
      {error && <p className="text-red-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-4 items-center mb-4">
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Игр', s.gamesPlayed], ['Побед', s.wins], ['Правильных', s.correctAnswers], ['Процент', `${s.correctPercent}%`]].map(([a, b]) => (
              <div className="p-4 border rounded text-center" key={a}>
                <b className="text-2xl">{b}</b>
                <div>{a}</div>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">История игр</h2>
            {s.history && s.history.length ? s.history.map((h, i) => (
              <div key={`${h.date}-${i}`} className="p-3 border-b">{h.quizTitle} — {h.score} балла, место {h.place}, {new Date(h.date).toLocaleString()}</div>
            )) : <p>История пока пустая</p>}
          </div>
        </div>

        <div className="border-l pl-6 space-y-4">
          <h2 className="text-xl font-bold">Что проигрывать при победе</h2>

          <div className="bg-[var(--code-bg)] p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2 flex items-center gap-2">Победная музыка</h3>
            <input type="file" accept=".mp3,.ogg" onChange={e => handleFileChange('music', e.target.files?.[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {musicFile && <span className="block text-sm text-green-600 mt-1">Выбран: {musicFile.name}</span>}
            {winMusic && (
              <div className="mt-2 flex items-center gap-3">
                <audio controls src={winMusic} className="max-w-xs" />
                <button onClick={() => resetFile('music')} className="text-red-500 text-sm hover:underline">Обнулить</button>
              </div>
            )}
            {(winMusic || musicFile) && (
              <div className="mt-3 border-t pt-3">
                <h4 className="font-medium">⏱Обрезка аудио (сек)</h4>
                <div className="flex gap-3 mt-1">
                  <div>
                    <label className="block text-sm">Начало</label>
                    <input type="number" min="0" value={musicStart} onChange={e => setMusicStart(parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded bg-[var(--bg)]" />
                  </div>
                  <div>
                    <label className="block text-sm">Конец</label>
                    <input type="number" min="0" value={musicEnd} onChange={e => setMusicEnd(parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded bg-[var(--bg)]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[var(--code-bg)] p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2 flex items-center gap-2">Победный медиа</h3>
            <input type="file" accept=".gif,.png,.webp,.mp4" onChange={e => handleFileChange('icon', e.target.files?.[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {iconFile && <span className="block text-sm text-green-600 mt-1">Выбран: {iconFile.name}</span>}
            {winIcon && (
              <div className="mt-2">
                {isVideo ? (
                  <video src={winIcon} controls className="max-w-full max-h-40 rounded" />
                ) : (
                  <img src={winIcon} alt="Иконка победы" className="max-w-full max-h-40 object-contain rounded" />
                )}
                <button onClick={() => resetFile('icon')} className="text-red-500 text-sm mt-1 hover:underline">Обнулить</button>
              </div>
            )}
          </div>

          {isVideo && winIcon && (
            <div className="bg-[var(--code-bg)] p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Обрезка видео</h3>
              <div className="flex gap-3">
                <div>
                  <label className="block text-sm">Начало (сек)</label>
                  <input type="number" min="0" value={start} onChange={e => setStart(parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded bg-[var(--bg)]" />
                </div>
                <div>
                  <label className="block text-sm">Конец (сек)</label>
                  <input type="number" min="0" value={end} onChange={e => setEnd(parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded bg-[var(--bg)]" />
                </div>
              </div>
            </div>
          )}

          {/* Размер отображения */}
          <div className="bg-[var(--code-bg)] p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Размер при победе</h3>
            <select value={displaySize} onChange={e => setDisplaySize(e.target.value)} className="px-3 py-2 border rounded bg-[var(--bg)]">
              <option value="small">Маленький (200px)</option>
              <option value="medium">Средний (300px)</option>
              <option value="large">Большой (400px)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <button className="btn-secondary w-full py-2" disabled={uploading || (!iconFile && !musicFile)} onClick={uploadFiles}>
              {uploading ? 'Загрузка...' : 'Загрузить файлы и настройки'}
            </button>
            <button className="btn-primary w-full py-2" disabled={saving} onClick={saveProfile}>
              {saving ? 'Сохранение...' : 'Сохранить профиль'}
            </button>
          </div>
        </div>
      </div>

      <button className="mt-6" onClick={() => navigate('/dashboard')}>← Назад</button>
    </div>
  );
}