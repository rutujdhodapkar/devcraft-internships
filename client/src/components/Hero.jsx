import React, { useEffect, useState, useRef } from 'react';
import { fetchHomepageContent } from '../services/data';
import ShinyText from './ShinyText';

/* ─── Count-up hook ──────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  return value;
}

/* ─── Animated stat card ─────────────────────────────────────────── */
function AnimatedStat({ target, suffix = '', label, duration = 1800 }) {
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  const count = useCountUp(target, duration, started);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Format with commas
  const formatted = count.toLocaleString();

  return (
    <div ref={ref}>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#000', marginBottom: '0.25rem', letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
        {formatted}{suffix}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
export default function Hero({ onApplyClick, onExploreClick }) {
  const [content, setContent] = useState(null);
  const [hoveredButtonIdx, setHoveredButtonIdx] = useState(null);

  useEffect(() => {
    fetchHomepageContent().then(setContent).catch(() => setContent(null));
  }, []);

  const c = content || {};
  const buttons = c.buttons || [];
  const features = Array.isArray(c.features) ? c.features : [];

  const handleButtonClick = (action) => {
    if (action === 'apply' && onApplyClick) onApplyClick();
    else if (action === 'explore' && onExploreClick) onExploreClick();
  };

  return (
    <header className="section-padding hero-section" style={{ position: 'relative', overflow: 'hidden', borderBottom: '2px solid var(--border-primary)', backgroundColor: '#fff', padding: '7rem 0 5rem' }}>
      <div className="container">
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', marginBottom: '1.5rem', lineHeight: 1.05, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>
            {c.headline || "Kickstart Your Developer Career for free"}
          </h1>
          
          <p style={{ fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', marginBottom: '2.5rem', maxWidth: '750px', marginLeft: 'auto', marginRight: 'auto', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {c.description || "Gain hands-on software engineering experience, build real production-grade code, and receive verified completion credentials. Self-paced, industry-aligned, and 100% virtual."}
          </p>

          {/* Features Badges */}
          {features.length > 0 && (
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem', fontSize: '1rem', fontWeight: 700 }}>
              {features.map((feat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#34A853', fontSize: '1.3rem' }}>{feat.icon || ''}</span> {feat.label}
                </div>
              ))}
            </div>
          )}

          {/* Call to Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
            {buttons.filter((b) => b.enabled !== false).map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleButtonClick(btn.action)}
                className={idx === 0 ? "btn-sharp" : "btn-sharp-outline"}
                type="button"
                style={{ padding: '1rem 2.5rem', fontSize: '1rem', fontWeight: 'bold' }}
                onMouseEnter={() => setHoveredButtonIdx(idx)}
                onMouseLeave={() => setHoveredButtonIdx(null)}
              >
                {idx === 0 ? (
                  <ShinyText
                    text={btn.label}
                    speed={2.5}
                    delay={1}
                    color={hoveredButtonIdx === idx ? "#000000" : "#ffffff"}
                    shineColor={hoveredButtonIdx === idx ? "#000000cc" : "#ffffffcc"}
                    spread={90}
                    direction="left"
                    pauseOnHover
                  />
                ) : (
                  btn.label
                )}
              </button>
            ))}
          </div>

          {/* Stats Section — animated count-up */}
          <div style={{ borderTop: '2px dashed var(--border-secondary)', paddingTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <AnimatedStat target={10000} suffix="+" label="Active Learners" duration={1800} />
            <AnimatedStat target={7000}  suffix="+" label="Certificates Issued" duration={1600} />
            <AnimatedStat target={100}   suffix="%" label="Free & Open Access" duration={1400} />
          </div>
        </div>
      </div>
    </header>
  );
}
