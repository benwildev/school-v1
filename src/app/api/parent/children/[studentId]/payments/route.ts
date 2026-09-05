import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/parent/children/[studentId]/payments
 * Parent portal endpoint to view child's payment history with strict IDOR verification
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
        { error: 'Forbidden: You are not authorized to view payment records for this student.' },
        { status: 403 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        schoolId: guardianRelation.student.schoolId,
        status: 'SUCCESS',
      },
      include: {
        receipt: true,
        allocations: {
          include: {
            studentFee: {
              include: {
                feeType: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
