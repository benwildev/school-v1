import { Decimal } from '@prisma/client/runtime/library';

/**
 * Currency representation for EduSmart BD
 */
export const DEFAULT_CURRENCY = 'BDT';
export const CURRENCY_SYMBOL_BDT = '৳';

/**
 * Converts any number, string, or Decimal to a safe Prisma Decimal rounded to 2 decimal places.
 */
export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value.toDecimalPlaces(2);
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid financial amount: not a finite number');
  }
  return new Decimal(num.toFixed(2));
}

/**
 * Exact addition of two monetary values
 */
export function addMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return toDecimal(a).add(toDecimal(b)).toDecimalPlaces(2);
}

/**
 * Exact subtraction of two monetary values (a - b)
 */
export function subMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return toDecimal(a).sub(toDecimal(b)).toDecimalPlaces(2);
}

/**
 * Exact multiplication of monetary value by multiplier
 */
export function mulMoney(a: number | string | Decimal, multiplier: number | string | Decimal): Decimal {
  return toDecimal(a).mul(toDecimal(multiplier)).toDecimalPlaces(2);
}

/**
 * Formats a monetary amount into standard Bangladesh format.
 * Examples:
 * formatMoney(1500, 'en') -> "৳ 1,500.00"
 * formatMoney(1500, 'bn') -> "৳ ১,৫০০.০০"
 */
export function formatMoney(
  amount: number | string | Decimal,
  locale: 'en' | 'bn' = 'bn',
  showSymbol = true
): string {
  const dec = toDecimal(amount);
  const num = dec.toNumber();

  const formattedNum = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return showSymbol ? `${CURRENCY_SYMBOL_BDT} ${formattedNum}` : formattedNum;
}
