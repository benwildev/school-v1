import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/school/reports/saved/[savedReportId]
 * Deletes a saved report preset.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ savedReportId: string }> }
) {
  try {
    const { savedReportId } = await params;
    const { context, schoolId } = await requireActiveSchool(request);

    const existing = await prisma.savedReport.findFirst({
      where: {
        id: savedReportId,
        schoolId,
        userId: context.userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Saved report preset not found or unauthorized.' }, { status: 404 });
    }

    await prisma.savedReport.delete({
      where: { id: savedReportId },
    });

    return NextResponse.json({
      success: true,
      message: 'Saved report preset deleted successfully.',
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
