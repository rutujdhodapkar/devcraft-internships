import React, { useEffect, useMemo, useState } from 'react';

// Prices are now in USD
const pricingModel = {
  software: {
    label: 'Software Projects',
    base: {
      basic:   { label: 'Basic',   priceUSD: 100,  desc: 'Working app with Firebase & basic AI/ML' },
      advance: { label: 'Advance', priceUSD: 250,  desc: 'Auth, admin dashboard, deployment & maintenance' },
      pro:     { label: 'Pro',     priceUSD: 400,  desc: 'Full-stack + advanced AI/ML + priority delivery' },
      custom:  { label: 'Custom',  priceUSD: null, desc: 'Fully scoped to your requirements' },
    },
    addons: [
      { id: 'firebase_db',       label: 'Firebase Database Expansion',  priceUSD: 100 },
      { id: 'basic_aiml',        label: 'Extra Basic AI/ML Module',      priceUSD: 150 },
      { id: 'admin_panel',       label: 'Custom Admin Dashboard',        priceUSD: 200 },
      { id: 'express_delivery',  label: 'Express Delivery Planning',     priceUSD: 120 },
    ],
  },
  documentation: {
    label: 'Project Documentation',
    base: {
      basic:   { label: 'Basic',   priceUSD: 50,   desc: 'Abstract, report, basic PPT' },
      advance: { label: 'Advance', priceUSD: 150,  desc: 'Full report, diagrams, maintenance' },
      pro:     { label: 'Pro',     priceUSD: 300,  desc: 'Research-paper style, slide deck, viva notes' },
      custom:  { label: 'Custom',  priceUSD: null, desc: 'Fully tailored to your format and scope' },
    },
    addons: [
      { id: 'latex_source',  label: 'LaTeX/Overleaf Source',    priceUSD: 60  },
      { id: 'slides_deck',   label: 'Custom Slide Deck',         priceUSD: 100 },
      { id: 'viva_notes',    label: 'Viva Notes and Q&A',        priceUSD: 50  },
      { id: 'diagrams',      label: 'Advanced Diagrams Pack',    priceUSD: 80  },
    ],
  },
};

export default function PricingCalculator({
  currency,
  rates,
  convertPrice,
  formatPrice,
  selectedCategory,
  setSelectedCategory,
  selectedTier,
  setSelectedTier,
  selectedAddons,
  setSelectedAddons,
  onCalculateTotal,
}) {
  const [activeCategory, setActiveCategory] = useState(selectedCategory || 'software');
  const [activeTier, setActiveTier] = useState(selectedTier || 'basic');
  const [activeAddons, setActiveAddons] = useState(selectedAddons || {});

  useEffect(() => {
    if (selectedCategory) setActiveCategory(selectedCategory);
    if (selectedTier) setActiveTier(selectedTier === 'advanced' ? 'advance' : selectedTier);
  }, [selectedCategory, selectedTier]);

  const categoryData = pricingModel[activeCategory];
  const tierData = categoryData.base[activeTier] || categoryData.base.basic;
  const isCustomTier = tierData.priceUSD === null;
  const basePrice = isCustomTier ? 0 : (tierData.priceUSD || 0);

  const addonsTotal = useMemo(
    () => categoryData.addons
      .filter((addon) => activeAddons[addon.id])
      .reduce((sum, addon) => sum + addon.priceUSD, 0),
    [activeAddons, categoryData.addons],
  );

  const totalUSD = basePrice + addonsTotal;
  const convertedTotal = convertPrice(totalUSD, currency, rates, 'USD');

  useEffect(() => {
    onCalculateTotal(totalUSD);
  }, [totalUSD, onCalculateTotal]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveTier('basic');
    setActiveAddons({});
    setSelectedCategory(cat);
    setSelectedTier('basic');
    setSelectedAddons({});
  };

  const handleTierChange = (tier) => {
    setActiveTier(tier);
    setSelectedTier(tier);
  };

  const handleAddonChange = (addonId) => {
    const updated = { ...activeAddons, [addonId]: !activeAddons[addonId] };
    setActiveAddons(updated);
    setSelectedAddons(updated);
  };

  return (
    <section id="calculator" className="section-padding calculator-section">
      <div className="container">
        <div className="section-heading fade-in-section">
          <h2>Dynamic Pricing Calculator</h2>
          <p>Choose your scope, add custom modules, and send the final service request.</p>
        </div>

        <div className="card-sharp fade-in-section calculator-card">
          <div className="grid-2">
            <div>
              <ControlLabel>1. Select Category</ControlLabel>
              <div className="button-row">
                {Object.keys(pricingModel).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={activeCategory === cat ? 'btn-sharp' : 'btn-sharp-outline'}
                    type="button"
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <ControlLabel>2. Select Service Tier</ControlLabel>
              <div className="stacked-options">
                {Object.entries(categoryData.base).map(([tKey, tier]) => (
                  <label key={tKey} className="custom-radio-label option-line">
                    <span>
                      <input
                        type="radio"
                        name="calculator_tier"
                        checked={activeTier === tKey}
                        onChange={() => handleTierChange(tKey)}
                      />
                      <span>
                        <strong>{tier.label}</strong>
                        <small style={{ display: 'block', fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {tier.desc}
                        </small>
                      </span>
                    </span>
                    {tier.priceUSD !== null ? (
                      <strong>{formatPrice(convertPrice(tier.priceUSD, currency, rates, 'USD'), currency)}</strong>
                    ) : (
                      <strong style={{ fontStyle: 'italic', fontWeight: 700 }}>Custom</strong>
                    )}
                  </label>
                ))}
              </div>

              <ControlLabel>3. Custom Add-ons</ControlLabel>
              <div className="stacked-options">
                {categoryData.addons.map((addon) => (
                  <label key={addon.id} className="custom-checkbox-label option-line">
                    <span>
                      <input
                        type="checkbox"
                        checked={!!activeAddons[addon.id]}
                        onChange={() => handleAddonChange(addon.id)}
                      />
                      {addon.label}
                    </span>
                    <strong>+{formatPrice(convertPrice(addon.priceUSD, currency, rates, 'USD'), currency)}</strong>
                  </label>
                ))}
              </div>
            </div>

            <div className="calculator-result-panel">
              <span className="badge-sharp badge-pulse">Instant Quote Estimate</span>

              {isCustomTier && addonsTotal === 0 ? (
                <>
                  <div className="quote-total custom-quote-display">Custom</div>
                  <p>Fill in the inquiry form below to get your personalised quote.</p>
                </>
              ) : (
                <>
                  <div className="quote-total">{formatPrice(convertedTotal, currency)}</div>
                  <p>Converted from USD using live rates when available.</p>
                </>
              )}

              <div className="quote-lines">
                <div>
                  <span>Base Pricing (USD)</span>
                  <strong>{isCustomTier ? 'Custom' : `$${basePrice.toLocaleString()}`}</strong>
                </div>
                <div>
                  <span>Add-ons Total (USD)</span>
                  <strong>${addonsTotal.toLocaleString()}</strong>
                </div>
                {!isCustomTier && (
                  <div>
                    <span>Total Base (USD)</span>
                    <strong>${totalUSD.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <a href="#contact" className="btn-sharp">
                {isCustomTier ? 'Request Custom Quote' : 'Get Service'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlLabel({ children }) {
  return <label className="control-label">{children}</label>;
}
