/**
 * Unified Formatting and Unit Standard Utility for Construction Management
 * Standardizes:
 * - Indian Rupee (INR - ₹) currency formatting using Intl.NumberFormat('en-IN')
 * - Number and quantity formatting
 * - Construction material unit definitions and validations
 */

export const STANDARD_UNITS = [
  'kg',
  'tonne',
  'bags',
  'pieces',
  'litres',
  'cubic metres',
  'square metres',
  'metres'
];

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const inrPreciseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2
});

/**
 * Formats a monetary value to Indian Rupees (₹)
 * @param {number|string} amount
 * @param {boolean} [precise=false] If true, always includes 2 decimal places
 * @returns {string} e.g. "₹25,000" or "₹25,000.50"
 */
export const formatCurrency = (amount, precise = false) => {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return precise ? inrPreciseFormatter.format(num) : inrFormatter.format(num);
};

/**
 * Formats a numerical quantity with Indian grouping
 * @param {number|string} value
 * @returns {string} e.g. "1,50,000"
 */
export const formatNumber = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return numberFormatter.format(num);
};

/**
 * Formats quantity together with unit
 * @param {number|string} qty
 * @param {string} unit
 * @returns {string} e.g. "100 kg"
 */
export const formatQuantity = (qty, unit = '') => {
  return `${formatNumber(qty)} ${unit}`.trim();
};
