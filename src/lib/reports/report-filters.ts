import { z } from 'zod';
import { ReportFilterParams, ReportExecutionContext } from './report-types';

export const ReportFilterSchema = z.object({
  academicSessionId: z.string().uuid().optional(),
  campusId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  academicGroupId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  shift: z.string().max(50).optional(),
  studentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  gender: z.string().max(20).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)').optional(),
  status: z.string().max(50).optional(),
  paymentStatus: z.string().max(50).optional(),
  attendanceStatus: z.string().max(50).optional(),
  examId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  libraryCategoryId: z.string().uuid().optional(),
  inventoryCategoryId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
  format: z.string().max(20).optional(),
  isExport: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50000).default(50),
});

/**
 * Parses and validates query params into a type-safe ReportFilterParams object.
 */
export function parseReportFilters(params: Record<string, any> | URLSearchParams): ReportFilterParams {
  const raw: Record<string, any> = {};

  if (params instanceof URLSearchParams) {
    params.forEach((val, key) => {
      if (val !== '' && val !== null && val !== undefined) {
        raw[key] = val;
      }
    });
  } else {
    for (const key of Object.keys(params)) {
      const val = params[key];
      if (val !== '' && val !== null && val !== undefined) {
        raw[key] = val;
      }
    }
  }

  const result = ReportFilterSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`INVALID_FILTERS: ${issues}`);
  }

  return result.data as ReportFilterParams;
}

/**
 * Validates and locks filters based on the user's role and permission scope.
 * Prevents unauthorized users from bypassing scopes via query parameters.
 */
export function applyScopeFilterConstraints(
  ctx: ReportExecutionContext
): ReportFilterParams {
  const { scope, userCampusId, filters } = ctx;
  const constrainedFilters = { ...filters };

  // 1. OWN_CAMPUS Scope Constraint
  if (scope === 'OWN_CAMPUS' && userCampusId) {
    if (constrainedFilters.campusId && constrainedFilters.campusId !== userCampusId) {
      throw new Error('FORBIDDEN: You cannot filter by other campuses.');
    }
    constrainedFilters.campusId = userCampusId;
  }

  // 2. Pagination & Export Truncation Protection:
  // UI browsing defaults to 50 rows per page; exports must fetch complete datasets (up to 10,000 rows).
  const isExportRequest = Boolean(
    constrainedFilters.isExport ||
    constrainedFilters.format ||
    (ctx as any).isExport
  );

  if (!constrainedFilters.page) constrainedFilters.page = 1;
  if (!constrainedFilters.limit) {
    constrainedFilters.limit = isExportRequest ? 10000 : 50;
  } else if (isExportRequest && constrainedFilters.limit === 50) {
    constrainedFilters.limit = 10000;
  }

  return constrainedFilters;
}
