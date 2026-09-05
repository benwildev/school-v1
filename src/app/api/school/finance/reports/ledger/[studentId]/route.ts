import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { generateStudentLedger } from '@/lib/finance/ledger';

/**
 * GET /api/school/finance/reports/ledger/[studentId]
 * Generates an official, chronological student ledger (debit, credit, running balance)
 * Required Permission: FEES_VIEW or REPORTS_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });
    const { studentId } = await params;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }

    const ledger = await generateStudentLedger(prisma, schoolId, studentId);

    return NextResponse.json({ success: true, data: ledger });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
