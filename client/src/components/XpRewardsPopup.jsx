import React from 'react';

const REWARDS = [
  { xp: 5000, label: 'Bronze Badge', desc: 'Complete 50 tasks' },
  { xp: 10000, label: 'Silver Badge', desc: 'Complete 100 tasks' },
  { xp: 25000, label: 'Gold Badge', desc: 'Complete 250 tasks' },
  { xp: 50000, label: 'Platinum Badge', desc: 'Complete 500 tasks' },
  { xp: 100000, label: 'Master Badge', desc: 'Complete 1000 tasks' },
];

export default function XpRewardsPopup({ show, onClose }) {
  if (!show) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 3000, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', border: '3px solid #000',
          boxShadow: '8px 8px 0 #000', width: '100%', maxWidth: '480px',
          position: 'relative', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10,
            background: '#000', border: 'none', color: '#fff', width: '32px',
            height: '32px', cursor: 'pointer', fontSize: '1.2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
        <div style={{ height: '6px', background: '#000' }} />
        <div style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>Earn XP & Rewards</div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>Complete tasks to earn XP and unlock badges</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', border: '2px solid #000', background: '#000', color: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>100</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#ccc' }}>XP Per Task</div>
            </div>
            <div style={{ width: '1px', height: '40px', background: '#444' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>15 min</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#ccc' }}>Avg Time</div>
            </div>
            <div style={{ width: '1px', height: '40px', background: '#444' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>Free</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#ccc' }}>Cost</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>Rewards Milestones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {REWARDS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', border: '2px solid #000', background: '#fafafa', boxShadow: '2px 2px 0 #000' }}>
                <div style={{ width: '60px', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem', color: '#f59e0b', flexShrink: 0 }}>
                  {r.xp.toLocaleString()} XP
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>{r.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', border: '2px solid #000', background: '#fffde7' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>How it works:</div>
            <div style={{ fontSize: '0.8rem', color: '#555', lineHeight: '1.8' }}>
              1. Enroll in any domain <strong>free</strong><br />
              2. Complete tasks, earn <strong>100 XP each</strong><br />
              3. Unlock badges at milestones<br />
              4. Get your <strong>certificate</strong> on completion
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-sharp"
            style={{ width: '100%', padding: '0.8rem', fontWeight: 800, fontSize: '0.95rem', marginTop: '1.25rem', textTransform: 'uppercase' }}
          >
            Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
