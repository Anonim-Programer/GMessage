import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../common/Avatar';
import SearchUsersModal from '../modals/SearchUsersModal';
import CreateGroupModal from '../modals/CreateGroupModal';

export default function ChatSidebar({ currentChatId, onSelectChat }) {
  const { chats, isLoading } = useChatStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'contacts'

  const filtered = chats.filter(c => {
    const name = c.type === 'personal' ? c.partner?.first_name || c.partner?.username : c.name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  const getChatName = (chat) => {
    if (chat.type === 'personal') {
      return `${chat.partner?.first_name || ''} ${chat.partner?.last_name || ''}`.trim() || chat.partner?.username;
    }
    return chat.name;
  };

  const getChatAvatar = (chat) => {
    if (chat.type === 'personal') return chat.partner?.avatar_url;
    return chat.avatar_url;
  };

  const getChatInitials = (chat) => {
    if (chat.type === 'personal') {
      const name = getChatName(chat);
      return name?.charAt(0)?.toUpperCase() || '?';
    }
    return chat.name?.charAt(0)?.toUpperCase() || 'G';
  };

  return (
    <>
      <div style={{
        width: 320,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flexShrink: 0
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            <Avatar
              src={user?.avatar_url}
              name={user?.first_name || user?.username}
              size={40}
            />
            <div className={`status-dot ${user?.status || 'offline'}`} style={{
              position: 'absolute', bottom: 0, right: 0
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {user?.first_name || user?.username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {user?.reputation_level}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-icon"
              title="Найти пользователя"
              onClick={() => setShowSearch(true)}
            >
              🔍
            </button>
            <button
              className="btn btn-icon"
              title="Создать группу"
              onClick={() => setShowCreateGroup(true)}
            >
              ✏️
            </button>
            <button
              className="btn btn-icon"
              title="Настройки"
              onClick={() => navigate('/settings')}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px' }}>
          <input
            className="input"
            placeholder="Поиск чатов..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AnimatePresence>
            {filtered.length === 0 && !isLoading && (
              <div style={{
                padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13
              }}>
                {search ? 'Чаты не найдены' : 'Нет чатов. Найдите пользователя, чтобы начать общение.'}
              </div>
            )}
            {filtered.map((chat, i) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => onSelectChat(chat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: chat.id === currentChatId ? 'var(--bg-active)' : 'transparent',
                  borderLeft: chat.id === currentChatId ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all var(--transition)'
                }}
                onMouseEnter={e => {
                  if (chat.id !== currentChatId) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  if (chat.id !== currentChatId) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    src={getChatAvatar(chat)}
                    name={getChatInitials(chat)}
                    size={48}
                  />
                  {chat.type === 'personal' && chat.partner?.status && (
                    <div className={`status-dot ${chat.partner.status}`} style={{
                      position: 'absolute', bottom: 1, right: 1
                    }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontWeight: 500, fontSize: 14,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160
                    }}>
                      {getChatName(chat)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {chat.last_message
                        ? formatDistanceToNow(new Date(chat.last_message.created_at), { locale: ru, addSuffix: false })
                        : ''
                      }
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{
                      fontSize: 13, color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 170
                    }}>
                      {chat.last_message
                        ? (chat.last_message.type === 'text'
                          ? chat.last_message.content
                          : chat.last_message.type === 'image' ? '📷 Фото'
                          : chat.last_message.type === 'voice' ? '🎤 Голосовое'
                          : '📎 Файл')
                        : 'Начните общение...'
                      }
                    </span>
                    {parseInt(chat.unread_count) > 0 && (
                      <span style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        borderRadius: 10,
                        padding: '1px 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        minWidth: 20,
                        textAlign: 'center',
                        flexShrink: 0
                      }}>
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom nav */}
        <div style={{
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0'
        }}>
          {[
            { icon: '💬', label: 'Чаты', path: '/' },
            { icon: '👥', label: 'Контакты', path: '/contacts' },
            { icon: '👤', label: 'Профиль', path: '/profile' },
          ].map(item => (
            <button
              key={item.path}
              className="btn btn-ghost"
              style={{ flexDirection: 'column', gap: 2, fontSize: 11, padding: '8px 16px' }}
              onClick={() => navigate(item.path)}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {showSearch && <SearchUsersModal onClose={() => setShowSearch(false)} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </>
  );
}
