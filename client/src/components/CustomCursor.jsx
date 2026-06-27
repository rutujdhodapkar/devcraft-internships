import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    window.addEventListener('mousemove', move);

    let raf;
    const animate = () => {
      if (!cursorRef.current) return;
      const el = cursorRef.current;
      const dx = target.current.x - parseFloat(el.style.left || 0);
      const dy = target.current.y - parseFloat(el.style.top || 0);
      el.style.left = (parseFloat(el.style.left || 0) + dx * 0.15) + 'px';
      el.style.top = (parseFloat(el.style.top || 0) + dy * 0.15) + 'px';
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '28px',
        height: '28px',
        pointerEvents: 'none',
        zIndex: 99999,
        mixBlendMode: 'difference',
        transform: 'translate(-15%, -15%)',
      }}
    >
      <svg fill="#ffffff" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d="M20.8,9.4,4.87,2.18A2,2,0,0,0,2.18,4.87h0L9.4,20.8A2,2,0,0,0,11.27,22h.25a2.26,2.26,0,0,0,2-1.8l1.13-5.58,5.58-1.13a2.26,2.26,0,0,0,1.8-2A2,2,0,0,0,20.8,9.4Z" />
      </svg>
    </div>
  );
}
