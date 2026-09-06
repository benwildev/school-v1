import { TransportBoardingStatus } from '@prisma/client';

export { TransportBoardingStatus };

export const TRANSPORT_BOARDING_STATUS_LABELS: Record<
  TransportBoardingStatus,
  { en: string; bn: string; isAlert: boolean }
> = {
  [TransportBoardingStatus.BOARDED]: {
    en: 'Boarded',
    bn: 'উঠেছে (বোর্ডেড)',
    isAlert: false,
  },
  [TransportBoardingStatus.NOT_BOARDED]: {
    en: 'Not Boarded',
    bn: 'বাসে ওঠেনি (নট বোর্ডেড)',
    isAlert: true,
  },
  [TransportBoardingStatus.PICKED_UP]: {
    en: 'Picked Up',
    bn: 'তুলে নেওয়া হয়েছে',
    isAlert: false,
  },
  [TransportBoardingStatus.DROPPED_OFF]: {
    en: 'Dropped Off',
    bn: 'গন্তব্যে নেমেছে',
    isAlert: false,
  },
  [TransportBoardingStatus.ABSENT]: {
    en: 'Absent',
    bn: 'অনুপস্থিত',
    isAlert: true,
  },
  [TransportBoardingStatus.UNKNOWN]: {
    en: 'Unknown',
    bn: 'অজ্ঞাত',
    isAlert: false,
  },
};

/**
 * Determines whether a transport boarding status constitutes an alert condition
 * (requiring guardian notification).
 */
export function isTransportAlertStatus(status: TransportBoardingStatus | string): boolean {
  return (
    status === TransportBoardingStatus.NOT_BOARDED ||
    status === TransportBoardingStatus.ABSENT
  );
}

/**
 * Returns localized label for a transport boarding status.
 */
export function formatTransportBoardingStatus(
  status: TransportBoardingStatus,
  locale: 'en' | 'bn' = 'bn'
): string {
  const meta = TRANSPORT_BOARDING_STATUS_LABELS[status];
  if (!meta) return String(status);
  return locale === 'en' ? meta.en : meta.bn;
}
