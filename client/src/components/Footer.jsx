import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '2px solid var(--border-primary)',
      padding: '4rem 0',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontFamily: 'Space Grotesk', marginBottom: '1rem' }}>DEV/CRAFT</h3>
            <p style={{ maxWidth: '300px', fontSize: '0.9rem' }}>
              Premium 100% free virtual internships for university and college students. Gain verified work experience, finish structured projects, and get certified.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontFamily: 'Space Grotesk', marginBottom: '1rem' }}>Domains</h4>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><a href="#domains" style={{ color: 'var(--text-secondary)' }}>Python Development</a></li>
                <li><a href="#domains" style={{ color: 'var(--text-secondary)' }}>Java Development</a></li>
                <li><a href="#domains" style={{ color: 'var(--text-secondary)' }}>Web Development</a></li>
              </ul>
            </div>
            
            <div>
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontFamily: 'Space Grotesk', marginBottom: '1rem' }}>Offices</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Digital Platform - Remote</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Support: <a href="https://contact.rutujdhodapkar.tech" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>contact.rutujdhodapkar.tech</a>
              </p>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '2px solid var(--border-secondary)',
          paddingTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            &copy; {new Date().getFullYear()} DEV/CRAFT. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
