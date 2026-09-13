import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { executeReport } from '@/lib/reports/report-engine';
import { handleApiError } from '@/lib/api/handle-api-error';

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
  } catch (error) {
    if (error instanceof Error && error.message?.startsWith('INVALID_FILTERS')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
