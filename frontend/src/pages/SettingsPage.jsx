import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const [status, setStatus] = useState(user?.status || 'online');
  const navigate = useNavigate();

  const saveSettings = async () => {
    const { data } = await api.put('/users/me', { theme, status });
    updateUser(data.user);
    document.querySelector('.app-root')?.setAttribute('data-theme', theme);
    toast.success('Настройки сохранены');
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Назад</button>
        <h2 style={{ marginBottom: 24 }}>Настройки</h2>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Внешний вид</h3>
          <div className="input-group">
            <label>Тема</label>
            <select className="input" value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="dark">🌙 Тёмная</option>
              <option value="light">☀️ Светлая</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Статус</h3>
          <div className="input-group">
            <label>Ваш статус</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="online">🟢 В сети</option>
              <option value="away">🟡 Отошёл</option>
              <option value="dnd">🔴 Не беспокоить</option>
              <option value="offline">⚫ Невидимый</option>
            </select>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16 }} onClick={saveSettings}>Сохранить настройки</button>

        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Опасная зона</h3>
          <button className="btn btn-danger" onClick={() => { logout(); navigate('/login'); }}>Выйти из аккаунта</button>
        </div>
      </div>
    </div>
  );
}
