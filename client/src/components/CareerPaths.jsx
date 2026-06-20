import React, { useEffect, useState } from 'react';
import { fetchCareerPaths } from '../services/data';

const INITIAL_ROWS = 3;
const COLS = 3;
const INITIAL_VISIBLE = INITIAL_ROWS * COLS;

function PathCard({ path, onApply }) {
  return (
    <div className="card-sharp card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2.25rem', border: '2px solid #000', boxShadow: '4px 4px 0 #000', backgroundColor: '#fff', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span className="badge-sharp" style={{ backgroundColor: '#000', color: '#fff', fontSize: '0.8rem' }}>{path.duration || '4 Weeks'}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>100% Free</span>
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>{path.title}</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>{path.description}</p>
        <hr style={{ border: 'none', borderTop: '2px solid var(--border-secondary)', marginBottom: '1.5rem' }} />
        {path.features && path.features.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>What you will learn:</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {path.features.map((feat, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#000', fontWeight: 'bold' }}>■</span>{feat}
                </li>
              ))}
            </ul>
          </div>
        )}
        {path.projects && path.projects.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>Hands-on Projects:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {path.projects.map((proj, i) => (
                <span key={i} className="badge-sharp" style={{ backgroundColor: '#f5f5f5', color: '#333', fontSize: '0.72rem', border: '1px solid #ccc', padding: '0.2rem 0.5rem' }}>{typeof proj === 'object' && proj !== null ? (proj.title || proj.name || `Task ${i + 1}`) : proj}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <button type="button" className="btn-sharp" onClick={() => onApply(path)} style={{ width: '100%', padding: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Apply Now</button>
    </div>
  );
}

function CategorySection({ category, paths, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paths.length : Math.min(paths.length, INITIAL_VISIBLE);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.min(COLS, paths.length)}, 1fr)`,
    gap: '2rem',
    marginTop: '1.5rem'
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      {category.name && (
        <div style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase' }}>{category.name}</h3>
          {category.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{category.description}</p>}
        </div>
      )}
      <div className="career-paths-grid" style={gridStyle}>
        {paths.slice(0, visible).map((path) => (
          <PathCard key={path.id} path={path} onApply={onApply} />
        ))}
      </div>
      {paths.length > INITIAL_VISIBLE && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button type="button" className="btn-sharp" onClick={() => setExpanded(!expanded)} style={{ padding: '0.6rem 2rem', fontWeight: 800, fontSize: '0.85rem' }}>
            {expanded ? `Show Less` : `Show More (${paths.length - INITIAL_VISIBLE} more)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CareerPaths({ onApplyDomain }) {
  const [paths, setPaths] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCareerPaths()
      .then((data) => {
        if (active) {
          setPaths(data.paths || data || []);
          setCategories(data.categories || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
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

  const catMap = {};
  (categories || []).forEach((cat) => { catMap[cat.id] = cat; });

  const grouped = {};
  (paths || []).forEach((p) => {
    const catId = p.category || '__uncategorized__';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(p);
  });

  const sections = Object.entries(grouped).map(([catId, catPaths]) => ({
    category: catId === '__uncategorized__' ? { id: '', name: '', description: '' } : (catMap[catId] || { id: catId, name: catId, description: '' }),
    paths: catPaths,
  }));

  const orderedSections = [];
  (categories || []).forEach((cat) => {
    const idx = sections.findIndex((s) => s.category.id === cat.id);
    if (idx !== -1) { orderedSections.push(sections[idx]); sections.splice(idx, 1); }
  });
  orderedSections.push(...sections);

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

        {orderedSections.length === 0 ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No domains configured yet.</p>
        ) : (
          orderedSections.map((section, idx) => (
            <CategorySection key={section.category.id || `section_${idx}`} category={section.category} paths={section.paths} onApply={onApplyDomain} />
          ))
        )}
      </div>
    </section>
  );
}
