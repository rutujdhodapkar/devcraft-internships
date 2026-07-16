import LoadingText from "./LoadingText";
import React, { useEffect, useState } from 'react';
import { fetchCareerPaths, fetchHomepageSettings } from '../services/data';
import { getDomainIconUrl, hideOnError } from '../utils/domainIcons';
import { enrichProject, getTotalXp } from '../utils/taskEnricher';

const COLS = 3;

function PathCard({ path, onApply }) {
  return (
    <div className="card-sharp card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2.25rem', border: '2px solid #000', boxShadow: '4px 4px 0 #000', backgroundColor: '#fff', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span className="badge-sharp" style={{ backgroundColor: '#000', color: '#fff', fontSize: '0.8rem' }}>{path.duration || '4 Weeks'}</span>
          {Array.isArray(path.projects) && path.projects.length > 0 && (
            <span style={{ background: '#f59e0b', color: '#fff', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 800 }}>{getTotalXp(path.projects)}XP</span>
          )}
        </div>
        <img src={getDomainIconUrl(path)} alt="" width="56" height="56" style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '1rem' }} onError={hideOnError} />
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>{path.title}</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>{path.description}</p>
        <hr style={{ border: 'none', borderTop: '2px solid var(--border-secondary)', marginBottom: '1.5rem' }} />
        {Array.isArray(path.features) && path.features.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>What you will learn:</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {path.features.filter(Boolean).map((feat, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#000', fontWeight: 'bold' }}>■</span>{feat}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(path.projects) && path.projects.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.75rem', color: '#000' }}>Tasks ({path.projects.length}):</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {path.projects.map((proj, i) => {
                const enriched = enrichProject(proj, i);
                return (
                  <span key={i} className="badge-sharp" style={{ backgroundColor: '#f5f5f5', color: '#333', fontSize: '0.72rem', border: '1px solid #ccc', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {enriched.title || `Task ${i + 1}`}
                    <span style={{ background: '#f59e0b', color: '#fff', padding: '0.05rem 0.35rem', fontSize: '0.62rem', fontWeight: 800, marginLeft: '0.2rem' }}>{enriched.xp}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button type="button" className="btn-sharp" onClick={() => onApply(path)} style={{ width: '100%', padding: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Apply Now</button>
    </div>
  );
}

function ViewAllModal({ paths, categories, onClose, onApply }) {
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; };
  }, []);

  const filtered = filter === 'all' ? paths : paths.filter((p) => (p.category || '__uncategorized__') === filter);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 2000, overflowY: "auto", padding: "2rem 1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "1000px", position: "relative", marginTop: "2rem" }}>
        <div style={{ height: "6px", background: "#000" }} />
        <button onClick={onClose} style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10, background: "#000", border: "none", color: "#fff", width: "36px", height: "36px", cursor: "pointer", fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
        <div style={{ padding: "2rem" }}>
          <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.3rem", marginBottom: "1rem" }}>All Domains</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "2px solid #eee" }}>
            <button onClick={() => setFilter("all")} style={{ padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: filter === "all" ? "2px solid #000" : "2px solid #ddd", background: filter === "all" ? "#000" : "#fff", color: filter === "all" ? "#fff" : "#000", textTransform: "uppercase", letterSpacing: "0.5px" }}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setFilter(cat.id)} style={{ padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: filter === cat.id ? "2px solid #000" : "2px solid #ddd", background: filter === cat.id ? "#000" : "#fff", color: filter === cat.id ? "#fff" : "#000", textTransform: "uppercase", letterSpacing: "0.5px" }}>{cat.name}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888", padding: "2rem", fontStyle: "italic" }}>No domains in this category.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {filtered.map((path) => (
                <div key={path.id} className="card-sharp" style={{ padding: "1.5rem", border: "2px solid #000", boxShadow: "3px 3px 0 #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span className="badge-sharp" style={{ backgroundColor: "#000", color: "#fff", fontSize: "0.75rem", display: "inline-block" }}>{path.duration || '4 Weeks'}</span>
                    {Array.isArray(path.projects) && path.projects.length > 0 && (
                      <span style={{ background: "#f59e0b", color: "#fff", padding: "0.15rem 0.5rem", fontSize: "0.72rem", fontWeight: 800 }}>{getTotalXp(path.projects)}XP</span>
                    )}
                  </div>
                  <img src={getDomainIconUrl(path)} alt="" width="48" height="48" style={{ width: '48px', height: '48px', objectFit: 'contain', display: 'block', marginBottom: '0.75rem' }} onError={hideOnError} />
                  <h4 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "1.1rem", margin: "0.5rem 0" }}>{path.title}</h4>
                  <p style={{ fontSize: "0.82rem", color: "#666", lineHeight: "1.5", marginBottom: "1rem" }}>{path.description}</p>
                  <button type="button" className="btn-sharp" onClick={() => onApply(path)} style={{ width: "100%", padding: "0.6rem", fontWeight: 700, fontSize: "0.82rem" }}>Apply Now</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CareerPaths({ onApplyDomain, maxItems }) {
  const [paths, setPaths] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homepageSettings, setHomepageSettings] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCareerPaths(), fetchHomepageSettings()])
      .then(([data, hp]) => {
        if (active) {
          setPaths(data.paths || data || []);
          setCategories(data.categories || []);
          setHomepageSettings(hp || null);
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
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}><LoadingText text="Loading domains..." /></div>
        </div>
      </section>
    );
  }

  const enabledIds = homepageSettings?.visibleDomains || [];
  const featured = enabledIds.length > 0 ? paths.filter((p) => enabledIds.includes(p.id)) : paths.slice(0, maxItems || 3);
  const totalCount = paths.length;

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

        {featured.length === 0 ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No domains configured yet.</p>
        ) : (
          <>
            <div className="career-paths-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(COLS, featured.length)}, 1fr)`, gap: '2rem', marginTop: '1.5rem' }}>
              {featured.map((path) => (
                <PathCard key={path.id} path={path} onApply={onApplyDomain} />
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button type="button" className="btn-sharp" onClick={() => setShowAll(true)} style={{ padding: '0.85rem 3rem', fontWeight: 800, fontSize: '1rem' }}>
                Explore More ({totalCount} domains)
              </button>
            </div>
          </>
        )}
      </div>
      {showAll && <ViewAllModal paths={paths} categories={categories} onClose={() => setShowAll(false)} onApply={onApplyDomain} />}
    </section>
  );
}
