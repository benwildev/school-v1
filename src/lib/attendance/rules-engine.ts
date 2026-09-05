import { AttendanceStatus } from '@prisma/client';

export interface AttendanceRuleConfig {
  startTime: string; // 'HH:MM:SS' or 'HH:MM'
  lateThresholdMinutes: number; // e.g. 15
  halfDayThresholdMinutes: number; // e.g. 120
  gracePeriodMinutes?: number; // e.g. 5
  endTime?: string;
  workingDays?: string[]; // ['SUNDAY', 'MONDAY', ...]
  checkoutRequired?: boolean;
}

export interface AttendanceStatusEvaluation {
  status: AttendanceStatus;
  lateMinutes: number;
  isHalfDay: boolean;
  remarks?: string;
}

/**
 * Returns the current date in Asia/Dhaka as 'YYYY-MM-DD'.
 */
export function getDhakaDateString(date: Date = new Date()): string {
  // Asia/Dhaka is UTC+6
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dhakaTime = new Date(utc + 6 * 3600000);
  const year = dhakaTime.getFullYear();
  const month = String(dhakaTime.getMonth() + 1).padStart(2, '0');
  const day = String(dhakaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the time in Asia/Dhaka as 'HH:MM:SS'.
 */
export function getDhakaTimeString(date: Date = new Date()): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dhakaTime = new Date(utc + 6 * 3600000);
  const hours = String(dhakaTime.getHours()).padStart(2, '0');
  const minutes = String(dhakaTime.getMinutes()).padStart(2, '0');
  const seconds = String(dhakaTime.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Converts 'HH:MM:SS' or 'HH:MM' to total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Evaluates attendance status (PRESENT, LATE, HALF_DAY) based on check-in time and configurable school rules.
 */
export function evaluateAttendanceStatus(
  checkInTimeStr: string,
  rule: AttendanceRuleConfig
): AttendanceStatusEvaluation {
  const checkInMinutes = timeStringToMinutes(checkInTimeStr);
  const startMinutes = timeStringToMinutes(rule.startTime);
  const graceMinutes = rule.gracePeriodMinutes || 0;

  const diffMinutes = checkInMinutes - startMinutes;

  // On time (within start time or grace period)
  if (diffMinutes <= graceMinutes) {
    return {
      status: AttendanceStatus.PRESENT,
      lateMinutes: 0,
      isHalfDay: false,
    };
  }

  // Arrival exceeded half-day threshold
  if (diffMinutes >= rule.halfDayThresholdMinutes) {
    return {
      status: AttendanceStatus.HALF_DAY,
      lateMinutes: diffMinutes,
      isHalfDay: true,
      remarks: `Arrived ${diffMinutes} minutes after school start time (exceeded half-day limit of ${rule.halfDayThresholdMinutes}m)`,
    };
  }

  // Arrival exceeded late threshold
  if (diffMinutes > rule.lateThresholdMinutes) {
    return {
      status: AttendanceStatus.LATE,
      lateMinutes: diffMinutes,
      isHalfDay: false,
      remarks: `Arrived ${diffMinutes} minutes late (exceeded threshold of ${rule.lateThresholdMinutes}m)`,
    };
  }

  // Between grace period and late threshold: still marked PRESENT, but lateMinutes recorded
  return {
    status: AttendanceStatus.PRESENT,
    lateMinutes: diffMinutes,
    isHalfDay: false,
  };
}

/**
 * Checks if a given date is a working day according to rule configuration.
 * Bangladesh standard work week: Sunday to Thursday (Friday & Saturday are weekends).
 */
export function isWorkingDay(date: Date, workingDays?: string[]): boolean {
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const defaultWorkingDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dhakaTime = new Date(utc + 6 * 3600000);
  const dayName = daysOfWeek[dhakaTime.getDay()];

  const allowedDays = (workingDays && workingDays.length > 0) ? workingDays : defaultWorkingDays;
  return allowedDays.includes(dayName);
}

/**
 * Composite evaluator accepting a Date and rules.
 */
export function evaluateAttendanceRules(punchTime: Date, rule: any): {
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  isWeekend: boolean;
  isHalfDay: boolean;
} {
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  let workingDaysNames: string[] | undefined = undefined;
  if (Array.isArray(rule.workingDays)) {
    workingDaysNames = rule.workingDays.map((d: any) =>
      typeof d === 'number' ? daysOfWeek[d] : String(d).toUpperCase()
    );
  }

  const isWknd = !isWorkingDay(punchTime, workingDaysNames);
  const timeStr = getDhakaTimeString(punchTime).substring(0, 5);

  const evaluation = evaluateAttendanceStatus(timeStr, {
    startTime: rule.startTime,
    lateThresholdMinutes: rule.lateThresholdMinutes,
    halfDayThresholdMinutes: rule.halfDayThresholdMinutes,
    gracePeriodMinutes: rule.gracePeriodMinutes || 0,
  });

  return {
    status: isWknd ? AttendanceStatus.WEEKEND : evaluation.status,
    isLate: evaluation.status === AttendanceStatus.LATE,
    lateMinutes: evaluation.lateMinutes,
    isWeekend: isWknd,
    isHalfDay: evaluation.isHalfDay,
  };
}

export function parseIsoToDhaka(isoStr: string): Date {
  return new Date(isoStr);
}

