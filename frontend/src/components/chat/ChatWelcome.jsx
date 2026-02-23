import React from 'react';
export default function ChatWelcome({ user }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 64 }}>💬</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Добро пожаловать в GMessage</div>
      <div>Выберите чат слева или найдите пользователя для начала общения</div>
    </div>
  );
}
