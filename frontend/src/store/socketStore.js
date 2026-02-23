import { create } from 'zustand';
import { io } from 'socket.io-client';
import { useChatStore } from './chatStore';
import { useCallStore } from './callStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,

  connect: (token) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      set({ connected: true });
      console.log('Socket connected');
    });

    socket.on('disconnect', () => set({ connected: false }));

    // Message events
    socket.on('message:new', (message) => {
      useChatStore.getState().addMessage(message);
    });

    socket.on('message:edited', ({ messageId, content, editedAt }) => {
      useChatStore.getState().updateMessage(messageId, { content, is_edited: true, edited_at: editedAt });
    });

    socket.on('message:deleted', ({ messageId }) => {
      useChatStore.getState().updateMessage(messageId, { is_deleted: true, content: null });
    });

    socket.on('message:reaction_added', ({ messageId, userId, emoji }) => {
      useChatStore.getState().addReaction(messageId, userId, emoji);
    });

    socket.on('message:reaction_removed', ({ messageId, userId, emoji }) => {
      useChatStore.getState().removeReaction(messageId, userId, emoji);
    });

    socket.on('message:read_by', ({ messageIds, userId }) => {
      useChatStore.getState().markAsRead(messageIds, userId);
    });

    socket.on('message:pinned', ({ messageId }) => {
      useChatStore.getState().updateMessage(messageId, { is_pinned: true });
    });

    // Typing events
    socket.on('typing:started', ({ chatId, userId, username }) => {
      useChatStore.getState().setTyping(chatId, userId, username, true);
    });

    socket.on('typing:stopped', ({ chatId, userId }) => {
      useChatStore.getState().setTyping(chatId, userId, null, false);
    });

    // Status events
    socket.on('contact:status_changed', ({ userId, status }) => {
      useChatStore.getState().updateContactStatus(userId, status);
    });

    // Call events
    socket.on('call:incoming', (data) => {
      useCallStore.getState().setIncomingCall(data);
    });

    socket.on('call:ringing', ({ callId }) => {
      useCallStore.getState().setCallState('ringing', callId);
    });

    socket.on('call:accepted', ({ callId, userId }) => {
      useCallStore.getState().setCallState('active', callId);
    });

    socket.on('call:declined', () => {
      useCallStore.getState().endCall('declined');
    });

    socket.on('call:ended', ({ duration }) => {
      useCallStore.getState().endCall('ended', duration);
    });

    socket.on('call:missed', ({ callId }) => {
      useCallStore.getState().addMissedCall(callId);
    });

    socket.on('call:no_answer', () => {
      useCallStore.getState().endCall('no_answer');
    });

    // WebRTC signaling
    socket.on('webrtc:offer', (data) => {
      useCallStore.getState().handleOffer(data);
    });

    socket.on('webrtc:answer', (data) => {
      useCallStore.getState().handleAnswer(data);
    });

    socket.on('webrtc:ice_candidate', (data) => {
      useCallStore.getState().handleIceCandidate(data);
    });

    socket.on('call:media_state_changed', (data) => {
      useCallStore.getState().updateParticipantMedia(data);
    });

    set({ socket });
    return socket;
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  emit: (event, data) => {
    const socket = get().socket;
    if (socket?.connected) socket.emit(event, data);
  }
}));
