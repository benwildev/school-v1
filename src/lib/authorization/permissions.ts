import { PermissionModule, PermissionAction, PermissionScope } from '@prisma/client';

export type PermissionCode =
  | 'STUDENTS_VIEW'
  | 'STUDENTS_CREATE'
  | 'STUDENTS_UPDATE'
  | 'STUDENTS_DELETE'
  | 'STUDENTS_EXPORT'
  | 'ACADEMICS_VIEW'
  | 'ACADEMICS_CREATE'
  | 'ACADEMICS_UPDATE'
  | 'ACADEMICS_DELETE'
  | 'ATTENDANCE_VIEW'
  | 'ATTENDANCE_CREATE'
  | 'ATTENDANCE_UPDATE'
  | 'ATTENDANCE_VERIFY'
  | 'MARKS_VIEW'
  | 'MARKS_CREATE'
  | 'MARKS_UPDATE'
  | 'MARKS_APPROVE'
  | 'MARKS_PUBLISH'
  | 'FEES_VIEW'
  | 'FEES_CREATE'
  | 'FEES_UPDATE'
  | 'FEES_CANCEL'
  | 'DISCOUNTS_VIEW'
  | 'DISCOUNTS_CREATE'
  | 'DISCOUNTS_UPDATE'
  | 'DISCOUNTS_CANCEL'
  | 'PAYMENTS_VIEW'
  | 'PAYMENTS_CREATE'
  | 'PAYMENTS_VERIFY'
  | 'PAYMENTS_REFUND'
  | 'PAYMENTS_PRINT'
  | 'ADMISSIONS_VIEW'
  | 'ADMISSIONS_CREATE'
  | 'ADMISSIONS_APPROVE'
  | 'ADMISSIONS_REJECT'
  | 'STAFF_VIEW'
  | 'STAFF_CREATE'
  | 'STAFF_UPDATE'
  | 'STAFF_DELETE'
  | 'COMMUNICATION_VIEW'
  | 'COMMUNICATION_CREATE'
  | 'REPORTS_VIEW'
  | 'REPORTS_EXPORT'
  | 'SETTINGS_VIEW'
  | 'SETTINGS_UPDATE';

export interface PermissionDefinition {
  module: PermissionModule;
  action: PermissionAction;
  code: PermissionCode;
  description: string;
  defaultScope: PermissionScope;
}

export const PERMISSION_CATALOG: Record<PermissionCode, PermissionDefinition> = {
  // Students
  STUDENTS_VIEW: { module: 'STUDENTS', action: 'VIEW', code: 'STUDENTS_VIEW', description: 'View student profile and enrollment data', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENTS_CREATE: { module: 'STUDENTS', action: 'CREATE', code: 'STUDENTS_CREATE', description: 'Create and register new students', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENTS_UPDATE: { module: 'STUDENTS', action: 'UPDATE', code: 'STUDENTS_UPDATE', description: 'Update student demographics and records', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENTS_DELETE: { module: 'STUDENTS', action: 'DELETE', code: 'STUDENTS_DELETE', description: 'Archive or delete student profiles', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENTS_EXPORT: { module: 'STUDENTS', action: 'EXPORT', code: 'STUDENTS_EXPORT', description: 'Export student lists and records', defaultScope: 'ENTIRE_SCHOOL' },

  // Academics
  ACADEMICS_VIEW: { module: 'ACADEMICS', action: 'VIEW', code: 'ACADEMICS_VIEW', description: 'View academic structure, sessions, classes, subjects', defaultScope: 'ENTIRE_SCHOOL' },
  ACADEMICS_CREATE: { module: 'ACADEMICS', action: 'CREATE', code: 'ACADEMICS_CREATE', description: 'Create classes, sections, subjects, routines', defaultScope: 'ENTIRE_SCHOOL' },
  ACADEMICS_UPDATE: { module: 'ACADEMICS', action: 'UPDATE', code: 'ACADEMICS_UPDATE', description: 'Modify academic configuration and routines', defaultScope: 'ENTIRE_SCHOOL' },
  ACADEMICS_DELETE: { module: 'ACADEMICS', action: 'DELETE', code: 'ACADEMICS_DELETE', description: 'Remove academic structures and routines', defaultScope: 'ENTIRE_SCHOOL' },

  // Attendance
  ATTENDANCE_VIEW: { module: 'ATTENDANCE', action: 'VIEW', code: 'ATTENDANCE_VIEW', description: 'View student and staff attendance sheets', defaultScope: 'ENTIRE_SCHOOL' },
  ATTENDANCE_CREATE: { module: 'ATTENDANCE', action: 'CREATE', code: 'ATTENDANCE_CREATE', description: 'Record student attendance', defaultScope: 'ASSIGNED_CLASSES' },
  ATTENDANCE_UPDATE: { module: 'ATTENDANCE', action: 'UPDATE', code: 'ATTENDANCE_UPDATE', description: 'Update or correct attendance records', defaultScope: 'ASSIGNED_CLASSES' },
  ATTENDANCE_VERIFY: { module: 'ATTENDANCE', action: 'VERIFY', code: 'ATTENDANCE_VERIFY', description: 'Approve and verify daily attendance summaries', defaultScope: 'ENTIRE_SCHOOL' },

  // Marks & Exams
  MARKS_VIEW: { module: 'MARKS', action: 'VIEW', code: 'MARKS_VIEW', description: 'View marks sheets, transcripts, and exam results', defaultScope: 'ENTIRE_SCHOOL' },
  MARKS_CREATE: { module: 'MARKS', action: 'CREATE', code: 'MARKS_CREATE', description: 'Enter draft marks for assigned subjects', defaultScope: 'ASSIGNED_SUBJECTS' },
  MARKS_UPDATE: { module: 'MARKS', action: 'UPDATE', code: 'MARKS_UPDATE', description: 'Update draft marks before submission', defaultScope: 'ASSIGNED_SUBJECTS' },
  MARKS_APPROVE: { module: 'MARKS', action: 'APPROVE', code: 'MARKS_APPROVE', description: 'Verify and approve submitted marks', defaultScope: 'ENTIRE_SCHOOL' },
  MARKS_PUBLISH: { module: 'MARKS', action: 'PUBLISH', code: 'MARKS_PUBLISH', description: 'Publish final GPA and exam result sheets', defaultScope: 'ENTIRE_SCHOOL' },

  // Fees
  FEES_VIEW: { module: 'FEES', action: 'VIEW', code: 'FEES_VIEW', description: 'View fee structures, student invoices, and ledger', defaultScope: 'ENTIRE_SCHOOL' },
  FEES_CREATE: { module: 'FEES', action: 'CREATE', code: 'FEES_CREATE', description: 'Generate student fee invoices and billing batches', defaultScope: 'ENTIRE_SCHOOL' },
  FEES_UPDATE: { module: 'FEES', action: 'UPDATE', code: 'FEES_UPDATE', description: 'Adjust fee structures and billing schedules', defaultScope: 'ENTIRE_SCHOOL' },
  FEES_CANCEL: { module: 'FEES', action: 'CANCEL', code: 'FEES_CANCEL', description: 'Void or cancel fee invoices with recorded reason', defaultScope: 'ENTIRE_SCHOOL' },

  // Discounts
  DISCOUNTS_VIEW: { module: 'DISCOUNTS', action: 'VIEW', code: 'DISCOUNTS_VIEW', description: 'View student fee discounts and waivers', defaultScope: 'ENTIRE_SCHOOL' },
  DISCOUNTS_CREATE: { module: 'DISCOUNTS', action: 'CREATE', code: 'DISCOUNTS_CREATE', description: 'Authorize new student discounts and waivers', defaultScope: 'ENTIRE_SCHOOL' },
  DISCOUNTS_UPDATE: { module: 'DISCOUNTS', action: 'UPDATE', code: 'DISCOUNTS_UPDATE', description: 'Modify existing student discounts', defaultScope: 'ENTIRE_SCHOOL' },
  DISCOUNTS_CANCEL: { module: 'DISCOUNTS', action: 'CANCEL', code: 'DISCOUNTS_CANCEL', description: 'Cancel or revoke an active discount', defaultScope: 'ENTIRE_SCHOOL' },

  // Payments
  PAYMENTS_VIEW: { module: 'PAYMENTS', action: 'VIEW', code: 'PAYMENTS_VIEW', description: 'View payment transactions and receipts', defaultScope: 'ENTIRE_SCHOOL' },
  PAYMENTS_CREATE: { module: 'PAYMENTS', action: 'CREATE', code: 'PAYMENTS_CREATE', description: 'Collect and record fee payments', defaultScope: 'ENTIRE_SCHOOL' },
  PAYMENTS_VERIFY: { module: 'PAYMENTS', action: 'VERIFY', code: 'PAYMENTS_VERIFY', description: 'Verify online gateway / bank deposit payments', defaultScope: 'ENTIRE_SCHOOL' },
  PAYMENTS_REFUND: { module: 'PAYMENTS', action: 'REFUND', code: 'PAYMENTS_REFUND', description: 'Process payment refunds with approval audit', defaultScope: 'ENTIRE_SCHOOL' },
  PAYMENTS_PRINT: { module: 'PAYMENTS', action: 'PRINT', code: 'PAYMENTS_PRINT', description: 'Print official money receipts', defaultScope: 'ENTIRE_SCHOOL' },

  // Admissions
  ADMISSIONS_VIEW: { module: 'ADMISSIONS', action: 'VIEW', code: 'ADMISSIONS_VIEW', description: 'View admission applications and applicants', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_CREATE: { module: 'ADMISSIONS', action: 'CREATE', code: 'ADMISSIONS_CREATE', description: 'Submit or register admission applications', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_APPROVE: { module: 'ADMISSIONS', action: 'APPROVE', code: 'ADMISSIONS_APPROVE', description: 'Approve and convert applications to enrolled students', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_REJECT: { module: 'ADMISSIONS', action: 'REJECT', code: 'ADMISSIONS_REJECT', description: 'Reject admission applications with documented reason', defaultScope: 'ENTIRE_SCHOOL' },

  // Staff & Faculty
  STAFF_VIEW: { module: 'STAFF', action: 'VIEW', code: 'STAFF_VIEW', description: 'View teacher and employee directory and profiles', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_CREATE: { module: 'STAFF', action: 'CREATE', code: 'STAFF_CREATE', description: 'Add new teachers and staff members', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_UPDATE: { module: 'STAFF', action: 'UPDATE', code: 'STAFF_UPDATE', description: 'Modify employee profile and role assignments', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_DELETE: { module: 'STAFF', action: 'DELETE', code: 'STAFF_DELETE', description: 'Terminate or archive staff accounts', defaultScope: 'ENTIRE_SCHOOL' },

  // Communication
  COMMUNICATION_VIEW: { module: 'COMMUNICATION', action: 'VIEW', code: 'COMMUNICATION_VIEW', description: 'View notification history and message logs', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_CREATE: { module: 'COMMUNICATION', action: 'CREATE', code: 'COMMUNICATION_CREATE', description: 'Broadcast SMS, WhatsApp, and notices', defaultScope: 'ENTIRE_SCHOOL' },

  // Reports
  REPORTS_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_VIEW', description: 'View executive and institutional reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_EXPORT: { module: 'REPORTS', action: 'EXPORT', code: 'REPORTS_EXPORT', description: 'Export institutional accounting and student analytics', defaultScope: 'ENTIRE_SCHOOL' },

  // Settings
  SETTINGS_VIEW: { module: 'SETTINGS', action: 'VIEW', code: 'SETTINGS_VIEW', description: 'View school branding, campus, and session settings', defaultScope: 'ENTIRE_SCHOOL' },
  SETTINGS_UPDATE: { module: 'SETTINGS', action: 'UPDATE', code: 'SETTINGS_UPDATE', description: 'Modify school settings and branding assets', defaultScope: 'ENTIRE_SCHOOL' },
};

/**
 * Standard System Role Template Definitions
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, { permissions: PermissionCode[]; defaultScope?: PermissionScope }> = {
  SCHOOL_OWNER: {
    permissions: Object.keys(PERMISSION_CATALOG) as PermissionCode[],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  PRINCIPAL: {
    permissions: Object.keys(PERMISSION_CATALOG) as PermissionCode[],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  ADMIN: {
    permissions: Object.keys(PERMISSION_CATALOG).filter(p => p !== 'SETTINGS_UPDATE') as PermissionCode[],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  TEACHER: {
    permissions: [
      'STUDENTS_VIEW',
      'ACADEMICS_VIEW',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_CREATE',
      'ATTENDANCE_UPDATE',
      'MARKS_VIEW',
      'MARKS_CREATE',
      'MARKS_UPDATE',
      'COMMUNICATION_VIEW',
    ],
    defaultScope: 'ASSIGNED_SUBJECTS',
  },
  ACCOUNTANT: {
    permissions: [
      'STUDENTS_VIEW',
      'FEES_VIEW',
      'FEES_CREATE',
      'FEES_UPDATE',
      'DISCOUNTS_VIEW', // Note: DISCOUNTS_CREATE/UPDATE/CANCEL is intentionally omitted!
      'PAYMENTS_VIEW',
      'PAYMENTS_CREATE',
      'PAYMENTS_VERIFY',
      'PAYMENTS_PRINT',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
    ],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  STUDENT: {
    permissions: [
      'STUDENTS_VIEW',
      'ACADEMICS_VIEW',
      'ATTENDANCE_VIEW',
      'MARKS_VIEW',
      'FEES_VIEW',
      'PAYMENTS_VIEW',
      'COMMUNICATION_VIEW',
    ],
    defaultScope: 'OWN_DATA',
  },
  PARENT: {
    permissions: [
      'STUDENTS_VIEW',
      'ATTENDANCE_VIEW',
      'MARKS_VIEW',
      'FEES_VIEW',
      'PAYMENTS_VIEW',
      'COMMUNICATION_VIEW',
    ],
    defaultScope: 'OWN_CHILDREN',
  },
};
