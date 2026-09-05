import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/student/receipts
 * Student portal endpoint to view own receipts
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

    const receipts = await prisma.receipt.findMany({
      where: {
        schoolId: studentUser.student.schoolId,
        payment: {
          studentId: studentUser.studentId,
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
