import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/finance/invoices/[invoiceId]
 * Get full invoice details and its payment allocations
 * Required Permission: FEES_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });
    const { invoiceId } = await params;

    const invoice = await prisma.studentFee.findFirst({
      where: { id: invoiceId, schoolId },
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
        feeType: true,
        feeStructure: true,
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentMethod: true,
                paymentDate: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
