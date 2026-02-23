import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Avatar from '../components/common/Avatar';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user: me, updateUser } = useAuthStore();
  const isMe = !userId || userId === me?.id;
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (isMe) { setProfile(me); setForm({ firstName: me?.first_name, lastName: me?.last_name, bio: me?.bio }); }
    else api.get(`/users/${userId}`).then(r => setProfile(r.data.user));
  }, [userId, me]);

  const handleSave = async () => {
    try {
      const { data } = await api.put('/users/me', { firstName: form.firstName, lastName: form.lastName, bio: form.bio });
      updateUser(data.user);
      setEditing(false);
      toast.success('Профиль обновлён');
    } catch { toast.error('Ошибка сохранения'); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/uploads/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ avatar_url: data.avatarUrl });
      toast.success('Аватар обновлён');
    } catch { toast.error('Ошибка загрузки аватара'); }
  };

  if (!profile) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span className="spinner" /></div>;

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)', padding: 40 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>← Назад</button>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={profile.avatar_url} name={profile.first_name || profile.username} size={80} />
              {isMe && (
                <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
                  📷<input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" placeholder="Имя" value={form.firstName || ''} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                    <input className="input" placeholder="Фамилия" value={form.lastName || ''} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                  <textarea className="input" placeholder="О себе..." value={form.bio || ''} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} style={{ resize: 'none', height: 60 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => setEditing(false)}>Отмена</button>
                    <button className="btn btn-primary" onClick={handleSave}>Сохранить</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 style={{ fontSize: 22 }}>{profile.first_name || ''} {profile.last_name || ''}</h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>@{profile.username}</div>
                  {profile.bio && <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 14 }}>{profile.bio}</p>}
                  <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className={`status-dot ${profile.status}`} />
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{profile.reputation_level}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⭐ {profile.reputation_score || 0} очков</span>
                  </div>
                  {isMe && <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>✏️ Редактировать</button>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
