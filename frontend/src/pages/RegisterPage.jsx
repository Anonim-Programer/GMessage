import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', firstName: '', lastName: '' });
  const [confirm, setConfirm] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== confirm) return alert('Пароли не совпадают');
    const result = await register(form);
    if (result?.success) navigate('/');
  };

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>💬</div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>GMessage</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Создайте аккаунт</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="input-group" style={{ flex: 1 }}><label>Имя</label><input className="input" placeholder="Иван" {...f('firstName')} /></div>
              <div className="input-group" style={{ flex: 1 }}><label>Фамилия</label><input className="input" placeholder="Иванов" {...f('lastName')} /></div>
            </div>
            <div className="input-group"><label>Username *</label><input className="input" placeholder="ivanivanov" required {...f('username')} /></div>
            <div className="input-group"><label>Email *</label><input className="input" type="email" placeholder="ivan@example.com" required {...f('email')} /></div>
            <div className="input-group"><label>Пароль *</label><input className="input" type="password" placeholder="Минимум 8 символов" required {...f('password')} /></div>
            <div className="input-group"><label>Повторите пароль *</label><input className="input" type="password" placeholder="Повторите пароль" required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
            <button className="btn btn-primary" type="submit" disabled={isLoading} style={{ width: '100%', padding: 12, marginTop: 8, fontSize: 15 }}>
              {isLoading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Войти</Link>
        </p>
      </motion.div>
    </div>
  );
}
