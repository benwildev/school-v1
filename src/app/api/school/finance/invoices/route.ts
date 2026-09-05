import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/invoices
 * List student fee invoices with flexible filtering
 * Required Permission: FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const enrollmentId = searchParams.get('enrollmentId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status') as any;
    const billingPeriodKey = searchParams.get('billingPeriodKey');
    const feeTypeId = searchParams.get('feeTypeId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    if (enrollmentId) where.enrollmentId = enrollmentId;
    if (status) where.status = status;
    if (billingPeriodKey) where.billingPeriodKey = billingPeriodKey;
    if (feeTypeId) where.feeTypeId = feeTypeId;
    if (classId) {
      where.enrollment = { classId };
    }

    const [invoices, totalCount] = await Promise.all([
      prisma.studentFee.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstNameEn: true,
              lastNameEn: true,
              fullNameEn: true,
              fullNameBn: true,
            },
          },
          enrollment: {
            include: {
              class: true,
              section: true,
            },
          },
          feeType: true,
          allocations: true,
        },
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.studentFee.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
