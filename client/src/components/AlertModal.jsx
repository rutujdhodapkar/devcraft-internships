import React, { useEffect } from 'react';

export default function AlertModal({ message, onClose, type }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const borderColor = type === 'error' ? '#EA4335' : type === 'success' ? '#34A853' : '#000';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#fff',
        border: `2px solid ${borderColor}`,
        padding: '0.85rem 1.5rem',
        fontWeight: 700,
        fontSize: '0.85rem',
        color: borderColor,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        maxWidth: '90vw',
      }}
      onClick={onClose}
    >
      <span>{message}</span>
      <span style={{ cursor: 'pointer', fontWeight: 900, fontSize: '1.1rem' }}>&times;</span>
    </div>
  );
}
