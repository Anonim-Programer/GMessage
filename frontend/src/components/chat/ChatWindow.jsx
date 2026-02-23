import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { useSocketStore } from '../../store/socketStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Avatar from '../common/Avatar';
import api from '../../utils/api';

export default function ChatWindow({ chatId }) {
  const { messages, typingUsers, hasMore, loadMessages } = useChatStore();
  const { user } = useAuthStore();
  const { initiateCall } = useCallStore();
  const { emit } = useSocketStore();
  const messagesRef = useRef(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const chatMessages = messages[chatId] || [];
  const typingInChat = typingUsers[chatId] || {};
  const typingList = Object.values(typingInChat);

  useEffect(() => {
    loadChatInfo();
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (chatMessages.length && chatId) {
      const unreadIds = chatMessages
        .filter(m => m.sender_id !== user.id && !(m.read_by || []).includes(user.id))
        .map(m => m.id)
        .slice(-50);
      if (unreadIds.length) {
        emit('message:read', { messageIds: unreadIds, chatId });
      }
    }
  }, [chatMessages]);

  async function loadChatInfo() {
    try {
      const { data } = await api.get(`/chats/${chatId}`);
      setChatInfo(data);
    } catch (err) {
      console.error(err);
    }
  }

  function scrollToBottom(smooth = false) {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  async function handleScroll() {
    if (messagesRef.current?.scrollTop < 100 && hasMore[chatId] && !isLoadingMore) {
      setIsLoadingMore(true);
      const oldest = chatMessages[0];
      await loadMessages(chatId, oldest?.created_at);
      setIsLoadingMore(false);
    }
  }

  const chat = chatInfo?.chat;
  const isPersonal = chat?.type === 'personal';
  const partner = chatInfo?.members?.find(m => m.id !== user.id);
  const chatName = isPersonal ? `${partner?.first_name || ''} ${partner?.last_name || ''}`.trim() || partner?.username : chat?.name;
  const chatAvatar = isPersonal ? partner?.avatar_url : chat?.avatar_url;
  const chatStatus = isPersonal ? partner?.status : null;
  const memberCount = chatInfo?.members?.length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <Avatar src={chatAvatar} name={chatName} size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{chatName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isPersonal
              ? (chatStatus === 'online' ? 'В сети' : chatStatus === 'away' ? 'Отошёл' : 'Был недавно')
              : `${memberCount || 0} участников`
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPersonal && partner && (
            <>
              <button
                className="btn btn-icon"
                title="Голосовой звонок"
                onClick={() => initiateCall(partner.id, 'voice', chatId)}
                style={{ fontSize: 18 }}
              >📞</button>
              <button
                className="btn btn-icon"
                title="Видео-звонок"
                onClick={() => initiateCall(partner.id, 'video', chatId)}
                style={{ fontSize: 18 }}
              >📹</button>
            </>
          )}
          <button className="btn btn-icon" title="Поиск" style={{ fontSize: 18 }}>🔍</button>
          <button className="btn btn-icon" title="Информация" style={{ fontSize: 18 }}>ℹ️</button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <span className="spinner" />
          </div>
        )}

        {chatMessages.map((msg, i) => {
          const prev = chatMessages[i - 1];
          const isMine = msg.sender_id === user.id;
          const showAvatar = !isMine && (!prev || prev.sender_id !== msg.sender_id);
          const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div style={{
                  textAlign: 'center', padding: '12px 0 8px',
                  color: 'var(--text-muted)', fontSize: 12,
                  position: 'sticky', top: 0, zIndex: 10
                }}>
                  <span style={{
                    background: 'var(--bg-secondary)',
                    padding: '4px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border)'
                  }}>
                    {new Date(msg.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isMine={isMine}
                showAvatar={showAvatar}
                isGroup={!isPersonal}
              />
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {typingList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{
              background: 'var(--bg-message-in)',
              borderRadius: 16,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {typingList.length === 1 ? `${typingList[0]} печатает` : 'Несколько человек печатают'}
              </span>
              <span style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)',
                    animation: 'pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }} />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput chatId={chatId} onMessageSent={() => scrollToBottom(true)} />
    </div>
  );
}
