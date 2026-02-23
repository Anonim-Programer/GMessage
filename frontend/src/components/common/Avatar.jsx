import React from 'react';

const COLORS = [
  '#7c3aed', '#2563eb', '#16a34a', '#d97706',
  '#dc2626', '#0891b2', '#7c3aed', '#be185d'
];

function stringToColor(str) {
  if (!str) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ src, name, size = 40 }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const bg = stringToColor(name);
  const fontSize = size * 0.4;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="avatar"
        style={{ width: size, height: size, objectFit: 'cover' }}
        onError={e => { e.target.onerror = null; e.target.src = ''; e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className="avatar-placeholder"
      style={{
        width: size,
        height: size,
        background: bg,
        color: '#fff',
        fontSize,
        userSelect: 'none'
      }}
    >
      {initial}
    </div>
  );
}
