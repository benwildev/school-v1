import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/receipts
 * List money receipts
 * Required Permission: PAYMENTS_VIEW or PAYMENTS_PRINT
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const receiptNumber = searchParams.get('receiptNumber');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = { schoolId };
    if (paymentId) where.paymentId = paymentId;
    if (receiptNumber) where.receiptNumber = { contains: receiptNumber, mode: 'insensitive' };

    const [receipts, totalCount] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: {
          payment: {
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
            },
          },
          issuedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.receipt.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: receipts,
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
