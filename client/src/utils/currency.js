const countryToCurrency = {
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

const currencySymbols = {
  USD: '$',
  INR: 'Rs.',
  EUR: 'EUR ',
  GBP: 'GBP ',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: 'JPY ',
  CNY: 'CNY ',
  SGD: 'S$',
  AED: 'AED ',
  ZAR: 'R',
  NZD: 'NZ$',
  CHF: 'CHF ',
  SEK: 'SEK ',
  NOK: 'NOK ',
  BRL: 'R$',
  MXN: 'Mex$',
};

export async function detectUserCurrency() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('IP lookup failed');
    const data = await response.json();
    return countryToCurrency[data.country_code] || 'USD';
  } catch (error) {
    console.warn('Geolocation detection failed, defaulting to USD:', error.message);
    return 'USD';
  }
}

export async function fetchExchangeRates() {
  try {
    const response = await fetch('http://localhost:5000/api/rates');
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
