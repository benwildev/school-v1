import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/parent/children/[studentId]/fees
 * Parent portal endpoint to view child's fees and invoices with strict IDOR verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireAuth(request);
    const { studentId } = await params;

    // Strict IDOR Protection: Verify caller is an active linked guardian of this child
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
        { error: 'Forbidden: You are not authorized to view financial records for this student.' },
        { status: 403 }
      );
    }

    const fees = await prisma.studentFee.findMany({
      where: {
        studentId,
        schoolId: guardianRelation.student.schoolId,
        status: { not: 'VOIDED' },
      },
      include: {
        feeType: true,
        enrollment: {
          include: {
            class: true,
            section: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({ success: true, data: fees });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
