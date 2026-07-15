import { useEffect, useRef, useState } from 'react';

function LightningIcon({ fill, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={style}>
      <path fill={fill} d="M42.921,28.866L23.632,10.835c-0.639-0.597-1.683-0.144-1.683,0.731v26.009c0,0.839,0.97,1.305,1.625,0.781l5.204-4.152l5.583,12.86c0.22,0.507,0.809,0.739,1.316,0.519l4.147-2.029c0.507-0.22,0.739-0.809,0.519-1.316l-5.547-12.774l7.557-0.874C43.2,30.492,43.544,29.448,42.921,28.866z" />
      <line x1="12.5" x2="12.5" y1="4.5" y2="35.5" fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <line x1="21.104" x2="25.535" y1="33.296" y2="43.5" fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <polyline fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points="33.043,32.763 30.603,27.145 40.5,26 17.5,4.5 17.5,13.298" />
      <polyline fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points="17.5,19.298 17.5,35.5 25.062,29.448 31.163,43.5 36.667,41.109 34.714,36.612" />
      <line x1="17.5" x2="12.5" y1="4.5" y2="4.5" fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <line x1="17.5" x2="12.5" y1="35.5" y2="35.5" fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <line x1="30.879" x2="25.879" y1="43.5" y2="43.5" fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
    </svg>
  );
}

function HandIcon({ fill, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={style}>
      <path fill={fill} d="M42.4,21.5c-1.7,0-3,1.3-3,3c0-1.7-1.3-3-3-3s-3,1.3-3,3c0-1.7-1.3-3-3-3s-3,1.3-3,3v-13c0-1.7-1.3-3-3-3s-3,1.3-3,3v20.3c0,0.8-0.8,1.3-1.5,0.9c-1.5-0.9-2.8-2.1-4.1-2.7c-0.6-0.3-1.2-0.4-1.8-0.4c-3.2,0-3.5,2.9-3.5,2.9s7.2,7.3,9.7,10c1.8,1.9,4.1,3.1,6.6,3.1h8.6c5.5,0,10-4.5,10-10v-11C45.4,22.8,44.1,21.5,42.4,21.5z" />
      <path fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M37.8,39.2c2.2-1.8,3.6-4.6,3.6-7.7v-11c0-1.7-1.3-3-3-3s-3,1.3-3,3c0-1.7-1.3-3-3-3s-3,1.3-3,3c0-1.7-1.3-3-3-3s-3,1.3-3,3v-13c0-1.7-1.3-3-3-3s-3,1.3-3,3v5.3" />
      <path fill="none" stroke="#18193f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.4,18.2v9.5c0,0.8-0.8,1.3-1.5,0.9c-1.5-0.9-2.8-2.1-4.1-2.7c-0.6-0.3-1.2-0.4-1.8-0.4c-3.2,0-3.5,2.9-3.5,2.9s7.2,7.3,9.7,10c1.8,1.9,4.1,3.1,6.6,3.1h8.6" />
    </svg>
  );
}

export default function CustomCursor() {
  const cursorRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isClickable, setIsClickable] = useState(false);

  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const id = 'custom-cursor-style';
    if (!isSmallScreen) {
      if (!document.getElementById(id)) {
        const s = document.createElement('style');
        s.id = id;
        s.textContent = '*{cursor:none!important}';
        document.head.appendChild(s);
      }
    } else {
      const s = document.getElementById(id);
      if (s) s.remove();
    }
    return () => {
      const s = document.getElementById(id);
      if (s) s.remove();
    };
  }, [isSmallScreen]);

  useEffect(() => {
    if (isSmallScreen) return;

    const isInteractive = (el) => {
      if (!el || el === document.body || el === document.documentElement) return false;
      const tag = el.tagName?.toLowerCase();
      if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return true;
      if (el.getAttribute('role') === 'button') return true;
      if (el.getAttribute('onclick')) return true;
      if (el.classList.contains('cursor-pointer')) return true;
      const cs = getComputedStyle(el);
      if (cs.cursor === 'pointer') return true;
      return isInteractive(el.parentElement);
    };

    const over = (e) => setIsClickable(isInteractive(e.target));
    const out = () => setIsClickable(false);

    const move = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);

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
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      cancelAnimationFrame(raf);
    };
  }, [isSmallScreen]);

  if (isSmallScreen) return null;

  const iconSize = isClickable ? 32 : 28;
  const fill = isClickable ? '#8ce7f2' : '#90caf9';

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: iconSize + 'px',
        height: iconSize + 'px',
        pointerEvents: 'none',
        zIndex: 99999,
        mixBlendMode: 'difference',
        transform: 'translate(-15%, -15%)',
        transition: 'width 0.15s ease, height 0.15s ease',
      }}
    >
      {isClickable ? (
        <HandIcon fill={fill} style={{ width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000) drop-shadow(1px -1px 0 #000) drop-shadow(-1px 1px 0 #000)' }} />
      ) : (
        <LightningIcon fill={fill} style={{ width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000) drop-shadow(1px -1px 0 #000) drop-shadow(-1px 1px 0 #000)' }} />
      )}
    </div>
  );
}
