export const countryToCurrency = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  CN: 'CNY',
  SG: 'SGD',
  AE: 'AED',
  ZA: 'ZAR',
  NZ: 'NZD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  BR: 'BRL',
  MX: 'MXN',
};

export const currencySymbols = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
  CNY: 'CN¥',
  SGD: 'S$',
  AED: 'د.إ',
  ZAR: 'R',
  NZD: 'NZ$',
  CHF: 'CHF ',
  SEK: 'SEK ',
  NOK: 'NOK ',
  BRL: 'R$',
  MXN: 'Mex$',
};

const countryToDialCode = {
  IN: '+91', US: '+1', GB: '+44', DE: '+49', FR: '+33',
  IT: '+39', ES: '+34', NL: '+31', CA: '+1', AU: '+61',
  JP: '+81', CN: '+86', SG: '+65', AE: '+971', ZA: '+27',
  NZ: '+64', CH: '+41', SE: '+46', NO: '+47', BR: '+55',
  MX: '+52', RU: '+7', KR: '+82', SA: '+966', NG: '+234',
  KE: '+254', EG: '+20', PK: '+92', BD: '+880', LK: '+94',
  NP: '+977', TH: '+66', VN: '+84', PH: '+63', MY: '+60',
  ID: '+62',
};

let cachedGeo = null;

async function fetchGeo() {
  if (cachedGeo) return cachedGeo;
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('IP lookup failed');
    const data = await res.json();
    if (data.country_code) {
      cachedGeo = data;
      return data;
    }
  } catch (e) {
    console.warn('IP geolocation failed:', e.message);
  }
  return null;
}

export async function detectUserCountry() {
  const geo = await fetchGeo();
  return geo?.country_code || null;
}

export async function detectUserCurrency() {
  try {
    const geo = await fetchGeo();
    if (geo?.country_code && countryToCurrency[geo.country_code]) {
      return countryToCurrency[geo.country_code];
    }
    return 'USD';
  } catch (error) {
    console.warn('Currency detection failed, defaulting to USD:', error.message);
    return 'USD';
  }
}

export async function detectDialCode() {
  try {
    const geo = await fetchGeo();
    if (geo?.country_code && countryToDialCode[geo.country_code]) {
      return countryToDialCode[geo.country_code];
    }
  } catch {}
  return null;
}

const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

export async function fetchExchangeRates() {
  try {
    const response = await fetch(`${API_BASE}/api/rates`);
    if (!response.ok) throw new Error('Failed to fetch backend rates');
    const data = await response.json();
    if (data.success && data.rates) return data.rates;
  } catch (error) {
    console.error('Backend exchange rates call failed, using fallback:', error.message);
  }

  return {
    USD: 1.0,
    INR: 83.5,
    EUR: 0.93,
    GBP: 0.79,
    CAD: 1.37,
    AUD: 1.51,
    JPY: 157.4,
  };
}

export function convertPrice(basePrice, targetCurrency, rates, baseCurrency = 'USD') {
  const activeRates = {
    USD: 1.0,
    INR: 83.5,
    ...(rates || {}),
  };
  if (!activeRates[targetCurrency]) return basePrice;
  if (baseCurrency === 'USD') return basePrice * activeRates[targetCurrency];

  const baseRate = activeRates[baseCurrency] || 1;
  const baseInUsd = basePrice / baseRate;
  return baseInUsd * activeRates[targetCurrency];
}

export function formatPrice(amount, currencyCode) {
  const symbol = currencySymbols[currencyCode] || '$';
  const formattedAmount = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formattedAmount}`;
}
