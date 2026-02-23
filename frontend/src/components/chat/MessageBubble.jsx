import React, { useState } from 'react';
import { format } from 'date-fns';
import { useSocketStore } from '../../store/socketStore';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../common/Avatar';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👎'];

export default function MessageBubble({ message, isMine, showAvatar, isGroup }) {
  const [showReactions, setShowReactions] = useState(false);
  const [hovering, setHovering] = useState(false);
  const { emit } = useSocketStore();
  const { user } = useAuthStore();

  if (message.is_deleted) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        padding: '2px 0'
      }}>
        <div style={{
          padding: '8px 14px',
          borderRadius: 16,
          background: 'var(--bg-tertiary)',
          color: 'var(--text-muted)',
          fontSize: 13,
          fontStyle: 'italic'
        }}>
          🚫 Сообщение удалено
        </div>
      </div>
    );
  }

  function handleReaction(emoji) {
    emit('message:reaction', { messageId: message.id, emoji });
    setShowReactions(false);
  }

  const reactionGroups = {};
  if (message.reactions) {
    for (const r of message.reactions) {
      if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
      reactionGroups[r.emoji].push(r.user_id);
    }
  }

  const myReactions = (message.reactions || [])
    .filter(r => r.user_id === user.id)
    .map(r => r.emoji);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: 8,
        padding: '1px 0',
        position: 'relative'
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowReactions(false); }}
    >
      {/* Avatar (for group chats) */}
      {!isMine && (
        <div style={{ width: 32, flexShrink: 0 }}>
          {showAvatar && (
            <Avatar
              src={message.sender?.avatar_url}
              name={message.sender?.username}
              size={32}
            />
          )}
        </div>
      )}

      <div style={{ maxWidth: '65%', minWidth: 0 }}>
        {/* Sender name in group */}
        {!isMine && isGroup && showAvatar && (
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--accent)',
            marginBottom: 4, paddingLeft: 14
          }}>
            {message.sender?.first_name || message.sender?.username}
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div style={{
            background: isMine ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '8px 8px 0 0',
            padding: '6px 12px',
            fontSize: 12,
            color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
            marginBottom: -4
          }}>
            {message.reply_to.content?.substring(0, 80) || '...'}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          background: isMine ? 'var(--bg-message-out)' : 'var(--bg-message-in)',
          color: isMine ? '#fff' : 'var(--text-primary)',
          borderRadius: isMine
            ? message.reply_to ? '16px 4px 16px 16px' : '16px 4px 16px 16px'
            : message.reply_to ? '4px 16px 16px 16px' : '4px 16px 16px 16px',
          padding: '8px 14px',
          wordBreak: 'break-word',
          position: 'relative',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          {/* Image */}
          {message.type === 'image' && message.file_url && (
            <img
              src={message.file_url}
              alt="image"
              style={{
                maxWidth: 280, maxHeight: 300,
                borderRadius: 8, display: 'block',
                marginBottom: message.content ? 8 : 0,
                cursor: 'pointer'
              }}
              onClick={() => window.open(message.file_url, '_blank')}
            />
          )}

          {/* File */}
          {message.type === 'file' && message.file_url && (
            <a
              href={message.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: 'inherit',
                background: 'rgba(0,0,0,0.1)',
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: message.content ? 8 : 0
              }}
            >
              <span style={{ fontSize: 24 }}>📎</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{message.file_name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {message.file_size ? `${(message.file_size / 1024).toFixed(1)} KB` : ''}
                </div>
              </div>
            </a>
          )}

          {/* Text content */}
          {message.content && (
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {message.content}
            </div>
          )}

          {/* Timestamp + status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'flex-end',
            marginTop: 4
          }}>
            {message.is_edited && (
              <span style={{ fontSize: 10, opacity: 0.6 }}>ред.</span>
            )}
            <span style={{ fontSize: 11, opacity: 0.6 }}>
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
            {isMine && (
              <span style={{ fontSize: 12, opacity: 0.8 }}>
                {(message.read_by?.length || 0) > 0 ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div style={{
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            marginTop: 4,
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            paddingLeft: !isMine ? 14 : 0
          }}>
            {Object.entries(reactionGroups).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                style={{
                  background: myReactions.includes(emoji) ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  border: `1px solid ${myReactions.includes(emoji) ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '2px 7px',
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                {emoji} <span style={{ color: 'var(--text-secondary)' }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reaction picker */}
      {hovering && (
        <div style={{
          position: 'absolute',
          [isMine ? 'left' : 'right']: 0,
          top: -40,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: '4px 8px',
          display: 'flex',
          gap: 4,
          zIndex: 100,
          boxShadow: 'var(--shadow)'
        }}>
          {COMMON_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 18,
                cursor: 'pointer',
                padding: '2px',
                borderRadius: 8,
                transition: 'transform var(--transition)'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
