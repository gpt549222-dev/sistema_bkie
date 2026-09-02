/**
 * Centralized Currency Formatter for BIKIE Papelería
 * Official Currency: FCFA (XAF)
 * Example outputs: 5.000 FCFA, 25.000 FCFA, 150.000 FCFA
 */

export const CURRENCY_CODE = 'XAF';
export const CURRENCY_SYMBOL = 'FCFA';

export function formatCurrency(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount) || 0;
  
  // Format with Spanish/European thousand separators (.) and decimal comma (,) if cents exist
  const formatted = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numeric);

  return `${formatted} FCFA`;
}

export function parseCurrencyInput(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  const clean = value.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
