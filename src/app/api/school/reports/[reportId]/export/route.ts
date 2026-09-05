import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { exportReport } from '@/lib/reports/report-export';
import { ExportFormat } from '@/lib/reports/report-types';

/**
 * GET & POST /api/school/reports/[reportId]/export
 * Exports the report as CSV, XLSX, or Print HTML.
 */
async function handleExport(
  request: NextRequest,
  reportId: string,
  rawFilters: Record<string, any> | URLSearchParams,
  format: ExportFormat
) {
  const { context, schoolId } = await requireActiveSchool(request);

  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const exportResult = await exportReport({
    context,
    schoolId,
    reportId,
    format,
    rawFilters,
    ipAddress,
    userAgent,
  });

  return new NextResponse(exportResult.content, {
    status: 200,
    headers: {
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const { searchParams } = new URL(request.url);
    const format = ((searchParams.get('format') || 'CSV').toUpperCase()) as ExportFormat;

    return await handleExport(request, reportId, searchParams, format);
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Export Failed' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const format = ((body.format || 'CSV').toUpperCase()) as ExportFormat;
    const filters = body.filters || {};

    return await handleExport(request, reportId, filters, format);
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Export Failed' }, { status: 500 });
  }
}
