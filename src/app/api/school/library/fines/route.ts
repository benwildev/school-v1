import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { WaiveFineSchema, LibraryFineTypeSchema } from '@/lib/validation/library';
import { calculateFineBalance } from '@/lib/library/fine-engine';
import { z } from 'zod';

const CreateManualFineSchema = z.object({
  studentId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  loanId: z.string().uuid().optional().nullable(),
  fineType: LibraryFineTypeSchema,
  fineAmount: z.number().min(0.01, 'Fine amount must be greater than zero'),
  notes: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_FINE_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const status = searchParams.get('status') || undefined;
    const fineType = searchParams.get('fineType') || undefined;

    const fines = await withTenantContext(schoolId, async (tx) => {
      const whereClause: any = { schoolId };
      if (studentId) whereClause.studentId = studentId;
      if (employeeId) whereClause.employeeId = employeeId;
      if (status) whereClause.status = status;
      if (fineType) whereClause.fineType = fineType;

      return tx.libraryFine.findMany({
        where: whereClause,
        include: {
          loan: {
            include: {
              copy: {
                include: {
                  book: { select: { id: true, titleEn: true, titleBn: true } },
                },
              },
            },
          },
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
          assessedBy: { select: { id: true, fullName: true } },
          waivedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: fines });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'LIBRARY_FINE_CREATE' });

    const body = await request.json();
    const parsed = CreateManualFineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { studentId, employeeId, loanId, fineType, fineAmount, notes } = parsed.data;
    if (!studentId && !employeeId) {
      return NextResponse.json(
        { success: false, error: 'Either studentId or employeeId must be provided' },
        { status: 400 }
      );
    }

    const fine = await withTenantContext(schoolId, async (tx) => {
      return tx.libraryFine.create({
        data: {
          schoolId,
          loanId: loanId || null,
          borrowerType: studentId ? 'STUDENT' : 'EMPLOYEE',
          studentId: studentId || null,
          employeeId: employeeId || null,
          fineType,
          fineAmount,
          calculatedAmount: fineAmount,
          status: 'UNPAID',
          notes: notes || null,
          assessedById: context.userId,
        },
        include: {
          student: true,
          employee: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: fine }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'LIBRARY_FINE_WAIVE' });

    const body = await request.json();
    const { fineId, waivedAmount } = body;
    const parsed = WaiveFineSchema.safeParse(body);
    if (!parsed.success || !fineId) {
      return NextResponse.json(
        { success: false, error: 'Valid fineId and waivedReason required', details: parsed.error?.format() },
        { status: 400 }
      );
    }

    const { waivedReason } = parsed.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      const fine = await tx.libraryFine.findFirst({
        where: { id: fineId, schoolId },
      });
      if (!fine) throw new Error('Fine not found');
      if (fine.status === 'PAID') throw new Error('Cannot waive a fine that is already fully paid');
      if (fine.status === 'WAIVED') throw new Error('This fine has already been waived');

      const currentFine = Number(fine.fineAmount);
      const currentPaid = Number(fine.paidAmount);
      const currentWaived = Number(fine.waivedAmount);
      const remainingBalance = Math.max(0, currentFine - currentPaid - currentWaived);

      const toWaive = waivedAmount !== undefined ? Math.min(Number(waivedAmount), remainingBalance) : remainingBalance;
      const newTotalWaived = currentWaived + toWaive;

      const { isSettled, isFullyWaived } = calculateFineBalance(currentFine, newTotalWaived, currentPaid);

      return tx.libraryFine.update({
        where: { id: fineId },
        data: {
          waivedAmount: newTotalWaived,
          waivedReason,
          waivedById: context.userId,
          status: isSettled ? (isFullyWaived ? 'WAIVED' : 'PAID') : 'UNPAID',
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
