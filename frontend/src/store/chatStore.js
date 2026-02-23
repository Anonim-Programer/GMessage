import { create } from 'zustand';
import api from '../utils/api';

export const useChatStore = create((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: {}, // chatId -> messages[]
  typingUsers: {}, // chatId -> { userId: username }
  isLoading: false,
  hasMore: {},

  loadChats: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/chats');
      set({ chats: data.chats });
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentChat: (chatId) => {
    set({ currentChatId: chatId });
    if (chatId && !get().messages[chatId]) {
      get().loadMessages(chatId);
    }
  },

  loadMessages: async (chatId, before = null) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (before) params.append('before', before);
      const { data } = await api.get(`/messages/chat/${chatId}?${params}`);
      
      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: before
            ? [...data.messages, ...(state.messages[chatId] || [])]
            : data.messages
        },
        hasMore: { ...state.hasMore, [chatId]: data.hasMore }
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  addMessage: (message) => {
    const { chatId } = message;
    set(state => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), message]
      },
      chats: state.chats.map(c =>
        c.id === chatId
          ? { ...c, last_message: message, updated_at: message.created_at }
          : c
      ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }));
  },

  updateMessage: (messageId, updates) => {
    set(state => {
      const newMessages = {};
      for (const [chatId, msgs] of Object.entries(state.messages)) {
        newMessages[chatId] = msgs.map(m => m.id === messageId ? { ...m, ...updates } : m);
      }
      return { messages: newMessages };
    });
  },

  addReaction: (messageId, userId, emoji) => {
    set(state => {
      const newMessages = {};
      for (const [chatId, msgs] of Object.entries(state.messages)) {
        newMessages[chatId] = msgs.map(m => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || []), { emoji, user_id: userId }];
          return { ...m, reactions };
        });
      }
      return { messages: newMessages };
    });
  },

  removeReaction: (messageId, userId, emoji) => {
    set(state => {
      const newMessages = {};
      for (const [chatId, msgs] of Object.entries(state.messages)) {
        newMessages[chatId] = msgs.map(m => {
          if (m.id !== messageId) return m;
          const reactions = (m.reactions || []).filter(r => !(r.user_id === userId && r.emoji === emoji));
          return { ...m, reactions };
        });
      }
      return { messages: newMessages };
    });
  },

  markAsRead: (messageIds, userId) => {
    set(state => {
      const newMessages = {};
      for (const [chatId, msgs] of Object.entries(state.messages)) {
        newMessages[chatId] = msgs.map(m =>
          messageIds.includes(m.id)
            ? { ...m, read_by: [...(m.read_by || []), userId] }
            : m
        );
      }
      return { messages: newMessages };
    });
  },

  setTyping: (chatId, userId, username, isTyping) => {
    set(state => {
      const chatTyping = { ...(state.typingUsers[chatId] || {}) };
      if (isTyping) chatTyping[userId] = username;
      else delete chatTyping[userId];
      return { typingUsers: { ...state.typingUsers, [chatId]: chatTyping } };
    });
  },

  updateContactStatus: (userId, status) => {
    set(state => ({
      chats: state.chats.map(c => {
        if (c.partner?.id === userId) {
          return { ...c, partner: { ...c.partner, status } };
        }
        return c;
      })
    }));
  },

  createPersonalChat: async (targetUserId) => {
    const { data } = await api.post('/chats/personal', { targetUserId });
    if (!data.alreadyExists) {
      get().loadChats();
    }
    return data.chat.id;
  },

  createGroupChat: async (name, description, memberIds) => {
    const { data } = await api.post('/chats/group', { name, description, memberIds });
    get().loadChats();
    return data.chat.id;
  }
}));
