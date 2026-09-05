/**
 * Formatting utilities for reports, exports, and dashboards.
 * Target Locale: Bangladesh (Asia/Dhaka, UTC+06:00), Currency: BDT (৳)
 */

const BANGLA_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/**
 * Converts Western digits to Bengali digits.
 */
export function toBanglaDigits(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\d/g, (d) => BANGLA_NUMERALS[parseInt(d, 10)] || d);
}

/**
 * Formats a numeric amount to BDT currency.
 * Avoids floating-point artifacts by converting to string representation.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: { locale?: 'en' | 'bn'; showSymbol?: boolean } = {}
): string {
  const { locale = 'en', showSymbol = true } = options;
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return showSymbol ? (locale === 'bn' ? '৳০.০০' : '৳0.00') : (locale === 'bn' ? '০.০০' : '0.00');
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  if (locale === 'bn') {
    const bnFormatted = toBanglaDigits(formatted);
    return showSymbol ? `৳${bnFormatted}` : bnFormatted;
  }

  return showSymbol ? `৳${formatted}` : formatted;
}

/**
 * Formats a percentage value.
 */
export function formatPercentage(
  rate: number | string | null | undefined,
  options: { locale?: 'en' | 'bn'; decimals?: number } = {}
): string {
  const { locale = 'en', decimals = 1 } = options;
  if (rate === null || rate === undefined || isNaN(Number(rate))) {
    return locale === 'bn' ? '০.০%' : '0.0%';
  }
  const val = typeof rate === 'string' ? parseFloat(rate) : rate;
  const fixed = val.toFixed(decimals);
  return locale === 'bn' ? `${toBanglaDigits(fixed)}%` : `${fixed}%`;
}

/**
 * Formats a date string or object to Asia/Dhaka time.
 */
export function formatDateDhaka(
  date: Date | string | null | undefined,
  options: { locale?: 'en' | 'bn'; includeTime?: boolean } = {}
): string {
  if (!date) return '-';
  const { locale = 'en', includeTime = false } = options;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  // Format in Asia/Dhaka timezone
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      : {}),
  };

  const formatted = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-US', dateOptions).format(d);
  return formatted;
}

/**
 * Formats standard numbers with thousands separators.
 */
export function formatNumber(
  num: number | string | null | undefined,
  locale: 'en' | 'bn' = 'en'
): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return locale === 'bn' ? '০' : '0';
  }
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  const formatted = new Intl.NumberFormat('en-BD').format(n);
  return locale === 'bn' ? toBanglaDigits(formatted) : formatted;
}
