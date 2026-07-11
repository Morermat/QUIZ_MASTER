import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function VKCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    const deviceId = searchParams.get('device_id');

    if (code) {
      api.post('/auth/vk', { code, device_id })
        .then(res => {
          login(res.data.user, res.data.token);
          navigate('/dashboard');
        })
        .catch(err => {
          console.error('VK callback error:', err);
          navigate('/login', { state: { error: 'Ошибка авторизации через VK' } });
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return <div>Загрузка...</div>;
}