import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/receipts/[receiptId]
 * Required Permission: PAYMENTS_VIEW or PAYMENTS_PRINT
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_VIEW',
    });
    const { receiptId } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId, schoolId },
      include: {
        payment: {
          include: {
            student: true,
            enrollment: {
              include: {
                class: true,
                section: true,
                academicSession: true,
              },
            },
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
        },
        issuedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Increment print count
    await withTenantContext(schoolId, async (tx) => {
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          printedCount: { increment: 1 },
        },
      });
    });

    return NextResponse.json({ success: true, data: receipt });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
