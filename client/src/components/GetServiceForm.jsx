import React, { useState, useEffect, useMemo } from 'react';
import { saveInquiry, markReferralContacted } from '../services/data';
import Services from './Services';

export default function GetServiceForm({
  user,
  currency,
  rates,
  convertPrice,
  formatPrice,
  referralCode,
  onBackToSite,
}) {
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  // Form Fields
  const [form, setForm] = useState({
    projectTitle: '',
    name: '',
    email: '',
    phone: '',
    college: '',
    city: '',
    techStack: '',
    deadline: '',
    budget: '',
    requirements: '',
  });

  // Services Selected
  const [softwareSelected, setSoftwareSelected] = useState(true);
  const [softwareTier, setSoftwareTier] = useState('basic');
  
  const [documentationSelected, setDocumentationSelected] = useState(false);
  const [documentationTier, setDocumentationTier] = useState('basic');

  const [customSelected, setCustomSelected] = useState(false);

  // Prefill details from user object and localStorage
  useEffect(() => {
    if (user) {
      const storedPhone = localStorage.getItem(`user_phone_${user.email.toLowerCase()}`) || '';
      setForm((current) => ({
        ...current,
        name: current.name || user.displayName || '',
        email: current.email || user.email || '',
        phone: current.phone || storedPhone || '',
      }));
    }
  }, [user]);

  const pricingModel = {
    software: {
      basic: 100,
      advance: 250,
      pro: 400,
      custom: 0,
    },
    documentation: {
      basic: 5,
      advance: 15,
      pro: 30,
      custom: 0,
    },
  };

  // Calculate Total USD & Custom Quote Flag
  const { totalUSD, isCustomQuote } = useMemo(() => {
    let total = 0;
    let custom = false;

    if (softwareSelected) {
      if (softwareTier === 'custom') {
        custom = true;
      } else {
        total += pricingModel.software[softwareTier] || 0;
      }
    }
    if (documentationSelected) {
      if (documentationTier === 'custom') {
        custom = true;
      } else {
        total += pricingModel.documentation[documentationTier] || 0;
      }
    }
    if (customSelected) {
      custom = true;
    }

    return { totalUSD: total, isCustomQuote: custom };
  }, [softwareSelected, softwareTier, documentationSelected, documentationTier, customSelected]);

  const convertedTotal = convertPrice(totalUSD, currency, rates, 'USD');
  
  // Format total pricing text
  const formattedTotalText = useMemo(() => {
    if (totalUSD === 0 && isCustomQuote) {
      return 'Custom Quote';
    }
    const baseFormatted = formatPrice(convertedTotal, currency);
    if (isCustomQuote) {
      return `${baseFormatted} + Custom Quote`;
    }
    return baseFormatted;
  }, [totalUSD, isCustomQuote, convertedTotal, currency, formatPrice]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.projectTitle || !form.name || !form.email || !form.phone || !form.requirements) {
      setStatus({ success: false, text: 'Project Title, Name, Email, Phone, and Requirements are required.' });
      return;
    }

    if (!softwareSelected && !documentationSelected && !customSelected) {
      setStatus({ success: false, text: 'Please select at least one service category.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    // Save phone number in localStorage if it changed
    if (form.phone && user?.email) {
      localStorage.setItem(`user_phone_${user.email.toLowerCase()}`, form.phone);
    }

    const selectedServices = [];
    if (softwareSelected) {
      selectedServices.push(`Software Project Service (${softwareTier.toUpperCase()})`);
    }
    if (documentationSelected) {
      selectedServices.push(`Documentation Service (${documentationTier.toUpperCase()})`);
    }
    if (customSelected) {
      selectedServices.push(`Custom/Other Service`);
    }

    const payload = {
      projectTitle: form.projectTitle,
      name: form.name,
      email: form.email,
      phone: form.phone,
      college: form.college,
      city: form.city,
      techStack: form.techStack,
      deadline: form.deadline,
      budget: (softwareSelected || documentationSelected) ? 'N/A' : form.budget,
      requirements: form.requirements,
      projectType: softwareSelected && documentationSelected ? 'both' : softwareSelected ? 'software' : documentationSelected ? 'documentation' : 'custom',
      planTier: softwareSelected && documentationSelected ? `${softwareTier}/${documentationTier}` : softwareSelected ? softwareTier : documentationSelected ? documentationTier : 'custom',
      customSpecs: selectedServices,
      estimatedPrice: isCustomQuote && totalUSD === 0 ? 'Custom' : Number(convertedTotal.toFixed(2)),
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
      if (referralCode) {
        await markReferralContacted(referralCode);
      }
      setStatus({
        success: true,
        text: `Your service request has been saved. ID: ${result.id}.`,
      });
    } catch (error) {
      setStatus({ success: false, text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section-padding get-service-section">
      <div className="container" style={{ maxWidth: '850px' }}>
        {status?.success ? (
          <div className="card-sharp inquiry-success" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
            <span className="badge-sharp" style={{ marginBottom: '1.25rem' }}>Saved Successfully</span>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Service Request Received!</h2>
            <p style={{ margin: '1.5rem auto', color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '600px', lineHeight: '1.6' }}>
              Your project scoping configuration has been logged. <strong>For payments, processing, and fast delivery setup, please contact our support team immediately here:</strong>
            </p>
            <div style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
              <a
                href="https://contact.fennark.xyz"
                target="_blank"
                rel="noreferrer"
                className="btn-sharp"
                style={{ padding: '1rem 2.5rem', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}
              >
                Contact for Payments &amp; Delivery
              </a>
            </div>
            <div className="button-row" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn-sharp-outline"
                onClick={() => {
                  setStatus(null);
                  setForm({
                    projectTitle: '',
                    name: user?.displayName || '',
                    email: user?.email || '',
                    phone: localStorage.getItem(`user_phone_${user?.email?.toLowerCase()}`) || '',
                    college: '',
                    city: '',
                    techStack: '',
                    deadline: '',
                    budget: '',
                    requirements: '',
                  });
                }}
              >
                New Request
              </button>
              <button type="button" className="btn-sharp-outline" onClick={onBackToSite}>
                Back to Website
              </button>
            </div>
          </div>
        ) : (
          <div className="card-sharp form-scoping-card">
            <div className="form-scoping-header" style={{ marginBottom: '2rem' }}>
              <span className="badge-sharp">Get Service</span>
              <h2 style={{ marginTop: '0.5rem' }}>Configure &amp; Request Service</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Specify your project description, stack, and timeline. You can combine multiple tiers or submit a fully custom request.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="scoping-form">
              <div className="field-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="proj-title">Project Title *</label>
                <input
                  id="proj-title"
                  className="input-sharp"
                  type="text"
                  placeholder="E.g., AI Powered E-Commerce Portal"
                  value={form.projectTitle}
                  onChange={(e) => updateForm('projectTitle', e.target.value)}
                  required
                />
              </div>

              {/* Service Selection Grid */}
              <div className="service-selection-grid" style={{ marginBottom: '2rem' }}>
                {/* Software Box */}
                <div className={`card-sharp service-selector-box ${softwareSelected ? 'active' : ''}`}>
                  <label className="selector-checkbox-label">
                    <input
                      type="checkbox"
                      checked={softwareSelected}
                      onChange={(e) => setSoftwareSelected(e.target.checked)}
                    />
                    <strong>Software Project Service</strong>
                  </label>
                  {softwareSelected && (
                    <div className="tier-radio-group">
                      <label>
                        <input
                          type="radio"
                          name="soft-tier"
                          checked={softwareTier === 'basic'}
                          onChange={() => setSoftwareTier('basic')}
                        />
                        <span>Basic ($100)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="soft-tier"
                          checked={softwareTier === 'advance'}
                          onChange={() => setSoftwareTier('advance')}
                        />
                        <span>Advance ($250)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="soft-tier"
                          checked={softwareTier === 'pro'}
                          onChange={() => setSoftwareTier('pro')}
                        />
                        <span>Pro ($400)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="soft-tier"
                          checked={softwareTier === 'custom'}
                          onChange={() => setSoftwareTier('custom')}
                        />
                        <span>Custom Quote</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Documentation Box */}
                <div className={`card-sharp service-selector-box ${documentationSelected ? 'active' : ''}`}>
                  <label className="selector-checkbox-label">
                    <input
                      type="checkbox"
                      checked={documentationSelected}
                      onChange={(e) => setDocumentationSelected(e.target.checked)}
                    />
                    <strong>Technical Documentation Service</strong>
                  </label>
                  {documentationSelected && (
                    <div className="tier-radio-group">
                      <label>
                        <input
                          type="radio"
                          name="doc-tier"
                          checked={documentationTier === 'basic'}
                          onChange={() => setDocumentationTier('basic')}
                        />
                        <span>Basic ($5)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="doc-tier"
                          checked={documentationTier === 'advance'}
                          onChange={() => setDocumentationTier('advance')}
                        />
                        <span>Advance ($15)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="doc-tier"
                          checked={documentationTier === 'pro'}
                          onChange={() => setDocumentationTier('pro')}
                        />
                        <span>Pro ($30)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="doc-tier"
                          checked={documentationTier === 'custom'}
                          onChange={() => setDocumentationTier('custom')}
                        />
                        <span>Custom Quote</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom checkbox box */}
              <div className="service-selection-grid" style={{ marginBottom: '1.5rem' }}>
                <div className={`card-sharp service-selector-box ${customSelected ? 'active' : ''}`} style={{ gridColumn: '1 / -1' }}>
                  <label className="selector-checkbox-label">
                    <input
                      type="checkbox"
                      checked={customSelected}
                      onChange={(e) => setCustomSelected(e.target.checked)}
                    />
                    <strong>Custom / Other Service</strong>
                  </label>
                  {customSelected && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Tell us what you want in the description box below and we will customize everything for you.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right', marginBottom: '2rem' }}>
                <button
                  type="button"
                  className="btn-sharp-outline"
                  onClick={() => setShowServicesModal(true)}
                  style={{ fontSize: '0.85rem' }}
                >
                  View Services Details
                </button>
              </div>

              {/* Price Estimate Banner */}
              <div className="quote-estimator-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '4px', marginBottom: '2rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Estimated Total ({currency})
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-accent)' }}>
                    {formattedTotalText}
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  Base USD Amount: <strong>${totalUSD}</strong>
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid-2">
                <div>
                  <label className="form-label" htmlFor="scoped-name">Your Name *</label>
                  <input
                    id="scoped-name"
                    className="input-sharp"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-email">Your Email *</label>
                  <input
                    id="scoped-email"
                    className="input-sharp"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-phone">Contact / Phone Number *</label>
                  <input
                    id="scoped-phone"
                    className="input-sharp"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-college">Institution / College Name (Optional)</label>
                  <input
                    id="scoped-college"
                    className="input-sharp"
                    value={form.college}
                    onChange={(e) => updateForm('college', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-city">City</label>
                  <input
                    id="scoped-city"
                    className="input-sharp"
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-tech">Preferred Tech Stack</label>
                  <input
                    id="scoped-tech"
                    className="input-sharp"
                    placeholder="React, Node.js, Python, Firebase..."
                    value={form.techStack}
                    onChange={(e) => updateForm('techStack', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="scoped-deadline">Target Deadline</label>
                  <input
                    id="scoped-deadline"
                    className="input-sharp"
                    type="date"
                    value={form.deadline}
                    onChange={(e) => updateForm('deadline', e.target.value)}
                  />
                </div>
                
                {/* Condition: if no standard service is selected, show budget option */}
                {!(softwareSelected || documentationSelected) && (
                  <div>
                    <label className="form-label" htmlFor="scoped-budget">Approximate Budget</label>
                    <input
                      id="scoped-budget"
                      className="input-sharp"
                      placeholder="Expected budget range"
                      value={form.budget}
                      onChange={(e) => updateForm('budget', e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <label className="form-label" htmlFor="scoped-req">What do you want built? (Project Description) *</label>
                <textarea
                  id="scoped-req"
                  className="input-sharp"
                  rows={5}
                  value={form.requirements}
                  onChange={(e) => updateForm('requirements', e.target.value)}
                  placeholder="Describe your project, core features, database needs, dashboard expectations, documentation formats, etc."
                  required
                />
              </div>

              {status && !status.success && (
                <div className="error-msg" style={{ marginTop: '1.5rem' }}>
                  {status.text}
                </div>
              )}

              <div className="button-row" style={{ marginTop: '2.5rem' }}>
                <button type="submit" className="btn-sharp" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving Request...' : 'Get Service'}
                </button>
                <button type="button" className="btn-sharp-outline" onClick={onBackToSite}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Services popup modal */}
      {showServicesModal && (
        <div className="modal-overlay" onClick={() => setShowServicesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: '1200px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', background: 'var(--bg-primary)', padding: '2.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
            <button
              onClick={() => setShowServicesModal(false)}
              className="modal-close-btn"
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
              type="button"
            >
              &times;
            </button>
            <Services
              currency={currency}
              rates={rates}
              convertPrice={convertPrice}
              formatPrice={formatPrice}
              onSelectTier={(category, tier) => {
                if (category === 'software') {
                  setSoftwareSelected(true);
                  setSoftwareTier(tier);
                } else if (category === 'documentation') {
                  setDocumentationSelected(true);
                  setDocumentationTier(tier);
                }
                setShowServicesModal(false);
              }}
              isModalView={true}
            />
          </div>
        </div>
      )}
    </section>
  );
}
