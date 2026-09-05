import { PermissionModule, PermissionAction, PermissionScope } from '@prisma/client';

export type PermissionCode =
  | 'STUDENTS_VIEW'
  | 'STUDENTS_CREATE'
  | 'STUDENTS_UPDATE'
  | 'STUDENTS_DELETE'
  | 'STUDENTS_EXPORT'
  | 'GUARDIANS_VIEW'
  | 'GUARDIANS_CREATE'
  | 'GUARDIANS_UPDATE'
  | 'GUARDIANS_DELETE'
  | 'ENROLLMENTS_VIEW'
  | 'ENROLLMENTS_CREATE'
  | 'ENROLLMENTS_UPDATE'
  | 'ENROLLMENTS_DELETE'
  | 'ENROLLMENTS_PROMOTE'
  | 'ENROLLMENTS_TRANSFER'
  | 'ENROLLMENTS_WITHDRAW'
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
  | 'ADMISSIONS_UPDATE'
  | 'ADMISSIONS_DELETE'
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
  | 'SETTINGS_UPDATE'
  | 'PARENT_ACCOUNTS_VIEW'
  | 'PARENT_ACCOUNTS_INVITE'
  | 'PARENT_ACCOUNTS_REVOKE'
  | 'STUDENT_ACCOUNTS_VIEW'
  | 'STUDENT_ACCOUNTS_INVITE'
  | 'STUDENT_ACCOUNTS_REVOKE'
  // Phase 7: HR & Payroll Permissions
  | 'HR_VIEW'
  | 'HR_CREATE'
  | 'HR_UPDATE'
  | 'HR_DELETE'
  | 'EMPLOYEES_VIEW'
  | 'EMPLOYEES_CREATE'
  | 'EMPLOYEES_UPDATE'
  | 'EMPLOYEES_DEACTIVATE'
  | 'SALARY_VIEW'
  | 'SALARY_CREATE'
  | 'SALARY_UPDATE'
  | 'LEAVE_VIEW'
  | 'LEAVE_CREATE'
  | 'LEAVE_APPROVE'
  | 'LEAVE_REJECT'
  | 'PAYROLL_VIEW'
  | 'PAYROLL_CREATE'
  | 'PAYROLL_CALCULATE'
  | 'PAYROLL_FINALIZE'
  | 'PAYROLL_REOPEN'
  | 'PAYROLL_PAYMENT_VIEW'
  | 'PAYROLL_PAYMENT_CREATE'
  | 'PAYROLL_PAYMENT_APPROVE'
  | 'PAYSLIP_VIEW'
  | 'PAYSLIP_PRINT'
  | 'PAYSLIP_EXPORT'
  | 'ADVANCE_VIEW'
  | 'ADVANCE_CREATE'
  | 'ADVANCE_APPROVE'
  | 'ADVANCE_RECOVER'
  // Phase 8: Advanced Attendance & Communication Permissions
  | 'ATTENDANCE_EXPORT'
  | 'ATTENDANCE_DEVICE_VIEW'
  | 'ATTENDANCE_DEVICE_CREATE'
  | 'ATTENDANCE_DEVICE_UPDATE'
  | 'ATTENDANCE_DEVICE_SYNC'
  | 'COMMUNICATION_SEND'
  | 'COMMUNICATION_BULK_SEND'
  | 'COMMUNICATION_TEMPLATE_VIEW'
  | 'COMMUNICATION_TEMPLATE_CREATE'
  | 'COMMUNICATION_TEMPLATE_UPDATE'
  | 'NOTIFICATION_VIEW'
  | 'NOTIFICATION_MANAGE'
  // Phase 9: Transport Permissions
  | 'TRANSPORT_VIEW'
  | 'TRANSPORT_CREATE'
  | 'TRANSPORT_UPDATE'
  | 'TRANSPORT_DEACTIVATE'
  | 'VEHICLES_VIEW'
  | 'VEHICLES_CREATE'
  | 'VEHICLES_UPDATE'
  | 'VEHICLES_RETIRE'
  | 'ROUTES_VIEW'
  | 'ROUTES_CREATE'
  | 'ROUTES_UPDATE'
  | 'TRANSPORT_ASSIGNMENT_VIEW'
  | 'TRANSPORT_ASSIGNMENT_CREATE'
  | 'TRANSPORT_ASSIGNMENT_UPDATE'
  | 'TRANSPORT_ASSIGNMENT_REMOVE'
  | 'TRIP_VIEW'
  | 'TRIP_CREATE'
  | 'TRIP_UPDATE'
  | 'TRIP_CANCEL'
  | 'TRANSPORT_ATTENDANCE_VIEW'
  | 'TRANSPORT_ATTENDANCE_CREATE'
  | 'TRANSPORT_ATTENDANCE_UPDATE'
  | 'TRANSPORT_REPORT_VIEW'
  | 'TRANSPORT_EXPORT'
  | 'TRANSPORT_MAINTENANCE_VIEW'
  | 'TRANSPORT_MAINTENANCE_CREATE'
  // Phase 10: Library & Inventory Permissions
  | 'LIBRARY_VIEW'
  | 'LIBRARY_CREATE'
  | 'LIBRARY_UPDATE'
  | 'LIBRARY_DELETE'
  | 'LIBRARY_MANAGE_CATALOG'
  | 'LIBRARY_ISSUE'
  | 'LIBRARY_RETURN'
  | 'LIBRARY_RENEW'
  | 'LIBRARY_RESERVE'
  | 'LIBRARY_FINE_VIEW'
  | 'LIBRARY_FINE_CREATE'
  | 'LIBRARY_FINE_WAIVE'
  | 'LIBRARY_REPORT_VIEW'
  | 'LIBRARY_EXPORT'
  | 'INVENTORY_VIEW'
  | 'INVENTORY_CREATE'
  | 'INVENTORY_UPDATE'
  | 'INVENTORY_DELETE'
  | 'INVENTORY_STOCK_IN'
  | 'INVENTORY_STOCK_OUT'
  | 'INVENTORY_TRANSFER'
  | 'INVENTORY_REPORT_VIEW'
  | 'INVENTORY_EXPORT'
  | 'SUPPLIER_VIEW'
  | 'SUPPLIER_CREATE'
  | 'SUPPLIER_UPDATE'
  | 'PURCHASE_VIEW'
  | 'PURCHASE_CREATE'
  | 'PURCHASE_APPROVE'
  | 'ASSET_VIEW'
  | 'ASSET_CREATE'
  | 'ASSET_UPDATE'
  | 'ASSET_ASSIGN'
  | 'ASSET_DISPOSE'
  | 'ASSET_MAINTENANCE_VIEW'
  | 'ASSET_MAINTENANCE_CREATE'
  // Phase 11: Granular Reporting Permissions
  | 'REPORTS_STUDENTS_VIEW'
  | 'REPORTS_ACADEMICS_VIEW'
  | 'REPORTS_ATTENDANCE_VIEW'
  | 'REPORTS_FINANCE_VIEW'
  | 'REPORTS_HR_VIEW'
  | 'REPORTS_ADMISSIONS_VIEW'
  | 'REPORTS_TRANSPORT_VIEW'
  | 'REPORTS_LIBRARY_VIEW'
  | 'REPORTS_INVENTORY_VIEW';

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

  // Guardians
  GUARDIANS_VIEW: { module: 'STUDENTS', action: 'VIEW', code: 'GUARDIANS_VIEW', description: 'View guardian profiles and relationships', defaultScope: 'ENTIRE_SCHOOL' },
  GUARDIANS_CREATE: { module: 'STUDENTS', action: 'CREATE', code: 'GUARDIANS_CREATE', description: 'Create guardian records and relationships', defaultScope: 'ENTIRE_SCHOOL' },
  GUARDIANS_UPDATE: { module: 'STUDENTS', action: 'UPDATE', code: 'GUARDIANS_UPDATE', description: 'Modify guardian records and relationships', defaultScope: 'ENTIRE_SCHOOL' },
  GUARDIANS_DELETE: { module: 'STUDENTS', action: 'DELETE', code: 'GUARDIANS_DELETE', description: 'Remove guardian records and relationships', defaultScope: 'ENTIRE_SCHOOL' },

  // Enrollments
  ENROLLMENTS_VIEW: { module: 'STUDENTS', action: 'VIEW', code: 'ENROLLMENTS_VIEW', description: 'View student enrollments and academic placement', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_CREATE: { module: 'STUDENTS', action: 'CREATE', code: 'ENROLLMENTS_CREATE', description: 'Enroll students into academic sessions', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_UPDATE: { module: 'STUDENTS', action: 'UPDATE', code: 'ENROLLMENTS_UPDATE', description: 'Modify enrollment details and status', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_DELETE: { module: 'STUDENTS', action: 'DELETE', code: 'ENROLLMENTS_DELETE', description: 'Remove or drop student enrollment records', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_PROMOTE: { module: 'STUDENTS', action: 'UPDATE', code: 'ENROLLMENTS_PROMOTE', description: 'Execute single or bulk student promotions', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_TRANSFER: { module: 'STUDENTS', action: 'UPDATE', code: 'ENROLLMENTS_TRANSFER', description: 'Transfer students across sections or campuses', defaultScope: 'ENTIRE_SCHOOL' },
  ENROLLMENTS_WITHDRAW: { module: 'STUDENTS', action: 'UPDATE', code: 'ENROLLMENTS_WITHDRAW', description: 'Process student withdrawal or transfer-out', defaultScope: 'ENTIRE_SCHOOL' },

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
  ADMISSIONS_UPDATE: { module: 'ADMISSIONS', action: 'UPDATE', code: 'ADMISSIONS_UPDATE', description: 'Modify admission application records and dossier', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_DELETE: { module: 'ADMISSIONS', action: 'DELETE', code: 'ADMISSIONS_DELETE', description: 'Archive or remove un-enrolled admission applications', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_APPROVE: { module: 'ADMISSIONS', action: 'APPROVE', code: 'ADMISSIONS_APPROVE', description: 'Approve and convert applications to enrolled students', defaultScope: 'ENTIRE_SCHOOL' },
  ADMISSIONS_REJECT: { module: 'ADMISSIONS', action: 'REJECT', code: 'ADMISSIONS_REJECT', description: 'Reject admission applications with documented reason', defaultScope: 'ENTIRE_SCHOOL' },

  // Staff & Faculty
  STAFF_VIEW: { module: 'STAFF', action: 'VIEW', code: 'STAFF_VIEW', description: 'View teacher and employee directory and profiles', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_CREATE: { module: 'STAFF', action: 'CREATE', code: 'STAFF_CREATE', description: 'Add new teachers and staff members', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_UPDATE: { module: 'STAFF', action: 'UPDATE', code: 'STAFF_UPDATE', description: 'Modify employee profile and role assignments', defaultScope: 'ENTIRE_SCHOOL' },
  STAFF_DELETE: { module: 'STAFF', action: 'DELETE', code: 'STAFF_DELETE', description: 'Terminate or archive staff accounts', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 7 HR & Employee Management
  HR_VIEW: { module: 'STAFF', action: 'VIEW', code: 'HR_VIEW', description: 'View HR configurations, departments, designations', defaultScope: 'ENTIRE_SCHOOL' },
  HR_CREATE: { module: 'STAFF', action: 'CREATE', code: 'HR_CREATE', description: 'Create HR configurations, departments, designations', defaultScope: 'ENTIRE_SCHOOL' },
  HR_UPDATE: { module: 'STAFF', action: 'UPDATE', code: 'HR_UPDATE', description: 'Update HR configurations, departments, designations', defaultScope: 'ENTIRE_SCHOOL' },
  HR_DELETE: { module: 'STAFF', action: 'DELETE', code: 'HR_DELETE', description: 'Remove HR configurations, departments, designations', defaultScope: 'ENTIRE_SCHOOL' },

  EMPLOYEES_VIEW: { module: 'STAFF', action: 'VIEW', code: 'EMPLOYEES_VIEW', description: 'View employee profiles, details, and employment history', defaultScope: 'ENTIRE_SCHOOL' },
  EMPLOYEES_CREATE: { module: 'STAFF', action: 'CREATE', code: 'EMPLOYEES_CREATE', description: 'Register new employee records and lifecycle events', defaultScope: 'ENTIRE_SCHOOL' },
  EMPLOYEES_UPDATE: { module: 'STAFF', action: 'UPDATE', code: 'EMPLOYEES_UPDATE', description: 'Update employee demographics, designations, campuses', defaultScope: 'ENTIRE_SCHOOL' },
  EMPLOYEES_DEACTIVATE: { module: 'STAFF', action: 'DELETE', code: 'EMPLOYEES_DEACTIVATE', description: 'Deactivate, suspend, or terminate employee records', defaultScope: 'ENTIRE_SCHOOL' },

  SALARY_VIEW: { module: 'STAFF', action: 'VIEW', code: 'SALARY_VIEW', description: 'View employee salary assignments and structures', defaultScope: 'ENTIRE_SCHOOL' },
  SALARY_CREATE: { module: 'STAFF', action: 'CREATE', code: 'SALARY_CREATE', description: 'Create employee salary structures and assignments', defaultScope: 'ENTIRE_SCHOOL' },
  SALARY_UPDATE: { module: 'STAFF', action: 'UPDATE', code: 'SALARY_UPDATE', description: 'Update or version employee salary assignments', defaultScope: 'ENTIRE_SCHOOL' },

  LEAVE_VIEW: { module: 'STAFF', action: 'VIEW', code: 'LEAVE_VIEW', description: 'View leave types, requests, and staff leave balances', defaultScope: 'ENTIRE_SCHOOL' },
  LEAVE_CREATE: { module: 'STAFF', action: 'CREATE', code: 'LEAVE_CREATE', description: 'Create leave requests for staff', defaultScope: 'ENTIRE_SCHOOL' },
  LEAVE_APPROVE: { module: 'STAFF', action: 'APPROVE', code: 'LEAVE_APPROVE', description: 'Approve staff leave requests and decrement balance', defaultScope: 'ENTIRE_SCHOOL' },
  LEAVE_REJECT: { module: 'STAFF', action: 'REJECT', code: 'LEAVE_REJECT', description: 'Reject staff leave requests with documented reason', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 7 Payroll
  PAYROLL_VIEW: { module: 'STAFF', action: 'VIEW', code: 'PAYROLL_VIEW', description: 'View payroll periods, calculations, and summaries', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_CREATE: { module: 'STAFF', action: 'CREATE', code: 'PAYROLL_CREATE', description: 'Create payroll periods and initialize batches', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_CALCULATE: { module: 'STAFF', action: 'UPDATE', code: 'PAYROLL_CALCULATE', description: 'Generate and calculate staff payroll records', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_FINALIZE: { module: 'STAFF', action: 'APPROVE', code: 'PAYROLL_FINALIZE', description: 'Lock and finalize payroll periods and records', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_REOPEN: { module: 'STAFF', action: 'UPDATE', code: 'PAYROLL_REOPEN', description: 'Reopen or adjust draft payroll records', defaultScope: 'ENTIRE_SCHOOL' },

  PAYROLL_PAYMENT_VIEW: { module: 'PAYMENTS', action: 'VIEW', code: 'PAYROLL_PAYMENT_VIEW', description: 'View salary disbursement logs and payment transactions', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_PAYMENT_CREATE: { module: 'PAYMENTS', action: 'CREATE', code: 'PAYROLL_PAYMENT_CREATE', description: 'Disburse and record salary payments to employees', defaultScope: 'ENTIRE_SCHOOL' },
  PAYROLL_PAYMENT_APPROVE: { module: 'PAYMENTS', action: 'APPROVE', code: 'PAYROLL_PAYMENT_APPROVE', description: 'Approve salary payment disbursements', defaultScope: 'ENTIRE_SCHOOL' },

  PAYSLIP_VIEW: { module: 'STAFF', action: 'VIEW', code: 'PAYSLIP_VIEW', description: 'View employee payslips', defaultScope: 'ENTIRE_SCHOOL' },
  PAYSLIP_PRINT: { module: 'STAFF', action: 'PRINT', code: 'PAYSLIP_PRINT', description: 'Print employee payslips', defaultScope: 'ENTIRE_SCHOOL' },
  PAYSLIP_EXPORT: { module: 'STAFF', action: 'EXPORT', code: 'PAYSLIP_EXPORT', description: 'Export employee payslips and bank payout sheets', defaultScope: 'ENTIRE_SCHOOL' },

  ADVANCE_VIEW: { module: 'STAFF', action: 'VIEW', code: 'ADVANCE_VIEW', description: 'View salary advances and recovery schedules', defaultScope: 'ENTIRE_SCHOOL' },
  ADVANCE_CREATE: { module: 'STAFF', action: 'CREATE', code: 'ADVANCE_CREATE', description: 'Request salary advances for employees', defaultScope: 'ENTIRE_SCHOOL' },
  ADVANCE_APPROVE: { module: 'STAFF', action: 'APPROVE', code: 'ADVANCE_APPROVE', description: 'Approve or reject salary advances', defaultScope: 'ENTIRE_SCHOOL' },
  ADVANCE_RECOVER: { module: 'STAFF', action: 'UPDATE', code: 'ADVANCE_RECOVER', description: 'Recover or adjust salary advances via payroll', defaultScope: 'ENTIRE_SCHOOL' },

  // Communication
  COMMUNICATION_VIEW: { module: 'COMMUNICATION', action: 'VIEW', code: 'COMMUNICATION_VIEW', description: 'View notification history and message logs', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_CREATE: { module: 'COMMUNICATION', action: 'CREATE', code: 'COMMUNICATION_CREATE', description: 'Broadcast SMS, WhatsApp, and notices', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_SEND: { module: 'COMMUNICATION', action: 'CREATE', code: 'COMMUNICATION_SEND', description: 'Send transactional SMS, email, and WhatsApp messages', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_BULK_SEND: { module: 'COMMUNICATION', action: 'CREATE', code: 'COMMUNICATION_BULK_SEND', description: 'Broadcast bulk communications to school communities', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_TEMPLATE_VIEW: { module: 'COMMUNICATION', action: 'VIEW', code: 'COMMUNICATION_TEMPLATE_VIEW', description: 'View communication templates and variables', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_TEMPLATE_CREATE: { module: 'COMMUNICATION', action: 'CREATE', code: 'COMMUNICATION_TEMPLATE_CREATE', description: 'Create bilingual notification templates', defaultScope: 'ENTIRE_SCHOOL' },
  COMMUNICATION_TEMPLATE_UPDATE: { module: 'COMMUNICATION', action: 'UPDATE', code: 'COMMUNICATION_TEMPLATE_UPDATE', description: 'Update notification templates and configurations', defaultScope: 'ENTIRE_SCHOOL' },
  NOTIFICATION_VIEW: { module: 'COMMUNICATION', action: 'VIEW', code: 'NOTIFICATION_VIEW', description: 'View institutional in-app notifications', defaultScope: 'ENTIRE_SCHOOL' },
  NOTIFICATION_MANAGE: { module: 'COMMUNICATION', action: 'UPDATE', code: 'NOTIFICATION_MANAGE', description: 'Manage notification channels and automation rules', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 8 Attendance Devices
  ATTENDANCE_EXPORT: { module: 'ATTENDANCE', action: 'EXPORT', code: 'ATTENDANCE_EXPORT', description: 'Export daily and monthly attendance records', defaultScope: 'ENTIRE_SCHOOL' },
  ATTENDANCE_DEVICE_VIEW: { module: 'ATTENDANCE', action: 'VIEW', code: 'ATTENDANCE_DEVICE_VIEW', description: 'View biometric and RFID attendance devices', defaultScope: 'ENTIRE_SCHOOL' },
  ATTENDANCE_DEVICE_CREATE: { module: 'ATTENDANCE', action: 'CREATE', code: 'ATTENDANCE_DEVICE_CREATE', description: 'Register new attendance devices and gateways', defaultScope: 'ENTIRE_SCHOOL' },
  ATTENDANCE_DEVICE_UPDATE: { module: 'ATTENDANCE', action: 'UPDATE', code: 'ATTENDANCE_DEVICE_UPDATE', description: 'Modify attendance device settings and credentials', defaultScope: 'ENTIRE_SCHOOL' },
  ATTENDANCE_DEVICE_SYNC: { module: 'ATTENDANCE', action: 'UPDATE', code: 'ATTENDANCE_DEVICE_SYNC', description: 'Trigger synchronization of attendance device logs', defaultScope: 'ENTIRE_SCHOOL' },

  // Reports
  REPORTS_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_VIEW', description: 'View executive and institutional reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_EXPORT: { module: 'REPORTS', action: 'EXPORT', code: 'REPORTS_EXPORT', description: 'Export institutional accounting and student analytics', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_STUDENTS_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_STUDENTS_VIEW', description: 'View student directory, enrollment, and demographic reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_ACADEMICS_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_ACADEMICS_VIEW', description: 'View exam results, subject performance, and at-risk student reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_ATTENDANCE_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_ATTENDANCE_VIEW', description: 'View student and employee attendance analytics and trends', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_FINANCE_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_FINANCE_VIEW', description: 'View fee collections, aging receivables, payment methods, and student ledger reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_HR_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_HR_VIEW', description: 'View staff directory, payroll cost summaries, and leave analytics', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_ADMISSIONS_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_ADMISSIONS_VIEW', description: 'View admission funnel conversion rates and application demand reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_TRANSPORT_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_TRANSPORT_VIEW', description: 'View transport route utilization, fleet capacity, and boarding event reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_LIBRARY_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_LIBRARY_VIEW', description: 'View library circulation, overdue books, fines, and popular title reports', defaultScope: 'ENTIRE_SCHOOL' },
  REPORTS_INVENTORY_VIEW: { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_INVENTORY_VIEW', description: 'View stock levels, consumption movements, and capital asset valuation reports', defaultScope: 'ENTIRE_SCHOOL' },

  // Settings
  SETTINGS_VIEW: { module: 'SETTINGS', action: 'VIEW', code: 'SETTINGS_VIEW', description: 'View school branding, campus, and session settings', defaultScope: 'ENTIRE_SCHOOL' },
  SETTINGS_UPDATE: { module: 'SETTINGS', action: 'UPDATE', code: 'SETTINGS_UPDATE', description: 'Modify school settings and branding assets', defaultScope: 'ENTIRE_SCHOOL' },

  // Portal Accounts & Invitations
  PARENT_ACCOUNTS_VIEW: { module: 'STUDENTS', action: 'VIEW', code: 'PARENT_ACCOUNTS_VIEW', description: 'View guardian portal accounts and invitations', defaultScope: 'ENTIRE_SCHOOL' },
  PARENT_ACCOUNTS_INVITE: { module: 'STUDENTS', action: 'CREATE', code: 'PARENT_ACCOUNTS_INVITE', description: 'Create and issue guardian portal account invitations', defaultScope: 'ENTIRE_SCHOOL' },
  PARENT_ACCOUNTS_REVOKE: { module: 'STUDENTS', action: 'UPDATE', code: 'PARENT_ACCOUNTS_REVOKE', description: 'Revoke or disable guardian portal accounts', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENT_ACCOUNTS_VIEW: { module: 'STUDENTS', action: 'VIEW', code: 'STUDENT_ACCOUNTS_VIEW', description: 'View student portal accounts and invitations', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENT_ACCOUNTS_INVITE: { module: 'STUDENTS', action: 'CREATE', code: 'STUDENT_ACCOUNTS_INVITE', description: 'Create and issue student portal account invitations', defaultScope: 'ENTIRE_SCHOOL' },
  STUDENT_ACCOUNTS_REVOKE: { module: 'STUDENTS', action: 'UPDATE', code: 'STUDENT_ACCOUNTS_REVOKE', description: 'Revoke or disable student portal accounts', defaultScope: 'ENTIRE_SCHOOL' },

  // Transport Management
  TRANSPORT_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRANSPORT_VIEW', description: 'View transport dashboard, fleet, routes, and operational schedules', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'TRANSPORT_CREATE', description: 'Create transport entities and schedules', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'TRANSPORT_UPDATE', description: 'Update transport operational configurations', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_DEACTIVATE: { module: 'TRANSPORT', action: 'DELETE', code: 'TRANSPORT_DEACTIVATE', description: 'Deactivate or cancel transport operations', defaultScope: 'ENTIRE_SCHOOL' },
  VEHICLES_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'VEHICLES_VIEW', description: 'View vehicle fleet inventory and fitness/insurance details', defaultScope: 'ENTIRE_SCHOOL' },
  VEHICLES_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'VEHICLES_CREATE', description: 'Register new vehicles into the fleet', defaultScope: 'ENTIRE_SCHOOL' },
  VEHICLES_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'VEHICLES_UPDATE', description: 'Update vehicle specifications and registration records', defaultScope: 'ENTIRE_SCHOOL' },
  VEHICLES_RETIRE: { module: 'TRANSPORT', action: 'DELETE', code: 'VEHICLES_RETIRE', description: 'Retire or decommission vehicles from active service', defaultScope: 'ENTIRE_SCHOOL' },
  ROUTES_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'ROUTES_VIEW', description: 'View transport routes and sequential stops', defaultScope: 'ENTIRE_SCHOOL' },
  ROUTES_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'ROUTES_CREATE', description: 'Create new transport routes and stops', defaultScope: 'ENTIRE_SCHOOL' },
  ROUTES_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'ROUTES_UPDATE', description: 'Modify route paths, stops, and schedules', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ASSIGNMENT_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRANSPORT_ASSIGNMENT_VIEW', description: 'View student and driver transport assignments', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ASSIGNMENT_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'TRANSPORT_ASSIGNMENT_CREATE', description: 'Assign students and drivers to routes and vehicles', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ASSIGNMENT_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'TRANSPORT_ASSIGNMENT_UPDATE', description: 'Modify student and driver transport assignments', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ASSIGNMENT_REMOVE: { module: 'TRANSPORT', action: 'DELETE', code: 'TRANSPORT_ASSIGNMENT_REMOVE', description: 'Remove or cancel transport assignments', defaultScope: 'ENTIRE_SCHOOL' },
  TRIP_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRIP_VIEW', description: 'View daily trip logs and real-time status', defaultScope: 'ENTIRE_SCHOOL' },
  TRIP_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'TRIP_CREATE', description: 'Dispatch and schedule daily trips', defaultScope: 'ENTIRE_SCHOOL' },
  TRIP_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'TRIP_UPDATE', description: 'Update trip progress and execution logs', defaultScope: 'ENTIRE_SCHOOL' },
  TRIP_CANCEL: { module: 'TRANSPORT', action: 'DELETE', code: 'TRIP_CANCEL', description: 'Cancel scheduled trips with recorded justification', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ATTENDANCE_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRANSPORT_ATTENDANCE_VIEW', description: 'View student boarding and dropoff events', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ATTENDANCE_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'TRANSPORT_ATTENDANCE_CREATE', description: 'Record student pickup and dropoff boarding events', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_ATTENDANCE_UPDATE: { module: 'TRANSPORT', action: 'UPDATE', code: 'TRANSPORT_ATTENDANCE_UPDATE', description: 'Correct boarding event records', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_REPORT_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRANSPORT_REPORT_VIEW', description: 'View transport utilization, passenger manifests, and cost reports', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_EXPORT: { module: 'TRANSPORT', action: 'EXPORT', code: 'TRANSPORT_EXPORT', description: 'Export transport manifests and fleet analytics', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_MAINTENANCE_VIEW: { module: 'TRANSPORT', action: 'VIEW', code: 'TRANSPORT_MAINTENANCE_VIEW', description: 'View vehicle maintenance history and service logs', defaultScope: 'ENTIRE_SCHOOL' },
  TRANSPORT_MAINTENANCE_CREATE: { module: 'TRANSPORT', action: 'CREATE', code: 'TRANSPORT_MAINTENANCE_CREATE', description: 'Record vehicle repairs, servicing, and costs', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 10: Library Management
  LIBRARY_VIEW: { module: 'LIBRARY', action: 'VIEW', code: 'LIBRARY_VIEW', description: 'View library catalog, books, and borrowing records', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_CREATE: { module: 'LIBRARY', action: 'CREATE', code: 'LIBRARY_CREATE', description: 'Create and register new book catalog items and copies', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_UPDATE: { module: 'LIBRARY', action: 'UPDATE', code: 'LIBRARY_UPDATE', description: 'Update book details, authors, publishers, and settings', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_DELETE: { module: 'LIBRARY', action: 'DELETE', code: 'LIBRARY_DELETE', description: 'Deactivate or withdraw book titles and copies', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_MANAGE_CATALOG: { module: 'LIBRARY', action: 'UPDATE', code: 'LIBRARY_MANAGE_CATALOG', description: 'Manage library categories, racks, and classification', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_ISSUE: { module: 'LIBRARY', action: 'CREATE', code: 'LIBRARY_ISSUE', description: 'Issue books to students and staff members', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_RETURN: { module: 'LIBRARY', action: 'UPDATE', code: 'LIBRARY_RETURN', description: 'Receive returned books and check condition', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_RENEW: { module: 'LIBRARY', action: 'UPDATE', code: 'LIBRARY_RENEW', description: 'Renew active book loans according to loan policy', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_RESERVE: { module: 'LIBRARY', action: 'CREATE', code: 'LIBRARY_RESERVE', description: 'Place and manage book title reservations', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_FINE_VIEW: { module: 'LIBRARY', action: 'VIEW', code: 'LIBRARY_FINE_VIEW', description: 'View overdue, damage, and lost book fines', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_FINE_CREATE: { module: 'LIBRARY', action: 'CREATE', code: 'LIBRARY_FINE_CREATE', description: 'Assess and record library fines and charges', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_FINE_WAIVE: { module: 'LIBRARY', action: 'UPDATE', code: 'LIBRARY_FINE_WAIVE', description: 'Waive or forgive library fines with recorded reason', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_REPORT_VIEW: { module: 'LIBRARY', action: 'VIEW', code: 'LIBRARY_REPORT_VIEW', description: 'View circulation, overdue, and accession reports', defaultScope: 'ENTIRE_SCHOOL' },
  LIBRARY_EXPORT: { module: 'LIBRARY', action: 'EXPORT', code: 'LIBRARY_EXPORT', description: 'Export library catalog and circulation logs', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 10: Inventory & Stock Management
  INVENTORY_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'INVENTORY_VIEW', description: 'View inventory item catalog and current stock levels', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_CREATE: { module: 'INVENTORY', action: 'CREATE', code: 'INVENTORY_CREATE', description: 'Create and register new inventory items', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_UPDATE: { module: 'INVENTORY', action: 'UPDATE', code: 'INVENTORY_UPDATE', description: 'Update inventory item metadata and reorder thresholds', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_DELETE: { module: 'INVENTORY', action: 'DELETE', code: 'INVENTORY_DELETE', description: 'Deactivate or archive inventory items', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_STOCK_IN: { module: 'INVENTORY', action: 'CREATE', code: 'INVENTORY_STOCK_IN', description: 'Record incoming stock deliveries and positive adjustments', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_STOCK_OUT: { module: 'INVENTORY', action: 'CREATE', code: 'INVENTORY_STOCK_OUT', description: 'Record stock issues, consumption, and write-offs', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_TRANSFER: { module: 'INVENTORY', action: 'CREATE', code: 'INVENTORY_TRANSFER', description: 'Transfer stock between school campuses', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_REPORT_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'INVENTORY_REPORT_VIEW', description: 'View stock ledger, low stock alerts, and consumption reports', defaultScope: 'ENTIRE_SCHOOL' },
  INVENTORY_EXPORT: { module: 'INVENTORY', action: 'EXPORT', code: 'INVENTORY_EXPORT', description: 'Export inventory stock ledgers and movement logs', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 10: Suppliers & Purchases
  SUPPLIER_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'SUPPLIER_VIEW', description: 'View vendor and supplier directory', defaultScope: 'ENTIRE_SCHOOL' },
  SUPPLIER_CREATE: { module: 'INVENTORY', action: 'CREATE', code: 'SUPPLIER_CREATE', description: 'Register new suppliers and vendors', defaultScope: 'ENTIRE_SCHOOL' },
  SUPPLIER_UPDATE: { module: 'INVENTORY', action: 'UPDATE', code: 'SUPPLIER_UPDATE', description: 'Update supplier contact details and terms', defaultScope: 'ENTIRE_SCHOOL' },
  PURCHASE_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'PURCHASE_VIEW', description: 'View inventory purchase orders and received invoices', defaultScope: 'ENTIRE_SCHOOL' },
  PURCHASE_CREATE: { module: 'INVENTORY', action: 'CREATE', code: 'PURCHASE_CREATE', description: 'Create purchase orders for inventory restocking', defaultScope: 'ENTIRE_SCHOOL' },
  PURCHASE_APPROVE: { module: 'INVENTORY', action: 'APPROVE', code: 'PURCHASE_APPROVE', description: 'Approve procurement orders and receive goods', defaultScope: 'ENTIRE_SCHOOL' },

  // Phase 10: Assets & Maintenance
  ASSET_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'ASSET_VIEW', description: 'View registered capital assets, serial numbers, and locations', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_CREATE: { module: 'INVENTORY', action: 'CREATE', code: 'ASSET_CREATE', description: 'Register new capital assets into the asset registry', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_UPDATE: { module: 'INVENTORY', action: 'UPDATE', code: 'ASSET_UPDATE', description: 'Update asset details, conditions, and locations', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_ASSIGN: { module: 'INVENTORY', action: 'UPDATE', code: 'ASSET_ASSIGN', description: 'Assign or reassign assets to employees and classrooms', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_DISPOSE: { module: 'INVENTORY', action: 'DELETE', code: 'ASSET_DISPOSE', description: 'Process audited asset write-offs and disposals', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_MAINTENANCE_VIEW: { module: 'INVENTORY', action: 'VIEW', code: 'ASSET_MAINTENANCE_VIEW', description: 'View asset servicing, repair logs, and maintenance costs', defaultScope: 'ENTIRE_SCHOOL' },
  ASSET_MAINTENANCE_CREATE: { module: 'INVENTORY', action: 'CREATE', code: 'ASSET_MAINTENANCE_CREATE', description: 'Log repairs, servicing, and maintenance events for assets', defaultScope: 'ENTIRE_SCHOOL' },
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
  HR: {
    permissions: [
      'STAFF_VIEW',
      'STAFF_CREATE',
      'STAFF_UPDATE',
      'HR_VIEW',
      'HR_CREATE',
      'HR_UPDATE',
      'HR_DELETE',
      'EMPLOYEES_VIEW',
      'EMPLOYEES_CREATE',
      'EMPLOYEES_UPDATE',
      'EMPLOYEES_DEACTIVATE',
      'SALARY_VIEW',
      'LEAVE_VIEW',
      'LEAVE_CREATE',
      'LEAVE_APPROVE',
      'LEAVE_REJECT',
      'ADVANCE_VIEW',
      'ADVANCE_CREATE',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_UPDATE',
      'ATTENDANCE_VERIFY',
      'ATTENDANCE_EXPORT',
      'ATTENDANCE_DEVICE_VIEW',
      'COMMUNICATION_VIEW',
      'NOTIFICATION_VIEW',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
      'REPORTS_HR_VIEW',
      'REPORTS_ATTENDANCE_VIEW',
    ],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  TEACHER: {
    permissions: [
      'STUDENTS_VIEW',
      'ENROLLMENTS_VIEW',
      'ACADEMICS_VIEW',
      'ATTENDANCE_VIEW',
      'ATTENDANCE_CREATE',
      'ATTENDANCE_UPDATE',
      'MARKS_VIEW',
      'MARKS_CREATE',
      'MARKS_UPDATE',
      'COMMUNICATION_VIEW',
      'NOTIFICATION_VIEW',
      'LIBRARY_VIEW',
      'LIBRARY_RESERVE',
      'REPORTS_VIEW',
      'REPORTS_STUDENTS_VIEW',
      'REPORTS_ACADEMICS_VIEW',
      'REPORTS_ATTENDANCE_VIEW',
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
      'PAYROLL_VIEW',
      'PAYROLL_CREATE',
      'PAYROLL_CALCULATE',
      'PAYROLL_PAYMENT_VIEW',
      'PAYROLL_PAYMENT_CREATE',
      'PAYSLIP_VIEW',
      'PAYSLIP_PRINT',
      'PAYSLIP_EXPORT',
      'ADVANCE_VIEW',
      'ADVANCE_CREATE',
      'ADVANCE_RECOVER',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
      'REPORTS_FINANCE_VIEW',
      'LIBRARY_FINE_VIEW',
      'PURCHASE_VIEW',
      'ASSET_VIEW',
    ],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  LIBRARIAN: {
    permissions: [
      'LIBRARY_VIEW',
      'LIBRARY_CREATE',
      'LIBRARY_UPDATE',
      'LIBRARY_DELETE',
      'LIBRARY_MANAGE_CATALOG',
      'LIBRARY_ISSUE',
      'LIBRARY_RETURN',
      'LIBRARY_RENEW',
      'LIBRARY_RESERVE',
      'LIBRARY_FINE_VIEW',
      'LIBRARY_FINE_CREATE',
      'LIBRARY_FINE_WAIVE',
      'LIBRARY_REPORT_VIEW',
      'LIBRARY_EXPORT',
      'STUDENTS_VIEW',
      'STAFF_VIEW',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
      'REPORTS_LIBRARY_VIEW',
    ],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  INVENTORY_MANAGER: {
    permissions: [
      'INVENTORY_VIEW',
      'INVENTORY_CREATE',
      'INVENTORY_UPDATE',
      'INVENTORY_DELETE',
      'INVENTORY_STOCK_IN',
      'INVENTORY_STOCK_OUT',
      'INVENTORY_TRANSFER',
      'INVENTORY_REPORT_VIEW',
      'INVENTORY_EXPORT',
      'SUPPLIER_VIEW',
      'SUPPLIER_CREATE',
      'SUPPLIER_UPDATE',
      'PURCHASE_VIEW',
      'PURCHASE_CREATE',
      'PURCHASE_APPROVE',
      'ASSET_VIEW',
      'ASSET_CREATE',
      'ASSET_UPDATE',
      'ASSET_ASSIGN',
      'ASSET_DISPOSE',
      'ASSET_MAINTENANCE_VIEW',
      'ASSET_MAINTENANCE_CREATE',
      'STAFF_VIEW',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
      'REPORTS_INVENTORY_VIEW',
    ],
    defaultScope: 'ENTIRE_SCHOOL',
  },
  TRANSPORT_MANAGER: {
    permissions: [
      'TRANSPORT_VIEW',
      'TRANSPORT_CREATE',
      'TRANSPORT_UPDATE',
      'TRANSPORT_DEACTIVATE',
      'VEHICLES_VIEW',
      'VEHICLES_CREATE',
      'VEHICLES_UPDATE',
      'VEHICLES_RETIRE',
      'ROUTES_VIEW',
      'ROUTES_CREATE',
      'ROUTES_UPDATE',
      'TRANSPORT_ASSIGNMENT_VIEW',
      'TRANSPORT_ASSIGNMENT_CREATE',
      'TRANSPORT_ASSIGNMENT_UPDATE',
      'TRANSPORT_ASSIGNMENT_REMOVE',
      'TRIP_VIEW',
      'TRIP_CREATE',
      'TRIP_UPDATE',
      'TRIP_CANCEL',
      'TRANSPORT_ATTENDANCE_VIEW',
      'TRANSPORT_ATTENDANCE_CREATE',
      'TRANSPORT_ATTENDANCE_UPDATE',
      'TRANSPORT_REPORT_VIEW',
      'TRANSPORT_EXPORT',
      'TRANSPORT_MAINTENANCE_VIEW',
      'TRANSPORT_MAINTENANCE_CREATE',
      'REPORTS_VIEW',
      'REPORTS_EXPORT',
      'REPORTS_TRANSPORT_VIEW',
      'STAFF_VIEW',
      'STUDENTS_VIEW',
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
      'TRANSPORT_VIEW',
      'LIBRARY_VIEW',
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
      'TRANSPORT_VIEW',
      'LIBRARY_VIEW',
    ],
    defaultScope: 'OWN_CHILDREN',
  },
};
