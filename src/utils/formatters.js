/**
 * Currency and Number Formatters
 * Formats amounts using Intl.NumberFormat and CURRENCY_CODE (default PHP)
 */

export function formatFee(amount) {
  const num = Number(amount) || 0;
  if (num <= 0) {
    return 'Free';
  }

  const currencyCode = import.meta.env.VITE_CURRENCY_CODE || process.env.CURRENCY_CODE || 'PHP';

  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₱${num.toFixed(2)}`;
  }
}
