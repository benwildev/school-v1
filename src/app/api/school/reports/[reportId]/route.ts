import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { executeReport } from '@/lib/reports/report-engine';

/**
 * GET /api/school/reports/[reportId]
 * Executes the specified report with query filter parameters.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const { context, schoolId } = await requireActiveSchool(request);

    const { searchParams } = new URL(request.url);

    const result = await executeReport({
      context,
      schoolId,
      reportId,
      rawFilters: searchParams,
    });

    return NextResponse.json(result);
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
    if (error.message?.startsWith('INVALID_FILTERS')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
