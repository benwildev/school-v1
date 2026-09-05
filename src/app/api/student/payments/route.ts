import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/student/payments
 * Student portal endpoint to view own payments
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
      include: { student: true },
    });

    if (!studentUser) {
      return NextResponse.json(
        { error: 'No student profile linked to this account.' },
        { status: 403 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: {
        studentId: studentUser.studentId,
        schoolId: studentUser.student.schoolId,
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
