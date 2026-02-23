import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSocketStore } from '../../store/socketStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function MessageInput({ chatId, onMessageSent }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const { emit } = useSocketStore();
  const { user } = useAuthStore();

  const handleTyping = useCallback(() => {
    emit('typing:start', { chatId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emit('typing:stop', { chatId });
    }, 2000);
  }, [chatId, emit]);

  useEffect(() => {
    return () => clearTimeout(typingTimeoutRef.current);
  }, []);

  function adjustTextarea() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage(overrides = {}) {
    const content = overrides.content || text.trim();
    if (!content && !overrides.fileUrl) return;

    setIsSending(true);
    try {
      emit('message:send', {
        chatId,
        content,
        type: overrides.type || 'text',
        replyToId: replyTo?.id,
        fileUrl: overrides.fileUrl,
        fileName: overrides.fileName,
        fileSize: overrides.fileSize,
        fileMimeType: overrides.fileMimeType,
        duration: overrides.duration
      });

      setText('');
      setReplyTo(null);
      if (textareaRef.current) textareaRef.current.style.height = '44px';
      onMessageSent?.();
    } finally {
      setIsSending(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Загрузка файла...');
    try {
      const formData = new FormData();
      const isImage = file.type.startsWith('image/');
      formData.append(isImage ? 'image' : 'file', file);

      const { data } = await api.post('/uploads/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await sendMessage({
        type: isImage ? 'image' : 'file',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileMimeType: data.fileMimeType
      });

      toast.success('Файл загружен', { id: toastId });
    } catch (err) {
      toast.error('Ошибка загрузки файла', { id: toastId });
    }
    e.target.value = '';
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice.webm');

        try {
          const { data } = await api.post('/uploads/file', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          await sendMessage({
            type: 'voice',
            fileUrl: data.fileUrl,
            fileName: 'Голосовое сообщение',
            fileMimeType: 'audio/webm'
          });
        } catch (err) {
          toast.error('Ошибка отправки голосового');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error('Нет доступа к микрофону');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      padding: '12px 16px'
    }}>
      {/* Reply preview */}
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--accent-light)',
          borderRadius: 8,
          marginBottom: 8,
          borderLeft: '3px solid var(--accent)'
        }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
            {replyTo.content?.substring(0, 80) || 'Медиа файл'}
          </div>
          <button
            className="btn btn-icon"
            style={{ width: 24, height: 24, fontSize: 14 }}
            onClick={() => setReplyTo(null)}
          >✕</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {/* File upload */}
        <label style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <span className="btn btn-icon" style={{ fontSize: 20, width: 42, height: 42 }} title="Прикрепить файл">
            📎
          </span>
        </label>

        {/* Text input */}
        <div style={{
          flex: 1,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '8px 16px',
          gap: 8
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              handleTyping();
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Написать сообщение..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'var(--font)',
              resize: 'none',
              lineHeight: 1.5,
              height: 44,
              maxHeight: 120,
              paddingTop: 10
            }}
            rows={1}
          />
        </div>

        {/* Voice or send */}
        {text.trim() ? (
          <button
            className="btn"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--accent)', padding: 0, fontSize: 18
            }}
            onClick={() => sendMessage()}
            disabled={isSending}
          >
            {isSending ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '➤'}
          </button>
        ) : (
          <button
            className="btn"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: isRecording ? 'var(--danger)' : 'var(--accent)',
              padding: 0, fontSize: 18,
              animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none'
            }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title={isRecording ? 'Отпустите для отправки' : 'Удержите для записи'}
          >
            🎤
          </button>
        )}
      </div>
    </div>
  );
}
