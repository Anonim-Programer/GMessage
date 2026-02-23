import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/auth/verify-email/${token}`)
      .then(() => { setStatus('success'); setTimeout(() => navigate('/'), 3000); })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
        {status === 'loading' && <><span className="spinner" style={{ margin: '0 auto' }} /><p style={{ marginTop: 16 }}>Подтверждаем...</p></>}
        {status === 'success' && <><div style={{ fontSize: 48 }}>✅</div><h2 style={{ marginTop: 12 }}>Email подтверждён!</h2><p style={{ color: 'var(--text-muted)' }}>Перенаправление...</p></>}
        {status === 'error' && <><div style={{ fontSize: 48 }}>❌</div><h2 style={{ marginTop: 12 }}>Ошибка</h2><p style={{ color: 'var(--text-muted)' }}>Ссылка недействительна</p></>}
      </div>
    </div>
  );
}
