import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Login = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAnonymousLogin = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите имя');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('http://localhost:5000/auth/anonymous', { name });
      localStorage.setItem('token', res.data.token);
      login(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Ошибка входа: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleVKLogin = () => {
    alert('VK вход в разработке');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8" style={{ color: 'var(--text-h)' }}>
          КвизМастер
        </h1>
        
        <div className="bg-[var(--code-bg)] rounded-lg p-6 shadow-[var(--shadow)]">
          <form onSubmit={handleAnonymousLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Введите имя
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full px-4 py-2 rounded border bg-[var(--bg)] text-[var(--text-h)]"
                style={{ borderColor: 'var(--border)' }}
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="mb-4 p-2 rounded text-sm" style={{ background: 'rgba(255,0,0,0.1)', color: '#ef4444' }}>
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full btn-primary py-2 text-lg"
              disabled={loading}
            >
              {loading ? 'Вход...' : 'Войти анонимно'}
            </button>
          </form>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border)' }}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2" style={{ background: 'var(--code-bg)', color: 'var(--text)' }}>
                Или
              </span>
            </div>
          </div>
          
          <button
            onClick={handleVKLogin}
            className="w-full py-2 rounded transition text-white font-medium"
            style={{ background: '#4a76a8' }}
          >
            Войти через VK ID
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;