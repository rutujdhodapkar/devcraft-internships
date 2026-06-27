import React, { useEffect, useState } from 'react';
import { fetchSlidingStripsContent } from '../services/data';

function Strip({ config }) {
  const { items, direction, speed, bgColor, textColor, position } = config;
  if (!items || !items.length) return null;

  const isRtl = direction === 'right';
  const duration = speed ? Math.max(10, 400 / speed) : 30;
  const tripled = [...items, ...items, ...items];

  return (
    <div style={{
      background: bgColor || '#000',
      color: textColor || '#fff',
      overflow: 'hidden',
      padding: '0.75rem 0',
      borderBottom: position === 'after-hero' ? '2px solid #000' : 'none',
      borderTop: position === 'before-footer' ? '2px solid #000' : 'none',
    }}>
      <div style={{
        display: 'flex',
        whiteSpace: 'nowrap',
        width: 'fit-content',
        animation: `stripScroll_${direction === 'right' ? 'rtl' : 'ltr'}_${speed || 2} ${duration}s linear infinite`,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}>
        {tripled.map((item, idx) => (
          <span key={idx} style={{
            display: 'inline-block',
            flexShrink: 0,
            padding: '0 3rem',
            fontSize: '1rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            {item.text}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes stripScroll_ltr_${speed || 2} {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes stripScroll_rtl_${speed || 2} {
          0% { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default function SlidingStrip() {
  const [strips, setStrips] = useState([]);

  useEffect(() => {
    fetchSlidingStripsContent().then((data) => {
      if (Array.isArray(data)) {
        setStrips(data);
      } else if (data && data.items) {
        setStrips([data]);
      } else {
        setStrips([]);
      }
    }).catch(() => {});
  }, []);

  if (!strips.length) return null;

  return (
    <>
      {strips.map((strip, idx) => (
        <Strip key={idx} config={strip} />
      ))}
    </>
  );
}
