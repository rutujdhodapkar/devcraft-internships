import React, { useEffect, useState } from 'react';
import { fetchSiteConfig } from '../services/data';

const DEFAULT_REWARDS = [
  { xp: 3000, label: 'Bronze Badge', desc: 'Complete 1 internship' },
  { xp: 6000, label: 'Silver Badge', desc: 'Complete 2 internships' },
  { xp: 12000, label: 'Gold Badge', desc: 'Complete 4 internships' },
  { xp: 25000, label: 'Platinum Badge', desc: 'Complete 8 internships' },
  { xp: 50000, label: 'Diamond Badge', desc: 'Complete 16 internships' },
  { xp: 100000, label: 'Master Badge', desc: 'Complete 32 internships' },
];

function XpDetailsModal({ show, onClose, xpConfig }) {
  const milestones = xpConfig?.milestones || DEFAULT_REWARDS;

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; };
  }, [show]);

  if (!show) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 2000, overflowY: "auto", padding: "2rem 1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "600px", position: "relative", marginTop: "2rem", maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}>
        <div style={{ height: "6px", background: "#000" }} />
        <button onClick={onClose} style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10, background: "#000", border: "none", color: "#fff", width: "36px", height: "36px", cursor: "pointer", fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
        <div style={{ padding: "2rem" }}>
          <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.3rem", marginBottom: "0.5rem" }}>XP Rewards Details</h3>
          <p style={{ fontSize: "0.88rem", color: "#666", marginBottom: "1.5rem" }}>Explore all XP milestones, how to earn, and what you can unlock.</p>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", padding: "1rem", border: "2px solid #000", background: "#000", color: "#fff" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#f59e0b" }}>Your Gained XP: 0</div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#ccc" }}>XP will be counted after payment</div>
            </div>
          </div>

          <h4 style={{ fontWeight: 800, fontSize: "1rem", textTransform: "uppercase", marginBottom: "1rem" }}>All Milestones</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.5rem" }}>
            {milestones.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", border: "2px solid #000", background: "#fafafa", boxShadow: "2px 2px 0 #000" }}>
                <div style={{ width: "70px", textAlign: "center", fontWeight: 900, fontSize: "0.85rem", color: "#f59e0b", flexShrink: 0 }}>{r.xp.toLocaleString()} XP</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", textTransform: "uppercase" }}>Exclusive reward hidden</div>
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>Complete tasks to unlock</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "1.25rem", border: "2px solid #000", background: "#fffde7", marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>How to Earn XP</div>
            <div style={{ fontSize: "0.82rem", color: "#555", lineHeight: "1.8" }}>
              {(xpConfig?.instructions || [
                'Enroll in any free internship domain',
                'Complete each task (submit your work)',
                'Earn 100 XP per verified task',
                'Unlock badges at XP milestones',
                'Get your certificate after completing all tasks'
              ]).map((inst, i) => (
                <div key={i} style={{ marginBottom: "0.25rem" }}>{i + 1}. {inst}</div>
              ))}
            </div>
          </div>

          <button onClick={onClose} className="btn-sharp" style={{ width: "100%", padding: "0.75rem", fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function RewardsSection() {
  const [xpConfig, setXpConfig] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const milestones = xpConfig?.milestones || DEFAULT_REWARDS;

  useEffect(() => {
    fetchSiteConfig('xpRewards')
      .then((d) => { if (d) setXpConfig(d); })
      .catch(() => {});
  }, []);

  return (
    <section id="xp-rewards" className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid var(--border-primary)', padding: '5rem 0' }}>
      <div className="container">
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge-sharp" style={{ marginBottom: '1rem', background: '#f59e0b', color: '#fff' }}>XP REWARDS</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Earn XP & Unlock Rewards</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Complete tasks to earn experience points (XP) and unlock badges, certificates, and more.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div className="card-sharp" style={{ padding: '2rem', textAlign: 'center', border: '2px solid #000', boxShadow: '4px 4px 0 #000', background: '#000', color: '#fff' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.25rem', color: '#f59e0b' }}>{'\u2B50'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#ccc' }}>Level Up</div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Unlock achievements as you progress</div>
          </div>
          <div className="card-sharp" style={{ padding: '2rem', textAlign: 'center', border: '2px solid #000', boxShadow: '4px 4px 0 #000' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.25rem' }}>{'\uD83C\uDFC6'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Certificates</div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Complete all tasks and get your verified certificate</div>
          </div>
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Rewards Milestones</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px', margin: '0 auto' }}>
          {milestones.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem', border: '2px solid #000', background: '#fafafa', boxShadow: '3px 3px 0 #000' }}>
              <div style={{ width: '80px', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', color: '#f59e0b', flexShrink: 0 }}>
                {r.xp.toLocaleString()} XP
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>Exclusive reward hidden</div>
                <div style={{ fontSize: '0.78rem', color: '#888' }}>Complete tasks to unlock</div>
              </div>
              <div style={{ fontSize: '1.5rem' }}>{i < milestones.length - 1 ? '\u2192' : '\uD83C\uDFC6'}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            type="button"
            className="btn-sharp"
            onClick={() => setShowDetails(true)}
            style={{ padding: '0.85rem 3rem', fontWeight: 800, fontSize: '1rem' }}
          >
            Explore More
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', padding: '1.5rem', border: '2px solid #000', background: '#fffde7', maxWidth: '600px', margin: '1.5rem auto 0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Progress Tracking</div>
          <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: '1.6', textAlign: 'left' }}>
            <div style={{ marginBottom: '0.4rem' }}>1. Complete tasks and submit your work</div>
            <div style={{ marginBottom: '0.4rem' }}>2. Get verified by the team</div>
            <div style={{ marginBottom: '0.4rem' }}>3. Reach milestones to unlock rewards</div>
            <div style={{ marginBottom: '0.4rem' }}>4. Complete all tasks to get your certificate</div>
          </div>
        </div>
      </div>
      <XpDetailsModal show={showDetails} onClose={() => setShowDetails(false)} xpConfig={xpConfig} />
    </section>
  );
}
