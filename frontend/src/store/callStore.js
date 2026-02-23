import { create } from 'zustand';
import { useSocketStore } from './socketStore';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production
    ...(import.meta.env.VITE_TURN_URL ? [{
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USER,
      credential: import.meta.env.VITE_TURN_CREDENTIAL
    }] : [])
  ]
};

export const useCallStore = create((set, get) => ({
  // Call state
  callId: null,
  callState: null, // null | 'initiating' | 'ringing' | 'active' | 'ended'
  callType: null, // 'voice' | 'video'
  incomingCall: null,
  participants: {},
  missedCalls: [],

  // Media state
  isVideoOn: false,
  isMuted: false,
  isScreenSharing: false,

  // WebRTC
  peerConnection: null,
  localStream: null,
  remoteStreams: {},

  setIncomingCall: (callData) => {
    set({ incomingCall: callData });
    // Play ringtone
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    set({ ringtoneAudio: audio });
  },

  initiateCall: async (targetUserId, type, chatId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      const pc = new RTCPeerConnection(ICE_SERVERS);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          useSocketStore.getState().emit('webrtc:ice_candidate', {
            targetUserId,
            callId: get().callId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        set(state => ({
          remoteStreams: { ...state.remoteStreams, [targetUserId]: remoteStream }
        }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          toast.error('Соединение потеряно');
          get().endCall('failed');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      set({
        peerConnection: pc,
        localStream: stream,
        callType: type,
        callState: 'initiating',
        isVideoOn: type === 'video'
      });

      useSocketStore.getState().emit('call:initiate', { targetUserId, type, chatId });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      toast.error('Не удалось начать звонок. Проверьте доступ к камере/микрофону.');
    }
  },

  acceptCall: async () => {
    const { incomingCall, ringtoneAudio } = get();
    if (!incomingCall) return;

    ringtoneAudio?.pause();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === 'video'
      });

      const pc = new RTCPeerConnection(ICE_SERVERS);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          useSocketStore.getState().emit('webrtc:ice_candidate', {
            targetUserId: incomingCall.caller.id,
            callId: incomingCall.callId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        set(state => ({
          remoteStreams: { ...state.remoteStreams, [incomingCall.caller.id]: remoteStream }
        }));
      };

      set({
        peerConnection: pc,
        localStream: stream,
        callId: incomingCall.callId,
        callType: incomingCall.type,
        callState: 'accepting',
        isVideoOn: incomingCall.type === 'video',
        incomingCall: null
      });

      useSocketStore.getState().emit('call:accept', { callId: incomingCall.callId });
    } catch (err) {
      toast.error('Ошибка принятия звонка');
      get().declineCall();
    }
  },

  declineCall: () => {
    const { incomingCall, ringtoneAudio } = get();
    ringtoneAudio?.pause();
    if (incomingCall) {
      useSocketStore.getState().emit('call:decline', { callId: incomingCall.callId });
    }
    set({ incomingCall: null, ringtoneAudio: null });
  },

  handleOffer: async ({ callId, offer, fromUserId }) => {
    const pc = get().peerConnection;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    useSocketStore.getState().emit('webrtc:answer', {
      targetUserId: fromUserId,
      callId,
      answer
    });
  },

  handleAnswer: async ({ answer }) => {
    const pc = get().peerConnection;
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    set({ callState: 'active' });
  },

  handleIceCandidate: async ({ candidate }) => {
    const pc = get().peerConnection;
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  },

  setCallState: (state, callId) => {
    set({ callState: state, ...(callId ? { callId } : {}) });
  },

  toggleMute: () => {
    const { localStream, isMuted, callId } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
      set({ isMuted: !isMuted });
      useSocketStore.getState().emit('call:media_state', {
        callId,
        isMuted: !isMuted,
        isVideoOn: get().isVideoOn,
        isScreenSharing: get().isScreenSharing
      });
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoOn, callId } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !isVideoOn);
      set({ isVideoOn: !isVideoOn });
      useSocketStore.getState().emit('call:media_state', {
        callId, isVideoOn: !isVideoOn, isMuted: get().isMuted
      });
    }
  },

  toggleScreenShare: async () => {
    const { isScreenSharing, peerConnection, localStream, callId } = get();

    if (isScreenSharing) {
      // Stop screen share, revert to camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = cameraStream.getVideoTracks()[0];
      const sender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(videoTrack);
      set({ isScreenSharing: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => get().toggleScreenShare();
        set({ isScreenSharing: true });
        useSocketStore.getState().emit('call:media_state', { callId, isScreenSharing: true });
      } catch (err) {
        toast.error('Не удалось начать демонстрацию экрана');
      }
    }
  },

  endCall: (reason = 'ended', duration = null) => {
    const { peerConnection, localStream, ringtoneAudio, callId } = get();

    ringtoneAudio?.pause();

    // Stop all tracks
    localStream?.getTracks().forEach(t => t.stop());
    peerConnection?.close();

    if (callId && reason !== 'ended') {
      useSocketStore.getState().emit('call:end', { callId });
    }

    set({
      callId: null,
      callState: null,
      callType: null,
      peerConnection: null,
      localStream: null,
      remoteStreams: {},
      incomingCall: null,
      isVideoOn: false,
      isMuted: false,
      isScreenSharing: false,
      ringtoneAudio: null
    });

    if (duration) toast.success(`Звонок завершён (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})`);
  },

  updateParticipantMedia: ({ userId, ...mediaState }) => {
    set(state => ({
      participants: { ...state.participants, [userId]: mediaState }
    }));
  },

  addMissedCall: (callId) => {
    set(state => ({ missedCalls: [...state.missedCalls, callId] }));
    toast('Пропущенный звонок', { icon: '📞' });
  }
}));
