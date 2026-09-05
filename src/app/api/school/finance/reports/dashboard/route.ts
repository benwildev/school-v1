import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/reports/dashboard
 * Fast aggregate financial KPIs (no N+1 queries)
 * Required Permission: REPORTS_VIEW or FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayPayments,
      monthPayments,
      dueAggregate,
      overdueAggregate,
      recentPayments,
    ] = await Promise.all([
      // 1. Today's collection
      prisma.payment.aggregate({
        where: {
          schoolId,
          status: 'SUCCESS',
          paymentDate: { gte: todayStart },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // 2. This month's collection
      prisma.payment.aggregate({
        where: {
          schoolId,
          status: 'SUCCESS',
          paymentDate: { gte: monthStart },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // 3. Total outstanding due
      prisma.studentFee.aggregate({
        where: {
          schoolId,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { dueAmount: true },
        _count: { id: true },
      }),

      // 4. Overdue amount
      prisma.studentFee.aggregate({
        where: {
          schoolId,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: todayStart },
        },
        _sum: { dueAmount: true },
        _count: { id: true },
      }),

      // 5. Recent 5 payments
      prisma.payment.findMany({
        where: { schoolId, status: 'SUCCESS' },
        include: {
          student: {
            select: {
              studentCode: true,
              firstNameEn: true,
              lastNameEn: true,
              fullNameEn: true,
              fullNameBn: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        todayCollection: Number(todayPayments._sum.totalAmount || 0),
        todayTransactionsCount: todayPayments._count.id,
        thisMonthCollection: Number(monthPayments._sum.totalAmount || 0),
        thisMonthTransactionsCount: monthPayments._count.id,
        totalOutstandingDue: Number(dueAggregate._sum.dueAmount || 0),
        unpaidInvoicesCount: dueAggregate._count.id,
        overdueAmount: Number(overdueAggregate._sum.dueAmount || 0),
        overdueInvoicesCount: overdueAggregate._count.id,
        recentPayments,
      },
    });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
