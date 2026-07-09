import React, { useMemo, useState, useEffect } from 'react';
import { markReferralContacted, saveInquiry } from '../services/data';

const addonLabels = {
  firebase_db: 'Firebase Database Expansion',
  basic_aiml: 'Extra Basic AI/ML Module',
  admin_panel: 'Custom Admin Dashboard',
  express_delivery: 'Express Delivery Planning',
  latex_source: 'LaTeX/Overleaf Source',
  slides_deck: 'Custom Slide Deck',
  viva_notes: 'Viva Notes and Q&A',
  diagrams: 'Advanced Diagrams Pack',
};

export default function InquiryForm({
  currency,
  rates,
  convertPrice,
  formatPrice,
  category,
  tier,
  addons,
  totalUSD,
  referralCode,
  user,
}) {
  const [hasServiceLogin, setHasServiceLogin] = useState(false);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    city: '',
    techStack: '',
    projectType: '',
    deadline: '',
    budget: '',
    requirements: '',
  });

  // Prefill name and email from Google auth user
  useEffect(() => {
    if (user) {
      setForm((current) => ({
        ...current,
        name: current.name || user.displayName || '',
        email: current.email || user.email || '',
      }));
      // Auto-skip the login step if user is already signed in
      setHasServiceLogin(true);
    }
  }, [user]);

  const activeAddons = useMemo(
    () => Object.keys(addons).filter((key) => addons[key]).map((key) => addonLabels[key] || key),
    [addons],
  );

  // Convert from USD base to selected currency
  const convertedTotal = convertPrice(totalUSD, currency, rates, 'USD');
  const formattedTotal = totalUSD === 0 && tier === 'custom'
    ? 'Custom Quote'
    : formatPrice(convertedTotal, currency);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleServiceLogin = (event) => {
    event.preventDefault();
    if (!form.email || !form.phone) {
      setStatus({ success: false, text: 'Enter email and contact number to continue.' });
      return;
    }
    setStatus(null);
    setHasServiceLogin(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.requirements) {
      setStatus({ success: false, text: 'Name, email, contact number, and requirements are required.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    const payload = {
      ...form,
      projectType: form.projectType || category,
      selectedCategory: category,
      planTier: tier,
      customSpecs: activeAddons,
      estimatedPrice: totalUSD === 0 && tier === 'custom' ? 'Custom' : Number(convertedTotal.toFixed(2)),
      baseAmountUSD: totalUSD,
      currency,
      referralCode: referralCode || '',
      status: 'contacted',
      progress: 'New request',
      browser: navigator.userAgent,
      link: window.location.href,
    };

    try {
      const result = await saveInquiry(payload);
      await markReferralContacted(referralCode);
      setStatus({
        success: true,
        text: `Request saved. ID: ${result.id}. Contact the user and inform the team so delivery is not delayed.`,
      });
      setForm({
        name: user?.displayName || '',
        email: user?.email || '',
        phone: '',
        college: '',
        city: '',
        techStack: '',
        projectType: '',
        deadline: '',
        budget: '',
        requirements: '',
      });
      if (!user) setHasServiceLogin(false);
    } catch (error) {
      setStatus({ success: false, text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="section-padding contact-section">
      <div className="container service-login-wrap">
        {status?.success ? (
          <div className="card-sharp inquiry-success">
            <span className="badge-sharp">Saved</span>
            <h2>Service request saved.</h2>
            <p>{status.text}</p>
            <div className="button-row">
              <a href="https://contact.fennark.xyz" target="_blank" rel="noreferrer" className="btn-sharp">
                Contact User / Inform Team
              </a>
              <button
                type="button"
                className="btn-sharp-outline"
                onClick={() => {
                  setStatus(null);
                  if (!user) setHasServiceLogin(false);
                }}
              >
                New Custom Request
              </button>
            </div>
          </div>
        ) : !hasServiceLogin ? (
          <div className="login-root embedded-login">
            <div className="login-container">
              <div className="status-bar" />
              <div className="login-header">
                <div className="login-wordmark">DEV//CRAFT SERVICE</div>
                <h2 className="login-title">Get service.</h2>
                <p className="login-subtitle">Enter contact details first, then describe exactly what you want built.</p>
              </div>
              <form className="login-form" onSubmit={handleServiceLogin}>
                <div className="field-group">
                  <label className="field-label" htmlFor="service-email">Email</label>
                  <input
                    id="service-email"
                    className="field-input"
                    type="email"
                    value={form.email}
                    placeholder="you@domain.com"
                    onChange={(event) => updateForm('email', event.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="service-phone">Contact Number</label>
                  <input
                    id="service-phone"
                    className="field-input"
                    type="tel"
                    value={form.phone}
                    placeholder="+91 98765 43210"
                    onChange={(event) => updateForm('phone', event.target.value)}
                  />
                </div>
                {status && !status.success && <div className="error-msg">{status.text}</div>}
                <button className="btn-login" type="submit">Continue</button>
                <a className="btn-google" href="https://contact.fennark.xyz" target="_blank" rel="noreferrer">
                  Custom Contact
                </a>
              </form>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-sharp inquiry-card">
            <div className="inquiry-summary">
              <div>
                <span>Configured Spec</span>
                <h3>{category} — {tier}</h3>
                {activeAddons.length > 0 && <p>+ {activeAddons.join(', ')}</p>}
                {referralCode && <p>Referral: {referralCode}</p>}
                {user && (
                  <p style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#aaa' }}>
                    Signed in as {user.displayName}
                  </p>
                )}
              </div>
              <strong>{formattedTotal}</strong>
            </div>

            <div className="grid-2">
              <Field label="Name" value={form.name} onChange={(value) => updateForm('name', value)} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm('email', value)} required />
              <Field label="Contact Number" type="tel" value={form.phone} onChange={(value) => updateForm('phone', value)} required />
              <Field label="College" value={form.college} onChange={(value) => updateForm('college', value)} />
              <Field label="City" value={form.city} onChange={(value) => updateForm('city', value)} />
              <Field label="Project Type" value={form.projectType} onChange={(value) => updateForm('projectType', value)} placeholder="Web app, AI/ML, documentation..." />
              <Field label="All Tech Stack" value={form.techStack} onChange={(value) => updateForm('techStack', value)} placeholder="React, Firebase, Python, ML..." />
              <Field label="Deadline" type="date" value={form.deadline} onChange={(value) => updateForm('deadline', value)} />
              <Field label="Budget" value={form.budget} onChange={(value) => updateForm('budget', value)} placeholder="Expected budget" />
            </div>

            <div>
              <label className="form-label">What do you want?</label>
              <textarea
                className="input-sharp"
                rows={5}
                value={form.requirements}
                onChange={(event) => updateForm('requirements', event.target.value)}
                placeholder="Add features, pages, database needs, AI/ML model details, admin panel needs, deployment, documentation, and anything custom."
                required
              />
            </div>

            {status && (
              <div className={`form-status ${status.success ? 'success' : ''}`}>
                {status.text}
                {status.success && (
                  <a href="https://contact.fennark.xyz" target="_blank" rel="noreferrer" className="btn-sharp">
                    Contact User / Inform Team
                  </a>
                )}
              </div>
            )}

            <div className="button-row">
              <button type="submit" className="btn-sharp" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Request'}
              </button>
              <a href="https://contact.fennark.xyz" target="_blank" rel="noreferrer" className="btn-sharp-outline">
                Custom Contact
              </a>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}{required ? ' *' : ''}</label>
      <input
        id={id}
        className="input-sharp"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
