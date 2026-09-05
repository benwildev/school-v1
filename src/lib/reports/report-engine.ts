import { REPORT_REGISTRY } from './report-registry';
import { parseReportFilters, applyScopeFilterConstraints } from './report-filters';
import { authorizeReportAccess } from './report-permissions';
import { reportCache } from './report-cache';
import { AuthContext } from '../authorization/engine';
import { ReportExecutionResult } from './report-types';


export interface ExecuteReportOptions {
  context: AuthContext;
  schoolId: string;
  reportId: string;
  rawFilters?: Record<string, any> | URLSearchParams;
  skipCache?: boolean;
}

export interface ExecuteReportResponse {
  success: boolean;
  meta: {
    reportId: string;
    name: string;
    nameBn: string;
    module: string;
    generatedAt: string;
    cached: boolean;
  };
  result: ReportExecutionResult;
}

/**
 * Centralized Report Execution Engine.
 * Enforces zero-trust authentication, permissions, tenant boundaries, scopes, and privacy.
 */
export async function executeReport(
  options: ExecuteReportOptions
): Promise<ExecuteReportResponse> {
  const { context, schoolId, reportId, rawFilters = {}, skipCache = false } = options;

  // 1. Discover report definition
  const reportDef = REPORT_REGISTRY[reportId];
  if (!reportDef) {
    throw new Error(`NOT_FOUND: Report '${reportId}' is not registered in the system.`);
  }

  // 2. Parse & validate incoming filters
  const parsedFilters = parseReportFilters(rawFilters);

  // 3. Authorize user permission and resolve active scope
  const authz = await authorizeReportAccess({
    context,
    schoolId,
    requiredPermission: reportDef.requiredPermission,
    filters: parsedFilters,
  });

  if (!authz.authorized) {
    throw new Error(`FORBIDDEN: ${authz.reason || 'Unauthorized to access this report.'}`);
  }

  // 4. Build execution context with scope constraints
  const execContext = {
    schoolId,
    userId: context.userId,
    userRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : undefined,
    scope: authz.scope,
    userCampusId: authz.userCampusId,
    teacherId: authz.teacherId,
    filters: parsedFilters,
  };

  const constrainedFilters = applyScopeFilterConstraints(execContext);
  execContext.filters = constrainedFilters;

  // 5. Check tenant-isolated cache for read queries
  if (!skipCache) {
    const cachedResult = reportCache.get<ReportExecutionResult>(schoolId, reportId, constrainedFilters);
    if (cachedResult) {
      return {
        success: true,
        meta: {
          reportId: reportDef.reportId,
          name: reportDef.name,
          nameBn: reportDef.nameBn,
          module: reportDef.module,
          generatedAt: new Date().toISOString(),
          cached: true,
        },
        result: cachedResult,
      };
    }
  }

  // 6. Execute domain report query
  const result = await reportDef.execute(execContext);

  // 7. Privacy & Data Minimization Guard: Ensure no sensitive PII leaks in records
  for (const row of result.data) {
    delete row.nid;
    delete row.birthCertificateNo;
    delete row.medicalNotes;
    delete row.passwordHash;
    delete row.guardianNid;
    delete row.privateAddress;
  }

  // 8. Cache aggregate summary if eligible
  if (!skipCache && result.data.length > 0) {
    reportCache.set(schoolId, reportId, constrainedFilters, result);
  }

  return {
    success: true,
    meta: {
      reportId: reportDef.reportId,
      name: reportDef.name,
      nameBn: reportDef.nameBn,
      module: reportDef.module,
      generatedAt: new Date().toISOString(),
      cached: false,
    },
    result,
  };
}
