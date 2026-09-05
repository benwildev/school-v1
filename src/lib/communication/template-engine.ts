/**
 * Bilingual Notification & Communication Template Engine
 *
 * Provides safe variable substitution (e.g. {{studentName}}, {{date}})
 * without eval or arbitrary code execution.
 */

export const ALLOWED_TEMPLATE_VARIABLES = [
  'studentName',
  'guardianName',
  'employeeName',
  'className',
  'sectionName',
  'rollNo',
  'studentCode',
  'date',
  'time',
  'status',
  'lateMinutes',
  'schoolName',
  'amount',
  'feeType',
  'invoiceNumber',
  'dueDate',
  'examName',
  'gpa',
  'linkUrl',
] as const;

export type AllowedVariable = (typeof ALLOWED_TEMPLATE_VARIABLES)[number];

/**
 * Extracts all unique placeholder variables matching {{variableName}} from a template string.
 */
export function extractTemplateVariables(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  if (!matches) return [];
  const variables = matches.map((m) => m.slice(2, -2).trim());
  return Array.from(new Set(variables));
}

/**
 * Validates that all variables used in the template belong to the whitelist.
 */
export function validateTemplateVariables(template: string): { isValid: boolean; invalidVariables: string[] } {
  const extracted = extractTemplateVariables(template);
  const invalid = extracted.filter((v) => !ALLOWED_TEMPLATE_VARIABLES.includes(v as AllowedVariable));
  return {
    isValid: invalid.length === 0,
    invalidVariables: invalid,
  };
}

/**
 * Safely sanitizes replacement values to prevent script or header injection.
 */
function sanitizeValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Strip control characters (ASCII 0-31 except \t, \n, \r)
  return Array.from(str)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13 || code > 127;
    })
    .join('');
}

/**
 * Validates syntax for unclosed {{ or unmatched }} brackets.
 */
export function validateTemplateSyntax(template: string): boolean {
  if (!template) return true;
  const openMatches = template.match(/\{\{/g) || [];
  const closeMatches = template.match(/\}\}/g) || [];
  if (openMatches.length !== closeMatches.length) return false;

  // Check that every {{ is followed by }} before another {{
  let inTag = false;
  for (let i = 0; i < template.length - 1; i++) {
    if (template[i] === '{' && template[i + 1] === '{') {
      if (inTag) return false; // nested or unclosed {{
      inTag = true;
      i++;
    } else if (template[i] === '}' && template[i + 1] === '}') {
      if (!inTag) return false; // unmatched }}
      inTag = false;
      i++;
    }
  }
  return !inTag;
}

/**
 * Renders a template string by replacing {{variable}} with provided values.
 * Unprovided variables are safely replaced by an empty string.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>,
  strict: boolean = false
): string {
  if (!template) return '';

  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(variables, varName)) {
      return sanitizeValue(variables[varName]);
    }
    if (strict) {
      throw new Error(`Missing mandatory template variable: {{${varName}}}`);
    }
    return ''; // Replace unprovided variable with empty string
  });
}


export interface BilingualNotificationPayload {
  templateEn: string;
  templateBn: string;
  variables: Record<string, string | number | boolean | null | undefined>;
}

export interface RenderedBilingualResult {
  bodyEn: string;
  bodyBn: string;
}

/**
 * Renders both English and Bangla variants of a notification template with the given data.
 */
export function renderBilingualTemplate(payload: BilingualNotificationPayload): RenderedBilingualResult {
  return {
    bodyEn: renderTemplate(payload.templateEn, payload.variables),
    bodyBn: renderTemplate(payload.templateBn, payload.variables),
  };
}

/**
 * Default standard bilingual templates for common educational lifecycle events.
 */
export const STANDARD_NOTIFICATION_TEMPLATES = {
  ATTENDANCE_ABSENT: {
    code: 'ATTENDANCE_ABSENT',
    name: 'Student Absent Notice',
    channel: 'SMS',
    templateEn: 'Dear Parent, your child {{studentName}} (Roll: {{rollNo}}, Class: {{className}}) was marked ABSENT on {{date}} at {{schoolName}}.',
    templateBn: 'প্রিয় অভিভাবক, আপনার সন্তান {{studentName}} (রোল: {{rollNo}}, শ্রেণি: {{className}}) আজ {{date}} তারিখে {{schoolName}}-এ অনুপস্থিত।',
    variables: ['studentName', 'rollNo', 'className', 'date', 'schoolName'],
  },
  ATTENDANCE_LATE: {
    code: 'ATTENDANCE_LATE',
    name: 'Student Late Arrival Notice',
    channel: 'SMS',
    templateEn: 'Dear Parent, your child {{studentName}} arrived LATE at school on {{date}} (Time: {{time}}, Late: {{lateMinutes}} mins).',
    templateBn: 'প্রিয় অভিভাবক, আপনার সন্তান {{studentName}} আজ {{date}} তারিখে বিলম্বে বিদ্যালয়ে পৌঁছেছে (সময়: {{time}}, বিলম্ব: {{lateMinutes}} মিনিট)।',
    variables: ['studentName', 'date', 'time', 'lateMinutes', 'schoolName'],
  },
  FEE_DUE_REMINDER: {
    code: 'FEE_DUE_REMINDER',
    name: 'Fee Due Reminder',
    channel: 'SMS',
    templateEn: 'Dear Parent, tuition fee of ৳{{amount}} for {{studentName}} is due on {{dueDate}}. Please pay to avoid late fee. {{schoolName}}.',
    templateBn: 'প্রিয় অভিভাবক, {{studentName}}-এর টিউশন ফি ৳{{amount}} আগামী {{dueDate}} তারিখের মধ্যে পরিশোধের জন্য অনুরোধ করা হচ্ছে। {{schoolName}}।',
    variables: ['studentName', 'amount', 'dueDate', 'schoolName'],
  },
  PAYMENT_CONFIRMATION: {
    code: 'PAYMENT_CONFIRMATION',
    name: 'Payment Receipt Confirmation',
    channel: 'SMS',
    templateEn: 'Payment received: ৳{{amount}} for {{studentName}} (Invoice: {{invoiceNumber}}). Thank you! {{schoolName}}.',
    templateBn: 'অর্থ প্রদান সফল: {{studentName}}-এর ফি ৳{{amount}} প্রাপ্ত হয়েছে (রসিদ: {{invoiceNumber}})। ধন্যবাদ! {{schoolName}}।',
    variables: ['studentName', 'amount', 'invoiceNumber', 'schoolName'],
  },
  RESULT_NOTIFICATION: {
    code: 'RESULT_NOTIFICATION',
    name: 'Exam Result Published',
    channel: 'IN_APP',
    templateEn: 'Results for {{examName}} have been published. {{studentName}} achieved GPA {{gpa}}. View details in portal.',
    templateBn: '{{examName}}-এর ফলাফল প্রকাশিত হয়েছে। {{studentName}} জিপিএ {{gpa}} অর্জন করেছে। বিস্তারিত পোর্টালে দেখুন।',
    variables: ['examName', 'studentName', 'gpa', 'schoolName'],
  },
  PAYROLL_NOTICE: {
    code: 'PAYROLL_NOTICE',
    name: 'Employee Payslip Ready',
    channel: 'EMAIL',
    templateEn: 'Dear {{employeeName}}, your salary for {{date}} has been processed. Payslip: {{invoiceNumber}}. {{schoolName}}.',
    templateBn: 'প্রিয় {{employeeName}}, {{date}} মাসের বেতন প্রক্রিয়াজাত করা হয়েছে। পে-স্লিপ: {{invoiceNumber}}। {{schoolName}}।',
    variables: ['employeeName', 'date', 'invoiceNumber', 'schoolName'],
  },
};
