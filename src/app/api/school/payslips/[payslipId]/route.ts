import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payslipId: string }> }
) {
  try {
    const { payslipId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'PAYSLIP_VIEW' });

    const payslip = await prisma.payrollRecord.findFirst({
      where: {
        schoolId,
        OR: [{ id: payslipId }, { payslipNumber: payslipId }],
      },
      include: {
        period: true,
        employee: {
          include: {
            department: true,
            designation: true,
            campus: true,
          },
        },
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payslip });
  } catch (error) {
    return handleApiError(error);
  }
}
