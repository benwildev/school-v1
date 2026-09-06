import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { PaymentAllocateSchema } from '@/lib/validation/finance';
import { toDecimal, addMoney, subMoney } from '@/lib/finance/money';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditAction } from '@prisma/client';

/**
 * POST /api/school/finance/payments/[paymentId]/allocate
 * Allocates unallocated advance payment or wallet balance to unpaid invoices
 * Required Permission: PAYMENTS_CREATE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_CREATE',
    });
    const { paymentId } = await params;

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, schoolId },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'SUCCESS') {
      return NextResponse.json(
        { error: `Cannot allocate a payment with status ${payment.status}` },
        { status: 400 }
      );
    }

    const unallocated = toDecimal(payment.advanceCreditAmount);
    if (unallocated.isZero() || unallocated.isNegative()) {
      return NextResponse.json(
        { error: 'This payment has zero remaining unallocated advance balance' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = PaymentAllocateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { allocations } = parseResult.data;

    let sumRequested = new Decimal(0);
    for (const a of allocations) {
      sumRequested = addMoney(sumRequested, a.amount);
    }

    if (sumRequested.greaterThan(unallocated)) {
      return NextResponse.json(
        {
          error: `Total requested allocation (${sumRequested.toString()} BDT) exceeds payment available advance balance (${unallocated.toString()} BDT)`,
        },
        { status: 400 }
      );
    }

    // Execute atomic allocation with strict row-level locking
    const createdAllocations = await withTenantContext(schoolId, async (tx) => {
      // 1. Lock payment row to prevent concurrent double-allocation
      await tx.$queryRaw`
        SELECT id FROM payments 
        WHERE id = ${paymentId}::uuid AND school_id = ${schoolId}::uuid 
        FOR UPDATE
      `;

      const lockedPayment = await tx.payment.findFirst({
        where: { id: paymentId, schoolId },
      });

      if (!lockedPayment) {
        throw new Error('Payment not found');
      }

      if (lockedPayment.status !== 'SUCCESS') {
        throw new Error(`Cannot allocate a payment with status ${lockedPayment.status}`);
      }

      const freshUnallocated = toDecimal(lockedPayment.advanceCreditAmount);
      if (sumRequested.greaterThan(freshUnallocated)) {
        throw new Error(
          `Total requested allocation (${sumRequested.toString()} BDT) exceeds payment available advance balance (${freshUnallocated.toString()} BDT)`
        );
      }

      const records = [];

      for (const a of allocations) {
        const amt = toDecimal(a.amount);

        // 2. Lock invoice row to prevent concurrent allocation race
        await tx.$queryRaw`
          SELECT id FROM student_fees 
          WHERE id = ${a.studentFeeId}::uuid AND school_id = ${schoolId}::uuid 
          FOR UPDATE
        `;

        // Verify invoice belongs to the same student and school
        const invoice = await tx.studentFee.findFirst({
          where: {
            id: a.studentFeeId,
            schoolId,
            studentId: lockedPayment.studentId,
          },
        });

        if (!invoice) {
          throw new Error(`Invoice ${a.studentFeeId} not found for this student`);
        }

        if (invoice.status === 'VOIDED' || invoice.status === 'WAIVED') {
          throw new Error(`Invoice ${invoice.invoiceNumber} is ${invoice.status}`);
        }

        const due = toDecimal(invoice.dueAmount);
        if (amt.greaterThan(due)) {
          throw new Error(
            `Allocation amount ${amt.toString()} exceeds invoice due ${due.toString()} for ${invoice.invoiceNumber}`
          );
        }

        const allocRecord = await tx.paymentAllocation.create({
          data: {
            schoolId,
            studentId: payment.studentId,
            paymentId: payment.id,
            studentFeeId: a.studentFeeId,
            amount: amt,
          },
        });
        records.push(allocRecord);
      }

      // Update payment record
      const newAllocated = addMoney(payment.allocatedAmount, sumRequested);
      const newAdvance = subMoney(payment.advanceCreditAmount, sumRequested);

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          allocatedAmount: newAllocated,
          advanceCreditAmount: newAdvance,
        },
      });

      // Deduct from student credit account
      const creditAccount = await tx.studentCreditAccount.findUnique({
        where: { studentId: payment.studentId },
      });

      if (creditAccount) {
        const balanceBefore = toDecimal(creditAccount.cachedBalance);
        const balanceAfter = subMoney(balanceBefore, sumRequested);

        await tx.studentCreditAccount.update({
          where: { id: creditAccount.id },
          data: {
            cachedBalance: balanceAfter,
          },
        });

        await tx.studentCreditTransaction.create({
          data: {
            schoolId,
            accountId: creditAccount.id,
            studentId: payment.studentId,
            transactionType: 'DEBIT',
            amount: sumRequested,
            balanceBefore,
            balanceAfter,
            referencePaymentId: paymentId,
            reason: 'Payment allocation of advance credit balance to invoices',
            authorizedById: context.userId,
          },
        });
      }

      return records;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'PaymentAllocation',
      entityId: paymentId,
      afterState: {
        paymentId,
        allocatedAmount: sumRequested.toNumber(),
        allocationCount: createdAllocations.length,
      },
      changeSummary: `Allocated ${sumRequested.toNumber()} BDT of advance credit from payment ${payment.paymentNumber}`,
    });

    return NextResponse.json({ success: true, data: createdAllocations }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
