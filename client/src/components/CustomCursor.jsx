import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: '28px',
        height: '28px',
        pointerEvents: 'none',
        zIndex: 99999,
        transform: 'translate(-15%, -15%)',
      }}
    >
      <svg fill="#000000" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d="M20.8,9.4,4.87,2.18A2,2,0,0,0,2.18,4.87h0L9.4,20.8A2,2,0,0,0,11.27,22h.25a2.26,2.26,0,0,0,2-1.8l1.13-5.58,5.58-1.13a2.26,2.26,0,0,0,1.8-2A2,2,0,0,0,20.8,9.4Z" />
      </svg>
    </div>
  );
}
