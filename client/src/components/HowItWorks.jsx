import React, { useEffect, useState } from 'react';
import { fetchHowItWorks } from '../services/data';

export default function HowItWorks() {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchHowItWorks()
      .then((data) => {
        if (active) setSteps(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  return (
    <section id="how-it-works" className="section-padding" style={{ backgroundColor: '#fafafa', borderBottom: '2px solid var(--border-primary)', padding: '5rem 0' }}>
      <div className="container">
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="badge-sharp" style={{ marginBottom: '1rem' }}>PROCESS WORKFLOW</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>How It Works</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Our streamlined program enables you to jump-start your learning and certification in 4 simple steps.
          </p>
        </div>

        {steps.length === 0 ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No steps configured.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', position: 'relative' }}>
            {steps.map((step, idx) => (
              <div
                key={step.id || idx}
                className="card-sharp"
                style={{
                  padding: '2rem',
                  border: '2px solid #000',
                  backgroundColor: '#fff',
                  boxShadow: '4px 4px 0 #000',
                  position: 'relative'
                }}
              >
                {/* Step number badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-1.5rem',
                    left: '2rem',
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    backgroundColor: '#000',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    border: '2px solid #000'
                  }}
                >
                  {step.step || (idx + 1)}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
