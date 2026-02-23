import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import ChatWelcome from '../components/chat/ChatWelcome';

export default function ChatPage() {
  const { chatId } = useParams();
  const { loadChats, setCurrentChat, currentChatId } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (chatId) setCurrentChat(chatId);
    else setCurrentChat(null);
  }, [chatId]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      <ChatSidebar
        currentChatId={chatId}
        onSelectChat={(id) => navigate(`/chat/${id}`)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {chatId ? (
          <ChatWindow chatId={chatId} />
        ) : (
          <ChatWelcome user={user} />
        )}
      </div>
    </div>
  );
}
