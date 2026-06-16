import React, { useState } from 'react';

export default function EarnSection({ user, userProfile, onLoginClick }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    phone: userProfile?.phone || '',
    city: userProfile?.city || '',
    upiId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const inputStyle = {
    border: '2px solid #000',
    padding: '0.6rem 0.75rem',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setError('Please sign in first to create a referral code.');
      return;
    }
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setError('Name, Email, and Phone are required.');
      return;
    }
    setSubmitting(true);
    try {
      const { createSelfReferral } = await import('../services/data');
      const res = await createSelfReferral(formData, user.uid);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setResult(null);
    setError('');
  };

  return (
    <section id="earn" className="section-padding" style={{ backgroundColor: '#fff', borderBottom: '2px solid #000', padding: '5rem 0' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge-sharp" style={{ marginBottom: '1rem', backgroundColor: '#000', color: '#fff' }}>REFERRAL PROGRAM</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Earn with Referrals</h2>
          <p style={{ color: '#555', maxWidth: '600px', margin: '0.5rem auto 0', fontSize: '1rem', lineHeight: '1.6' }}>
            Share your unique referral link with friends and classmates. When they enroll through your link, you earn rewards!
          </p>
        </div>

        <div style={{
          border: '2px solid #000',
          boxShadow: '6px 6px 0 #000',
          padding: '2.5rem',
          background: '#fafafa',
          textAlign: 'center',
        }}>
          {result ? (
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34A853', marginBottom: '1rem' }}>
                Referral Code Created!
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '4px', background: '#000', color: '#fff', display: 'inline-block', padding: '0.5rem 1.5rem', marginBottom: '1.5rem' }}>
                {result.code}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1rem' }}>
                Share this link with your friends:
              </div>
              <div style={{
                background: '#fff',
                border: '2px solid #000',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                fontWeight: 700,
                wordBreak: 'break-all',
                marginBottom: '1.5rem',
                userSelect: 'all',
              }}>
                {window.location.origin}/?ref={result.code}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-sharp"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?ref=${result.code}`);
                    alert('Referral link copied!');
                  }}
                  style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem' }}
                >
                  Copy Link
                </button>
                <button
                  className="btn-sharp-outline"
                  onClick={resetForm}
                  style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem' }}
                >
                  Create Another
                </button>
              </div>
            </div>
          ) : !showForm ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000' }}>1</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Sign up & get your unique code</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000' }}>2</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Share your link with friends</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000' }}>3</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>They enroll & earn rewards</div>
                </div>
              </div>
              <button
                className="btn-sharp"
                onClick={() => {
                  if (!user) {
                    onLoginClick();
                    return;
                  }
                  setShowForm(true);
                }}
                style={{ padding: '1rem 3rem', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                Generate My Referral Code
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ border: '2px solid #EA4335', padding: '0.75rem', color: '#EA4335', fontWeight: 'bold', fontSize: '0.85rem', background: '#FFF5F5' }}>
                  {error}
                </div>
              )}
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>Full Name *</label>
                <input type="text" placeholder="Your full name" value={formData.name} onChange={e => handleChange('name', e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>Email *</label>
                <input type="email" placeholder="your@email.com" value={formData.email} onChange={e => handleChange('email', e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>Phone *</label>
                <input type="tel" placeholder="Phone number with country code" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>City</label>
                <input type="text" placeholder="Your city" value={formData.city} onChange={e => handleChange('city', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>UPI ID (for rewards)</label>
                <input type="text" placeholder="name@upi" value={formData.upiId} onChange={e => handleChange('upiId', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-sharp" disabled={submitting} style={{ flex: 1, padding: '0.8rem', fontSize: '0.95rem' }}>
                  {submitting ? 'Creating...' : 'Generate Code'}
                </button>
                <button type="button" className="btn-sharp-outline" onClick={resetForm} style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
