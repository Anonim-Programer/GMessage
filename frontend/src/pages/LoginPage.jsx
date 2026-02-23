import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [form, setForm] = useState({ emailOrUsername: '', password: '', twoFactorCode: '' });
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.emailOrUsername, form.password, form.twoFactorCode || undefined);
    if (result?.requiresTwoFactor) setRequiresTwoFactor(true);
    else if (result?.success) navigate('/');
  };

  return (
    <div style={{
      min-height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28
          }}>💬</div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>GMessage</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Войдите в свой аккаунт</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!requiresTwoFactor ? (
              <>
                <div className="input-group">
                  <label>Email или Username</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="user@example.com или username"
                    value={form.emailOrUsername}
                    onChange={e => setForm(f => ({ ...f, emailOrUsername: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Пароль</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введите пароль"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        fontSize: 16
                      }}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="input-group">
                <label>Код двухфакторной аутентификации</label>
                <input
                  className="input"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={form.twoFactorCode}
                  onChange={e => setForm(f => ({ ...f, twoFactorCode: e.target.value }))}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                />
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={isLoading}
              style={{ width: '100%', padding: '12px', marginTop: 8, fontSize: 15 }}
            >
              {isLoading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : 'Войти'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              to="/forgot-password"
              style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}
            >
              Забыли пароль?
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
          Нет аккаунта?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Зарегистрироваться
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
