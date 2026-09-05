import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/reports/due
 * Outstanding dues report filtered/grouped by class and section
 * Required Permission: REPORTS_VIEW or FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');
    const feeTypeId = searchParams.get('feeTypeId');

    const where: any = {
      schoolId,
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueAmount: { gt: 0 },
    };

    if (feeTypeId) where.feeTypeId = feeTypeId;
    if (classId || sectionId) {
      where.enrollment = {};
      if (classId) where.enrollment.classId = classId;
      if (sectionId) where.enrollment.sectionId = sectionId;
    }

    const dueInvoices = await prisma.studentFee.findMany({
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
      },
      orderBy: [{ enrollment: { class: { nameEn: 'asc' } } }, { dueDate: 'asc' }],
    });

    let totalDueAmount = 0;
    for (const inv of dueInvoices) {
      totalDueAmount += Number(inv.dueAmount);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalOutstandingDue: totalDueAmount,
        invoiceCount: dueInvoices.length,
        invoices: dueInvoices,
      },
    });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
