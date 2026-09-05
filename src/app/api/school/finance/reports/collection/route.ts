import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/reports/collection
 * Collection report broken down by payment method and date range
 * Required Permission: REPORTS_VIEW or FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'REPORTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = { schoolId, status: 'SUCCESS' };
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [byMethod, totalSum] = await Promise.all([
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const breakdown = byMethod.map((item) => ({
      paymentMethod: item.paymentMethod,
      totalAmount: Number(item._sum.totalAmount || 0),
      count: item._count.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalCollected: Number(totalSum._sum.totalAmount || 0),
        totalTransactions: totalSum._count.id,
        breakdown,
      },
    });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
