import React, { useState } from 'react';

const COUNTRY_NAMES = [
  'India', 'United States', 'United Kingdom', 'Australia', 'Canada', 'Germany', 'France',
  'Singapore', 'UAE', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Other',
].sort();

export default function EarnSection({ user, userProfile, onLoginClick }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    phone: userProfile?.phone || '',
    college: userProfile?.college || '',
    city: userProfile?.city || '',
    country: userProfile?.country || '',
    upiId: userProfile?.upiId || '',
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
    const required = ['name', 'email', 'phone', 'college', 'city', 'country', 'upiId'];
    const missing = required.filter((key) => !String(formData[key] || '').trim());
    if (missing.length > 0) {
      setError('Name, email, phone, college, city, country, and UPI ID are all required.');
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
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Refer &amp; Earn</h2>
          <p style={{ color: '#555', maxWidth: '600px', margin: '0.5rem auto 0', fontSize: '1rem', lineHeight: '1.6' }}>
            Share your unique referral link with friends and classmates. When they enroll and complete their internship, you earn cash rewards directly to your UPI.
          </p>
        </div>

        <div id="referral-rewards" style={{
          border: '2px solid #000',
          boxShadow: '4px 4px 0 #000',
          padding: '1.5rem',
          background: '#fff',
          marginBottom: '2rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' }}>Reward Structure</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ border: '2px solid #34A853', padding: '1rem', background: '#EBFCEF' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#34A853' }}>₹20</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.35rem' }}>Per referred intern who completes their internship</div>
            </div>
            <div style={{ border: '2px solid #000', padding: '1rem', background: '#fafafa' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#000' }}>₹1,000</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.35rem' }}>Bonus when 50 referred interns complete their internship</div>
            </div>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#444', marginTop: '1rem', lineHeight: 1.6 }}>
            Example: if 50 referred interns complete their internship, you earn ₹20 × 50 = ₹1,000 plus the ₹1,000 milestone bonus —{' '}
            <a href="#referral-rewards" style={{ color: '#000', fontWeight: 800, textDecoration: 'underline' }}>
              ₹2,000 total per 50 completed interns
            </a>.
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Apply with your details &amp; UPI ID</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000' }}>2</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Share your referral link</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '1.5rem', background: '#fff' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000' }}>3</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Earn ₹20 per completion + milestone bonuses</div>
                </div>
              </div>
              <button
                className="btn-sharp"
                onClick={() => {
                  if (!user) {
                    onLoginClick();
                    return;
                  }
                  setFormData({
                    name: user?.displayName || '',
                    email: user?.email || '',
                    phone: userProfile?.phone || '',
                    college: userProfile?.college || '',
                    city: userProfile?.city || '',
                    country: userProfile?.country || '',
                    upiId: userProfile?.upiId || '',
                  });
                  setShowForm(true);
                }}
                style={{ padding: '1rem 3rem', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                Apply for Refer &amp; Earn
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ border: '2px solid #EA4335', padding: '0.75rem', color: '#EA4335', fontWeight: 'bold', fontSize: '0.85rem', background: '#FFF5F5' }}>
                  {error}
                </div>
              )}
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com' },
                { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: 'Phone with country code' },
                { key: 'college', label: 'College / University', type: 'text', placeholder: 'E.g., IIT Bombay' },
                { key: 'city', label: 'City', type: 'text', placeholder: 'Your city' },
                { key: 'upiId', label: 'UPI ID', type: 'text', placeholder: 'name@upi' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>{label} *</label>
                  <input type={type} placeholder={placeholder} value={formData[key]} onChange={e => handleChange(key, e.target.value)} style={inputStyle} required />
                </div>
              ))}
              <div>
                <label style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem', textAlign: 'left' }}>Country *</label>
                <select value={formData.country} onChange={e => handleChange('country', e.target.value)} style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }} required>
                  <option value="">Select your country…</option>
                  {COUNTRY_NAMES.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-sharp" disabled={submitting} style={{ flex: 1, padding: '0.8rem', fontSize: '0.95rem' }}>
                  {submitting ? 'Submitting...' : 'Apply & Generate Code'}
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
