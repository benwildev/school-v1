import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { generatePayrollPaymentNumber } from '@/lib/payroll/payslip';
import { PayrollPaymentSchema } from '@/lib/validation/payroll';
import { AuditAction, PaymentMethod, PayrollPaymentStatus, PayrollRecordStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'PAYROLL_PAYMENT_VIEW' });

    const { searchParams } = new URL(request.url);
    const payrollRecordId = searchParams.get('payrollRecordId');
    const paymentMethod = searchParams.get('paymentMethod') as PaymentMethod | null;
    const status = searchParams.get('status') as PayrollPaymentStatus | null;

    const where: any = { schoolId };
    if (payrollRecordId) where.payrollRecordId = payrollRecordId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (status) where.status = status;

    const payments = await prisma.payrollPayment.findMany({
      where,
      include: {
        payrollRecord: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                fullNameEn: true,
                department: true,
                designation: true,
              },
            },
            period: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'PAYROLL_PAYMENT_CREATE' });

    const body = await request.json();
    const parseResult = PayrollPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { payrollRecordId, paymentMethod, amount, referenceNumber, paymentDate, remarks } = parseResult.data;

    const record = await prisma.payrollRecord.findFirst({
      where: { id: payrollRecordId, schoolId },
      include: { employee: true, period: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Payroll record not found in school.' }, { status: 404 });
    }

    if (record.status !== PayrollRecordStatus.FINALIZED && record.status !== PayrollRecordStatus.PAID) {
      return NextResponse.json({ error: 'Payroll must be finalized before salary payments can be disbursed.' }, { status: 400 });
    }

    const paymentAmountDecimal = new Prisma.Decimal(amount);
    const dueSalaryDecimal = new Prisma.Decimal(record.dueSalary);

    if (paymentAmountDecimal.greaterThan(dueSalaryDecimal)) {
      return NextResponse.json(
        { error: `Payment amount (৳${amount}) cannot exceed outstanding due salary (৳${record.dueSalary}).` },
        { status: 400 }
      );
    }

    const payment = await withTenantContext(schoolId, async (tx) => {
      await tx.$executeRaw`SELECT id FROM payroll_records WHERE id = ${payrollRecordId}::uuid FOR UPDATE`;

      const paymentNumber = generatePayrollPaymentNumber(new Date());
      const payDate = paymentDate ? new Date(paymentDate) : new Date();

      const createdPayment = await tx.payrollPayment.create({
        data: {
          schoolId,
          payrollRecordId,
          employeeId: record.employeeId,
          paymentNumber,
          amount: paymentAmountDecimal,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          paymentDate: payDate,
          transactionRef: referenceNumber ?? null,
          status: PayrollPaymentStatus.SUCCESS,
          paidById: context.userId,
          notes: remarks ?? null,
        },
      });

      const newPaid = new Prisma.Decimal(record.paidAmount).plus(paymentAmountDecimal);
      const newDue = new Prisma.Decimal(record.netSalary).minus(newPaid);
      const newStatus = newDue.lessThanOrEqualTo(0) ? PayrollRecordStatus.PAID : record.status;

      await tx.payrollRecord.update({
        where: { id: payrollRecordId },
        data: {
          paidAmount: newPaid,
          dueSalary: newDue,
          status: newStatus,
        },
      });

      const unpaidCount = await tx.payrollRecord.count({
        where: {
          periodId: record.periodId,
          schoolId,
          dueSalary: { gt: 0 },
        },
      });

      if (unpaidCount === 0) {
        await tx.payrollPeriod.update({
          where: { id: record.periodId },
          data: { status: 'PAID' },
        });
      }

      return createdPayment;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'PayrollPayment',
      entityId: payment.id,
      afterState: payment as any,
      changeSummary: `Disbursed salary payment of ৳${payment.amount} to '${record.employee.fullNameEn}' (${payment.paymentNumber})`,
    });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
