import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/payments/[paymentId]
 * Required Permission: PAYMENTS_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_VIEW',
    });
    const { paymentId } = await params;

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, schoolId },
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
        receipt: true,
        refunds: true,
        receivedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
