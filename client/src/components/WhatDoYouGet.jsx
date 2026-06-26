import React, { useEffect, useState } from 'react';
import { fetchWhatDoYouGet } from '../services/data';

function BoxCard({ box }) {
  return (
    <div style={{ border: '2px solid #000', padding: '1.5rem', boxShadow: '4px 4px 0 #000', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {box.imageUrl && (
        <div style={{ width: '100%', height: '160px', overflow: 'hidden', border: '1px solid #000' }}>
          <img src={box.imageUrl} alt={box.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>{box.title}</h3>
      {box.subtitle && <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#555', margin: 0 }}>{box.subtitle}</p>}
      {box.description && <p style={{ fontSize: '0.95rem', color: '#333', margin: 0, lineHeight: 1.5 }}>{box.description}</p>}
      {box.note && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: '#000', padding: '0.2rem 0.6rem', display: 'inline-block', alignSelf: 'flex-start', textTransform: 'uppercase' }}>{box.note}</span>}
    </div>
  );
}

export default function WhatDoYouGet() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchWhatDoYouGet().then((d) => {
      if (d) setData(d);
    }).catch(() => {});
  }, []);

  if (!data || data.enabled === false) return null;

  const { title, subtitle, pages } = data;

  return (
    <section className="section-padding" style={{ borderBottom: '2px solid var(--border-primary)', background: '#fff' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 1rem' }}>
        {title && <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.5rem' }}>{title}</h2>}
        {subtitle && <p style={{ fontSize: '1.05rem', color: '#555', textAlign: 'center', marginBottom: '3rem', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>{subtitle}</p>}

        {(pages || []).map((page, idx) => (
          <div key={idx} style={{ marginBottom: idx < (pages || []).length - 1 ? '4rem' : 0 }}>
            {page.title && <h3 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{page.title}</h3>}
            {page.subtitle && <p style={{ fontSize: '0.9rem', color: '#555', fontWeight: 700, marginBottom: '1.5rem' }}>{page.subtitle}</p>}

            {page.type === 'side-by-side' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                <div style={{ border: '2px solid #000', padding: '1.5rem', boxShadow: '4px 4px 0 #000', background: '#fff' }}>
                  {page.imageUrl && (
                    <div style={{ width: '100%', height: '200px', overflow: 'hidden', border: '1px solid #000', marginBottom: '1rem' }}>
                      <img src={page.imageUrl} alt={page.boxTitle || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{page.boxTitle}</h4>
                  {page.boxSubtitle && <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#555', marginBottom: '0.5rem' }}>{page.boxSubtitle}</p>}
                  {page.boxDescription && <p style={{ fontSize: '0.95rem', color: '#333', lineHeight: 1.5 }}>{page.boxDescription}</p>}
                  {page.boxNote && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: '#000', padding: '0.2rem 0.6rem', display: 'inline-block', marginTop: '0.75rem', textTransform: 'uppercase' }}>{page.boxNote}</span>}
                </div>
                <div>
                  {page.description && <p style={{ fontSize: '1rem', color: '#333', lineHeight: 1.7, marginBottom: '1rem' }}>{page.description}</p>}
                  {page.note && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: '#000', padding: '0.2rem 0.6rem', display: 'inline-block', textTransform: 'uppercase' }}>{page.note}</span>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {(page.boxes || []).map((box, bIdx) => (
                  <BoxCard key={bIdx} box={box} />
                ))}
              </div>
            )}
          </div>
        ))}

        {(!pages || !pages.length) && (
          <p style={{ color: '#888', textAlign: 'center', fontStyle: 'italic' }}>No content added yet.</p>
        )}
      </div>
    </section>
  );
}
