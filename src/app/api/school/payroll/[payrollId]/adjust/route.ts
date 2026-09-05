import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { PayrollRecordAdjustSchema } from '@/lib/validation/payroll';
import { AuditAction, PayrollRecordStatus, Prisma, SalaryComponentType } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payrollId: string }> }
) {
  try {
    const { payrollId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'PAYROLL_CALCULATE' });

    const record = await prisma.payrollRecord.findFirst({
      where: { id: payrollId, schoolId },
      include: { items: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Payroll record not found.' }, { status: 404 });
    }

    if (record.status === PayrollRecordStatus.FINALIZED || record.status === PayrollRecordStatus.PAID) {
      return NextResponse.json(
        { error: 'Cannot modify a finalized payroll record. Corrections must use an adjustment journal.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = PayrollRecordAdjustSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { reason, adjustmentType, amount, name } = parseResult.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      const itemType = adjustmentType === 'ADD_EARNING' ? SalaryComponentType.EARNING : SalaryComponentType.DEDUCTION;
      const code = `ADJ_${Date.now().toString().slice(-4)}`;

      await tx.payrollItem.create({
        data: {
          schoolId,
          payrollRecordId: record.id,
          code,
          nameEn: name,
          nameBn: name,
          type: itemType,
          amount,
          notes: reason,
        },
      });

      let newGross = new Prisma.Decimal(record.grossEarnings);
      let newDeductions = new Prisma.Decimal(record.totalDeductions);

      if (adjustmentType === 'ADD_EARNING') {
        newGross = newGross.plus(amount);
      } else {
        newDeductions = newDeductions.plus(amount);
      }

      const newNet = newGross.minus(newDeductions);
      if (newNet.isNegative()) {
        throw new Error('Adjustment would result in negative net salary.');
      }

      return tx.payrollRecord.update({
        where: { id: record.id },
        data: {
          grossEarnings: newGross,
          totalDeductions: newDeductions,
          netSalary: newNet,
          dueSalary: newNet.minus(record.paidAmount),
        },
        include: { items: true },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'PayrollRecord',
      entityId: payrollId,
      beforeState: record as any,
      afterState: updated as any,
      changeSummary: `Applied pre-finalization adjustment of ৳${amount} (${adjustmentType}): ${reason}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
