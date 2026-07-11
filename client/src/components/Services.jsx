import LoadingText from "./LoadingText";
import React, { useEffect, useState } from 'react';
import { fetchServices } from '../services/data';

export default function Services({ currency, rates, convertPrice, formatPrice, onSelectTier, isModalView = false }) {
  const [services, setServices] = useState(null);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingServices(true);
    fetchServices()
      .then((data) => { if (!cancelled) setServices(data); })
      .catch(() => { if (!cancelled) setServices(null); })
      .finally(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, []);

  const renderTierCard = (tier) => {
    const convertedPrice = tier.priceUSD !== null
      ? convertPrice(tier.priceUSD, currency, rates, 'USD')
      : null;
    const formattedPrice = convertedPrice !== null ? formatPrice(convertedPrice, currency) : null;

    return (
      <div key={`${tier.category || 'tier'}-${tier.tierKey}`} className="card-sharp card-interactive service-card">
        {tier.popular && <span className="badge-sharp badge-pulse popular-badge">POPULAR SPEC</span>}

        <div>
          <h3>{tier.title}</h3>
          <div className="tier-price">
            {formattedPrice !== null ? (
              <>
                <span className="price-tag">{formattedPrice}</span>
                <span> base price</span>
              </>
            ) : (
              <span className="price-tag custom-price-tag" style={{ background: '#000', color: '#fff', fontSize: '1.25rem', padding: '0.1rem 0.5rem', fontStyle: 'italic' }}>
                Custom Quote
              </span>
            )}
          </div>
          <p>{tier.description}</p>
          <hr />
          <ul>
            {(Array.isArray(tier.features) ? tier.features : []).map((feat) => (
              <li key={feat}>
                <span className="feature-square">■</span>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => onSelectTier(tier.category || 'software', tier.tierKey)}
          className="btn-sharp"
          type="button"
        >
          {tier.tierKey === 'custom' ? 'Request Quote' : isModalView ? 'Select Tier' : 'Get Service'}
        </button>
      </div>
    );
  };

  const servicesData = services || { software: [], documentation: [] };
  const softwareTiers = (servicesData.software || []).map((t) => ({ ...t, category: 'software' }));
  const documentationTiers = (servicesData.documentation || []).map((t) => ({ ...t, category: 'documentation' }));

  return (
    <section id="services" className={`services-section ${isModalView ? '' : 'section-padding'}`}>
      <div className={isModalView ? '' : 'container'}>
        <div className="section-heading fade-in-section">
          <h2>Service Tiers</h2>
          <p>Choose Basic, Advance, Pro, or Custom — then configure your project requirements dynamically.</p>
        </div>

        {loadingServices ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}><LoadingText text="Loading services..." /></div>
        ) : (
          <>
            <div className="fade-in-section service-group" style={{ marginBottom: '3rem' }}>
              <div className="service-group-title">
                <span className="badge-sharp">Category 01</span>
                <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>Software Project Services</h2>
              </div>
              <div className="grid-4">{softwareTiers.map(renderTierCard)}</div>
            </div>

            <div className="fade-in-section">
              <div className="service-group-title">
                <span className="badge-sharp">Category 02</span>
                <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>Technical Documentation Services</h2>
              </div>
              <div className="grid-4">{documentationTiers.map(renderTierCard)}</div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
