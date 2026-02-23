import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Avatar from '../components/common/Avatar';
import toast from 'react-hot-toast';
import { useChatStore } from '../store/chatStore';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const { createPersonalChat } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    const { data } = await api.get('/contacts');
    setContacts(data.contacts);
  };

  const accept = async (id) => {
    await api.put(`/contacts/${id}/accept`);
    loadContacts();
    toast.success('Контакт принят');
  };

  const remove = async (id) => {
    await api.delete(`/contacts/${id}`);
    loadContacts();
  };

  const openChat = async (userId) => {
    const chatId = await createPersonalChat(userId);
    navigate(`/chat/${chatId}`);
  };

  const pending = contacts.filter(c => c.status === 'pending');
  const accepted = contacts.filter(c => c.status === 'accepted');

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Назад</button>
        <h2 style={{ marginBottom: 24 }}>Контакты</h2>

        {pending.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>ЗАПРОСЫ</h3>
            {pending.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <Avatar src={c.user.avatar_url} name={c.user.username} size={40} />
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{c.user.first_name || c.user.username}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{c.user.username}</div></div>
                <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => accept(c.user.id)}>✓</button>
                <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => remove(c.user.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h3 style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>МОИ КОНТАКТЫ ({accepted.length})</h3>
          {accepted.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Нет контактов</div>}
          {accepted.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', cursor: 'pointer' }}>
              <Avatar src={c.user.avatar_url} name={c.user.username} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{c.user.first_name || c.user.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{c.user.username}</div>
              </div>
              <div className={`status-dot ${c.user.status}`} />
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => openChat(c.user.id)}>💬</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
