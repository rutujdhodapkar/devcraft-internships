import React, { useEffect, useState } from 'react';
import { fetchFAQs } from '../services/data';

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    let active = true;
    fetchFAQs()
      .then((data) => {
        if (active) setFaqs(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (loading) return null;

  return (
    <section id="faq" className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid var(--border-primary)', padding: '5rem 0' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="badge-sharp" style={{ marginBottom: '1rem' }}>COMMON QUESTIONS</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Frequently Asked Questions</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto 0' }}>
            Got questions? We have answers. If you need further support, please reach out.
          </p>
        </div>

        {faqs.length === 0 ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No FAQs configured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.id || idx}
                  style={{
                    border: '2px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    backgroundColor: '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleFAQ(idx)}
                    style={{
                      width: '100%',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                  >
                    <span>{faq.question}</span>
                    <span style={{ fontSize: '1.25rem', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>+</span>
                  </button>

                  <div
                    style={{
                      maxHeight: isOpen ? '300px' : '0',
                      overflow: 'hidden',
                      transition: 'max-height 0.25s ease-out',
                      borderTop: isOpen ? '2px solid #000' : 'none',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <div style={{ padding: '1.5rem', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
