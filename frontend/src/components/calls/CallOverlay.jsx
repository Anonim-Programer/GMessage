import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallStore } from '../../store/callStore';

export default function CallOverlay() {
  const {
    callState, callType, incomingCall,
    localStream, remoteStreams,
    isVideoOn, isMuted, isScreenSharing,
    toggleMute, toggleVideo, toggleScreenShare,
    endCall, acceptCall, declineCall
  } = useCallStore();

  const localVideoRef = useRef(null);
  const [remoteVideoRefs] = useState({});
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (callState === 'active') {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const formatDuration = (secs) =>
    `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

  const remoteStreamEntries = Object.entries(remoteStreams);

  return (
    <AnimatePresence>
      {/* Incoming Call */}
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          style={{
            position: 'fixed', top: 20, right: 20,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 20,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: 280
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {incomingCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {incomingCall.caller.first_name || incomingCall.caller.username}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {incomingCall.type === 'video' ? 'Видеозвонок' : 'Голосовой звонок'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={declineCall}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--danger)', border: 'none', cursor: 'pointer',
                fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >📵</button>
            <button
              onClick={acceptCall}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--success)', border: 'none', cursor: 'pointer',
                fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >{incomingCall.type === 'video' ? '📹' : '📞'}</button>
          </div>
        </motion.div>
      )}

      {/* Active Call */}
      {(callState === 'ringing' || callState === 'active' || callState === 'initiating') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{
            position: 'fixed', inset: 0,
            background: callType === 'video' ? '#000' : 'linear-gradient(135deg, #1a1a2e, #16213e)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '60px 40px 50px'
          }}
        >
          {/* Status */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              {callState === 'ringing' ? '🔔 Звонок...' :
               callState === 'initiating' ? '⏳ Соединение...' :
               formatDuration(callDuration)}
            </div>
          </div>

          {/* Video streams */}
          {callType === 'video' ? (
            <div style={{ position: 'relative', flex: 1, width: '100%', maxWidth: 900 }}>
              {/* Remote video */}
              {remoteStreamEntries.map(([userId, stream]) => (
                <video
                  key={userId}
                  ref={el => {
                    if (el) {
                      el.srcObject = stream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover', borderRadius: 20
                  }}
                />
              ))}

              {/* Local video (picture-in-picture) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  bottom: 16, right: 16,
                  width: 160, height: 120,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              />
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
            }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48,
                animation: callState === 'ringing' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                boxShadow: '0 0 60px rgba(124,58,237,0.4)'
              }}>
                👤
              </div>
            </div>
          )}

          {/* Call controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <CallButton
              icon={isMuted ? '🔇' : '🎤'}
              label={isMuted ? 'Вкл. микр.' : 'Выкл. микр.'}
              active={isMuted}
              onClick={toggleMute}
            />
            {callType === 'video' && (
              <>
                <CallButton
                  icon={isVideoOn ? '📹' : '📷'}
                  label={isVideoOn ? 'Выкл. кам.' : 'Вкл. кам.'}
                  active={!isVideoOn}
                  onClick={toggleVideo}
                />
                <CallButton
                  icon='🖥️'
                  label={isScreenSharing ? 'Стоп демо' : 'Демо экран'}
                  active={isScreenSharing}
                  onClick={toggleScreenShare}
                />
              </>
            )}
            <button
              onClick={() => endCall()}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--danger)',
                border: 'none', cursor: 'pointer',
                fontSize: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(239,68,68,0.4)'
              }}
            >
              📵
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CallButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6,
        background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
        border: 'none', borderRadius: 16,
        padding: '12px 16px', cursor: 'pointer',
        color: '#fff', fontSize: 11,
        transition: 'background 0.2s'
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      {label}
    </button>
  );
}
