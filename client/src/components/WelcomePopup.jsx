import React from 'react';

const STEPS = [
  { num: 1, label: 'Choose Internship', desc: 'Pick a domain that matches your interest from our career paths.' },
  { num: 2, label: 'Complete First Task', desc: 'Finish your first beginner-friendly project and earn 100 XP.' },
  { num: 3, label: 'See Your Progress', desc: 'Track your XP, completed tasks, and level up as you go.' },
  { num: 4, label: 'Get Certificate', desc: 'Complete all tasks and earn your verified certificate.' },
];

const ARROW_DOWN = '\u2193';

export default function WelcomePopup({ show, onClose }) {
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
          boxShadow: '8px 8px 0 #000', width: '100%', maxWidth: '440px',
          position: 'relative',
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
        <div style={{ padding: '2rem 2rem 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px', marginBottom: '0.25rem' }}>Welcome!</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Follow these steps to get started</div>
          </div>

          {STEPS.map((step, i) => (
            <div key={step.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0' }}>
                <div
                  style={{
                    width: '44px', height: '44px', background: '#000', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '1.1rem', flexShrink: 0,
                    border: '2px solid #000',
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>{step.label}</div>
                  <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '0.15rem' }}>{step.desc}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 900, color: '#000', lineHeight: 1 }}>
                  {ARROW_DOWN}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={onClose}
            className="btn-sharp"
            style={{ width: '100%', padding: '0.85rem', fontWeight: 800, fontSize: '1rem', marginTop: '1.5rem', textTransform: 'uppercase' }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
