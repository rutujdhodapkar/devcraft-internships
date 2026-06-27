import React, { useEffect, useState } from 'react';
import { fetchUniversityCollab } from '../services/data';

export default function UniversityCollab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchUniversityCollab().then((d) => {
      if (d) setData(d);
    }).catch(() => {});
  }, []);

  if (!data || data.enabled === false) return null;

  const { title, subtitle, description, imageUrl, buttonText, buttonRedirectUrl, mailtoLink } = data;

  return (
    <section className="section-padding" style={{ borderBottom: '2px solid var(--border-primary)', background: '#fafafa' }}>
      <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '5rem 1rem' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.5rem' }}>{title || 'University Collaborations'}</h2>
        {subtitle && <p style={{ fontSize: '1.05rem', color: '#555', textAlign: 'center', marginBottom: '2.5rem' }}>{subtitle}</p>}

        <div style={{ border: '3px solid #000', padding: '2.5rem', boxShadow: '6px 6px 0 #000', background: '#fff', textAlign: 'center' }}>
          {imageUrl && (
            <div style={{ width: '100%', maxHeight: '250px', overflow: 'hidden', border: '2px solid #000', marginBottom: '1.5rem' }}>
              <img src={imageUrl} alt={title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: '250px' }} onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <p style={{ fontSize: '1.1rem', color: '#333', lineHeight: 1.7, maxWidth: '650px', margin: '0 auto 2rem' }}>
            {description || 'Join leading universities and colleges that trust DEV/CRAFT for industry-aligned virtual internships.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {buttonRedirectUrl && (
              <a href={buttonRedirectUrl} target="_blank" rel="noopener noreferrer" className="btn-sharp" style={{ display: 'inline-block', padding: '1rem 2.5rem', fontSize: '1rem', fontWeight: 700, textDecoration: 'none' }}>
                {buttonText || 'Partner With Us'}
              </a>
            )}
            {mailtoLink && (
              <a href={`mailto:${mailtoLink}`} className="btn-sharp-outline" style={{ display: 'inline-block', padding: '1rem 2.5rem', fontSize: '1rem', fontWeight: 700, textDecoration: 'none' }}>
                Email Us
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
