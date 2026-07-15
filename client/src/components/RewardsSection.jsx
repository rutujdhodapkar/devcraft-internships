import React from 'react';

const REWARDS = [
  { xp: 500, label: 'Bronze Badge', desc: 'Complete 5 tasks' },
  { xp: 1000, label: 'Silver Badge', desc: 'Complete 10 tasks' },
  { xp: 2500, label: 'Gold Badge', desc: 'Complete 25 tasks' },
  { xp: 5000, label: 'Platinum Badge', desc: 'Complete 50 tasks' },
  { xp: 10000, label: 'Master Badge', desc: 'Complete 100 tasks' },
];

export default function RewardsSection() {
  return (
    <section className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid var(--border-primary)', padding: '5rem 0' }}>
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
            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.25rem', color: '#f59e0b' }}>100</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#ccc' }}>XP Per Task</div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Every task you complete earns 100 XP</div>
          </div>
          <div className="card-sharp" style={{ padding: '2rem', textAlign: 'center', border: '2px solid #000', boxShadow: '4px 4px 0 #000' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.25rem' }}>{'\u2B50'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Level Up</div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Earn XP to level up and unlock new achievements</div>
          </div>
          <div className="card-sharp" style={{ padding: '2rem', textAlign: 'center', border: '2px solid #000', boxShadow: '4px 4px 0 #000' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.25rem' }}>{'\uD83C\uDFC6'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Certificates</div>
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Complete all tasks and get your verified certificate</div>
          </div>
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Rewards Milestones</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px', margin: '0 auto' }}>
          {REWARDS.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem', border: '2px solid #000', background: '#fafafa', boxShadow: '3px 3px 0 #000' }}>
              <div style={{ width: '60px', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', color: '#f59e0b', flexShrink: 0 }}>
                {r.xp.toLocaleString()} XP
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>{r.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#888' }}>{r.desc}</div>
              </div>
              <div style={{ fontSize: '1.5rem' }}>{i < REWARDS.length - 1 ? '\u2192' : '\uD83C\uDFC6'}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem', padding: '1.5rem', border: '2px solid #000', background: '#fffde7', maxWidth: '600px', margin: '2.5rem auto 0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' }}>How XP Works</div>
          <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: '1.6', textAlign: 'left' }}>
            <div style={{ marginBottom: '0.4rem' }}>1. Enroll in any internship domain (free)</div>
            <div style={{ marginBottom: '0.4rem' }}>2. Complete each task and submit your work</div>
            <div style={{ marginBottom: '0.4rem' }}>3. Earn 100 XP per verified task</div>
            <div style={{ marginBottom: '0.4rem' }}>4. Reach milestones to unlock badges</div>
            <div style={{ marginBottom: '0.4rem' }}>5. Complete all tasks to get your certificate</div>
          </div>
        </div>
      </div>
    </section>
  );
}
