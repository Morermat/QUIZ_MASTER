import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateQuiz from './pages/CreateQuiz';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import Leaderboard from './pages/Leaderboard';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <div id="root" className="min-h-screen">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create" element={<CreateQuiz />} />
              <Route path="/lobby/:code" element={<Lobby />} />
              <Route path="/game/:code" element={<GameRoom />} />
              <Route path="/leaderboard/:code" element={<Leaderboard />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;