import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';

export default function CreateGroupModal({ onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createGroupChat } = useChatStore();
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const chatId = await createGroupChat(name, description, []);
    navigate(`/chat/${chatId}`);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 20 }}>Создать группу</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group"><label>Название *</label><input className="input" placeholder="Название группы" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="input-group"><label>Описание</label><textarea className="input" placeholder="Описание группы" value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'none', height: 80 }} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={onClose}>Отмена</button>
            <button className="btn btn-primary" style={{ flex: 1 }} type="submit">Создать</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
