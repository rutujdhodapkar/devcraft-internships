import React, { useEffect, useState } from 'react';
import { fetchHomepageContent } from '../services/data';

export default function Hero({ onApplyClick, onExploreClick }) {
  const [content, setContent] = useState(null);

  useEffect(() => {
    fetchHomepageContent().then(setContent).catch(() => setContent(null));
  }, []);

  const c = content || {};
  const buttons = c.buttons || [];
  const badges = c.badges || [];
  const features = c.features || [];

  const handleButtonClick = (action) => {
    if (action === 'apply' && onApplyClick) onApplyClick();
    else if (action === 'explore' && onExploreClick) onExploreClick();
  };

  return (
    <header className="section-padding hero-section" style={{ borderBottom: '2px solid var(--border-primary)', backgroundColor: '#fff', padding: '6rem 0 5rem' }}>
      <div className="container">
        <div style={{ maxWidth: '950px', margin: '0 auto', textAlign: 'center' }}>
          {/* Badge Taglines */}
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {badges.map((badge, idx) => (
                <span key={idx} className="badge-sharp" style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.35rem 0.85rem', backgroundColor: idx % 2 === 1 ? '#000' : undefined, color: idx % 2 === 1 ? '#fff' : undefined }}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', marginBottom: '1.5rem', lineHeight: 1.05, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>
            {c.headline || "Kickstart Your Developer Career with Virtual Internships."}
          </h1>
          
          <p style={{ fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', marginBottom: '2.5rem', maxWidth: '750px', marginLeft: 'auto', marginRight: 'auto', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {c.description || "Gain hands-on software engineering experience, build real production-grade code, and receive verified completion credentials. Self-paced, industry-aligned, and 100% virtual."}
          </p>

          {/* Features Badges */}
          {features.length > 0 && (
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem', fontSize: '1rem', fontWeight: 700 }}>
              {features.map((feat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#34A853', fontSize: '1.3rem' }}>{feat.icon || '✓'}</span> {feat.label}
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
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Stats Section */}
          <div style={{ borderTop: '2px dashed var(--border-secondary)', paddingTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#000', marginBottom: '0.25rem' }}>10,000+</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Learners</div>
            </div>
            <div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#000', marginBottom: '0.25rem' }}>7,000+</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Certificates Issued</div>
            </div>
            <div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#000', marginBottom: '0.25rem' }}>100%</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Free &amp; Open Access</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
