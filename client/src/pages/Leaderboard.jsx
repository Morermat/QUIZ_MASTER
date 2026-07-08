import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Leaderboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const leaderboard = location.state?.leaderboard || [];

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <h1 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--text-h)' }}>
        Лидерборд
      </h1>
      {leaderboard.length === 0 ? (
        <p className="text-lg" style={{ color: 'var(--text)' }}>Нет результатов</p>
      ) : (
        <table className="w-full max-w-md border-collapse">
          <thead>
            <tr>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Место</th>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Игрок</th>
              <th className="border p-2" style={{ borderColor: 'var(--border)' }}>Очки</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((item, index) => (
              <tr key={item.user_id} style={{ background: item.user_id === user.id ? 'rgba(170,59,255,0.2)' : 'transparent' }}>
                <td className="border p-2 text-center" style={{ borderColor: 'var(--border)' }}>{index + 1}</td>
                <td className="border p-2" style={{ borderColor: 'var(--border)' }}>{item.name || 'Игрок'}</td>
                <td className="border p-2 text-center" style={{ borderColor: 'var(--border)' }}>{item.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        onClick={() => navigate('/dashboard')}
        className="btn-primary mt-6 px-6 py-2"
      >
        На главную
      </button>
    </div>
  );
};

export default Leaderboard;