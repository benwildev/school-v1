import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { RefundCreateSchema } from '@/lib/validation/finance';
import { generateRefundNumber } from '@/lib/finance/invoice';
import { toDecimal, addMoney, subMoney } from '@/lib/finance/money';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/refunds
 * Required Permission: PAYMENTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_VIEW',
    });

    const refunds = await prisma.refund.findMany({
      where: { schoolId },
      include: {
        payment: {
          select: {
            paymentNumber: true,
            totalAmount: true,
            paymentMethod: true,
          },
        },
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
        approvedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: refunds });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/school/finance/refunds
 * Process a payment refund / reversal with audit approval
 * Required Permission: PAYMENTS_REFUND (Accountant is strictly BLOCKED from processing refunds)
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_REFUND',
    });

    const body = await request.json();
    const parseResult = RefundCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const refundAmt = toDecimal(data.amount);

    const payment = await prisma.payment.findFirst({
      where: {
        id: data.paymentId,
        schoolId,
        studentId: data.studentId,
      },
      include: {
        refunds: true,
        allocations: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found for this student in this school' },
        { status: 404 }
      );
    }

    if (payment.status !== 'SUCCESS') {
      return NextResponse.json(
        { error: `Cannot refund payment with status ${payment.status}` },
        { status: 400 }
      );
    }

    // Calculate previously refunded amount
    let alreadyRefunded = new Decimal(0);
    for (const r of payment.refunds) {
      if (r.status === 'COMPLETED' || r.status === 'APPROVED') {
        alreadyRefunded = addMoney(alreadyRefunded, r.amount);
      }
    }

    const maxRefundable = subMoney(payment.totalAmount, alreadyRefunded);
    if (refundAmt.greaterThan(maxRefundable)) {
      return NextResponse.json(
        {
          error: `Refund amount (${refundAmt.toString()} BDT) exceeds max refundable balance (${maxRefundable.toString()} BDT)`,
        },
        { status: 400 }
      );
    }

    const refundNumber = generateRefundNumber();

    const refund = await withTenantContext(schoolId, async (tx) => {
      // 1. Create Refund record
      const createdRefund = await tx.refund.create({
        data: {
          schoolId,
          refundNumber,
          paymentId: data.paymentId,
          studentId: data.studentId,
          amount: refundAmt,
          reason: data.reason,
          refundMethod: data.refundMethod,
          transactionRef: data.transactionRef || null,
          status: 'COMPLETED',
          approvedById: context.userId,
        },
      });

      // 2. Adjust payment status if fully refunded
      const newTotalRefunded = addMoney(alreadyRefunded, refundAmt);
      if (newTotalRefunded.equals(toDecimal(payment.totalAmount))) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED' },
        });
      }

      // 3. Deduct from student advance credit if payment had advance credit
      const currentAdvance = toDecimal(payment.advanceCreditAmount);
      if (currentAdvance.greaterThan(0)) {
        const creditDeduction = Decimal.min(currentAdvance, refundAmt);
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            advanceCreditAmount: subMoney(currentAdvance, creditDeduction),
          },
        });

        const creditAccount = await tx.studentCreditAccount.findUnique({
          where: { studentId: data.studentId },
        });

        if (creditAccount) {
          const balanceBefore = toDecimal(creditAccount.cachedBalance);
          const balanceAfter = subMoney(balanceBefore, creditDeduction);

          await tx.studentCreditAccount.update({
            where: { id: creditAccount.id },
            data: { cachedBalance: balanceAfter },
          });

          await tx.studentCreditTransaction.create({
            data: {
              schoolId,
              accountId: creditAccount.id,
              studentId: data.studentId,
              transactionType: 'REFUND',
              amount: creditDeduction,
              balanceBefore,
              balanceAfter,
              referencePaymentId: payment.id,
              referenceRefundId: createdRefund.id,
              reason: `Refund from payment ${payment.paymentNumber}: ${data.reason}`,
              authorizedById: context.userId,
            },
          });
        }
      }

      return createdRefund;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: AuditAction.REFUND,
      entity: 'Refund',
      entityId: refund.id,
      afterState: refund,
      changeSummary: `Processed refund ${refund.refundNumber} of ${refundAmt.toString()} BDT for payment ${payment.paymentNumber}. Reason: ${data.reason}`,
    });

    return NextResponse.json({ success: true, data: refund }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
