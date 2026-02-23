import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../common/Avatar';

export default function SearchUsersModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { createPersonalChat } = useChatStore();
  const navigate = useNavigate();

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) return setUsers([]);
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setUsers(data.users);
    } finally { setLoading(false); }
  };

  const openChat = async (userId) => {
    const chatId = await createPersonalChat(userId);
    navigate(`/chat/${chatId}`);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 16 }}>Найти пользователя</h3>
        <input className="input" autoFocus placeholder="Введите username или имя..." value={query} onChange={e => search(e.target.value)} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>}
          {users.map(u => (
            <div key={u.id} onClick={() => openChat(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--border)' }}>
              <Avatar src={u.avatar_url} name={u.username} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{u.first_name || ''} {u.last_name || ''} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>@{u.username}</span></div>
                <div style={{ fontSize: 12, color: 'var(--accent)' }}>{u.reputation_level}</div>
              </div>
              <div className={`status-dot ${u.status}`} />
            </div>
          ))}
          {!loading && query.length >= 2 && users.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Пользователи не найдены</div>}
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Закрыть</button>
      </motion.div>
    </div>
  );
}
