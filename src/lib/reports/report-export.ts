import { prisma } from '../db';
import { executeReport } from './report-engine';
import { ExportReportOptions, ExportReportResult } from './report-types';

import { generateCsv, generatePrintHtml } from './export-generators';

export { generateCsv, generatePrintHtml };

/**
 * Executes a report and transforms its output into the requested export format.
 * Logs the export action into `report_export_logs` table for forensic auditing.
 */
export async function exportReport(options: ExportReportOptions): Promise<ExportReportResult> {
  const { context, schoolId, reportId, format, rawFilters = {}, ipAddress, userAgent } = options;

  // 1. Execute report with exact security, RLS, and scope enforcement
  const execution = await executeReport({
    context,
    schoolId,
    reportId,
    rawFilters,
    skipCache: true, // Exports must always fetch authoritative data
  });

  const { meta, result } = execution;
  const timestampStr = new Date().toISOString().split('T')[0];
  let content: string;
  let contentType: string;
  let extension: string;

  if (format === 'CSV') {
    content = generateCsv(result.columns, result.data);
    contentType = 'text/csv; charset=utf-8';
    extension = 'csv';
  } else if (format === 'XLSX') {
    // Generate CSV with Excel MIME type and UTF-8 BOM
    content = generateCsv(result.columns, result.data);
    contentType = 'application/vnd.ms-excel; charset=utf-8';
    extension = 'csv';
  } else {
    // PDF or PRINT format returns clean HTML
    content = generatePrintHtml(meta.name, meta.nameBn, result.columns, result.data);
    contentType = 'text/html; charset=utf-8';
    extension = 'html';
  }

  const filename = `${reportId}_${timestampStr}.${extension}`;

  // 2. Audit Trail: Record export into report_export_logs
  try {
    await prisma.reportExportLog.create({
      data: {
        schoolId,
        userId: context.userId,
        reportId,
        format,
        filters: typeof rawFilters === 'object' && !(rawFilters instanceof URLSearchParams) ? rawFilters : {},
        resultCount: result.data.length,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (err) {
    console.error('Failed to log report export:', err);
  }

  return {
    content,
    contentType,
    filename,
    resultCount: result.data.length,
  };
}
