export const PESO = '₱';

const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Formats a number as Philippine pesos, e.g. 1482.5 -> "₱1,482.50"
export function peso(amount) {
  const value = Number(amount) || 0;
  return `${value < 0 ? '-' : ''}${PESO}${formatter.format(Math.abs(value))}`;
}
