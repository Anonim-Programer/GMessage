import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Пароли не совпадают');
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Пароль изменён!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h2 style={{ marginBottom: 20 }}>Новый пароль</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group"><label>Новый пароль</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
          <div className="input-group"><label>Подтвердите</label><input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
          <button className="btn btn-primary" style={{ width: '100%' }} type="submit">Сохранить</button>
        </form>
      </div>
    </div>
  );
}
