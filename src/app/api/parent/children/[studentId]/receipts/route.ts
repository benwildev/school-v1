import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/parent/children/[studentId]/receipts
 * Parent portal endpoint to view child's receipts with strict IDOR verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireAuth(request);
    const { studentId } = await params;

    const guardianRelation = await prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: {
          userId: context.userId,
        },
      },
      include: {
        student: true,
      },
    });

    if (!guardianRelation) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to view receipts for this student.' },
        { status: 403 }
      );
    }

    const receipts = await prisma.receipt.findMany({
      where: {
        schoolId: guardianRelation.student.schoolId,
        payment: {
          studentId,
        },
      },
      include: {
        payment: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: receipts });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
