import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

import './CircularText.css';

const CircularText = ({ text, spinDuration = 20, onHover = 'speedUp', className = '', radius = 80, fontSize = 16 }) => {
  const letters = Array.from(text);
  const containerRef = useRef(null);
  const angle = useMotionValue(0);
  const speedMult = useMotionValue(1);
  const smoothSpeed = useSpring(speedMult, { damping: 20, stiffness: 300 });

  useEffect(() => {
    let rafId;
    let last = performance.now();

    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      const mult = smoothSpeed.get();
      angle.set((angle.get() + (360 / spinDuration) * mult * dt) % 360);

      const deg = angle.get();
      const step = (2 * Math.PI) / letters.length;
      const rad = (deg * Math.PI) / 180;
      const spans = containerRef.current?.querySelectorAll('span');
      if (spans) {
        spans.forEach((span, i) => {
          const theta = rad + step * i;
          const x = radius * Math.cos(theta);
          const y = radius * Math.sin(theta);
          span.style.transform = `translate(${x}px, ${y}px)`;
        });
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [spinDuration, radius, letters.length, angle, smoothSpeed]);

  const handleHoverStart = () => {
    if (!onHover) return;
    const map = { slowDown: 0.5, speedUp: 4, pause: 0, goBonkers: 20 };
    speedMult.set(map[onHover] ?? 1);
  };

  const handleHoverEnd = () => {
    speedMult.set(1);
  };

  return (
    <motion.div
      ref={containerRef}
      className={`circular-text ${className}`}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
    >
      {letters.map((letter, i) => (
        <span key={i} style={{ fontSize }}>{letter}</span>
      ))}
    </motion.div>
  );
};

export default CircularText;
