import React, { useEffect, useState } from 'react';
import { fetchCareerPaths } from '../services/data';

export default function CareerPaths({ onApplyDomain }) {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCareerPaths()
      .then((data) => {
        if (active) setPaths(data.paths || data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section id="domains" className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid var(--border-primary)' }}>
        <div className="container" style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Loading domains...</div>
        </div>
      </section>
    );
  }

  // Determine grid template: if paths length is greater than or equal to 3, show 3 columns.
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: paths.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${paths.length}, 1fr)`,
    gap: '2rem',
    marginTop: '3rem'
  };

  return (
    <section id="domains" className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid var(--border-primary)', padding: '5rem 0' }}>
      <div className="container">
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge-sharp" style={{ marginBottom: '1rem' }}>AVAILABLE DOMAINS</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Explore Career Paths</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Select a learning domain, enroll instantly, and start building software engineering projects to earn your credentials.
          </p>
        </div>

        {paths.length === 0 ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No domains configured yet.</p>
        ) : (
          <div className="career-paths-grid" style={gridStyle}>
            {paths.map((path) => (
              <div
                key={path.id}
                className="card-sharp card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '2.25rem',
                  border: '2px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  backgroundColor: '#fff',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <span className="badge-sharp" style={{ backgroundColor: '#000', color: '#fff', fontSize: '0.8rem' }}>
                      {path.duration || '4 Weeks'}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      100% Free
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>
                    {path.title}
                  </h3>
                  
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    {path.description}
                  </p>

                  <hr style={{ border: 'none', borderTop: '2px solid var(--border-secondary)', marginBottom: '1.5rem' }} />

                  {/* Skills/Features */}
                  {path.features && path.features.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>
                        What you will learn:
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {path.features.map((feat, i) => (
                          <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                            <span style={{ color: '#000', fontWeight: 'bold' }}>■</span>
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tasks/Projects */}
                  {path.projects && path.projects.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>
                        Hands-on Projects:
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {path.projects.map((proj, i) => (
                          <span key={i} className="badge-sharp" style={{ backgroundColor: '#f5f5f5', color: '#333', fontSize: '0.72rem', border: '1px solid #ccc', padding: '0.2rem 0.5rem' }}>
                            {typeof proj === 'object' && proj !== null ? (proj.title || proj.name || `Task ${i + 1}`) : proj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-sharp"
                  onClick={() => onApplyDomain(path)}
                  style={{ width: '100%', padding: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}
                >
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
