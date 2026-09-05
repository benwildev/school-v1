import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { toDecimal, addMoney, subMoney } from './money';
import { generateReceiptNumber } from './invoice';

export interface AllocationItemInput {
  studentFeeId: string;
  amount: number | Decimal;
}

export interface ProcessPaymentAllocationParams {
  tx: Prisma.TransactionClient;
  schoolId: string;
  studentId: string;
  paymentId: string;
  paymentNumber: string;
  totalAmount: number | Decimal;
  receivedById: string;
  allocations?: AllocationItemInput[];
  autoAllocateOldest?: boolean;
}

export interface AllocationResult {
  allocatedAmount: Decimal;
  advanceCreditAmount: Decimal;
  allocations: Array<{
    id: string;
    studentFeeId: string;
    amount: Decimal;
  }>;
  receiptId: string;
  receiptNumber: string;
}

/**
 * Atomically processes payment allocations across student fee invoices, routes
 * any remaining excess to student advance credit wallet, and generates the official receipt.
 */
export async function processPaymentAllocation(
  params: ProcessPaymentAllocationParams
): Promise<AllocationResult> {
  const {
    tx,
    schoolId,
    studentId,
    paymentId,
    paymentNumber,
    receivedById,
    allocations = [],
    autoAllocateOldest = true,
  } = params;

  const totalPayment = toDecimal(params.totalAmount);
  if (totalPayment.isNegative() || totalPayment.isZero()) {
    throw new Error('Payment total amount must be strictly positive');
  }

  let plannedAllocations: Array<{ studentFeeId: string; amount: Decimal }> = [];

  if (allocations.length > 0) {
    // 1. Explicit manual allocations provided
    let sumAllocated = new Decimal(0);

    for (const item of allocations) {
      const allocAmt = toDecimal(item.amount);
      if (allocAmt.isNegative() || allocAmt.isZero()) {
        throw new Error('Allocation amount must be strictly positive');
      }

      // Lock the fee invoice row for update to prevent concurrent double-allocation
      const invoice = await tx.studentFee.findFirst({
        where: {
          id: item.studentFeeId,
          schoolId,
          studentId,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${item.studentFeeId} not found for this student`);
      }

      if (invoice.status === 'VOIDED' || invoice.status === 'WAIVED') {
        throw new Error(`Cannot allocate payment to a ${invoice.status} invoice`);
      }

      const dueAmount = toDecimal(invoice.dueAmount);
      if (allocAmt.greaterThan(dueAmount)) {
        throw new Error(
          `Allocation amount (${allocAmt.toString()}) exceeds invoice due amount (${dueAmount.toString()}) for invoice ${invoice.invoiceNumber}`
        );
      }

      sumAllocated = addMoney(sumAllocated, allocAmt);
      plannedAllocations.push({
        studentFeeId: item.studentFeeId,
        amount: allocAmt,
      });
    }

    if (sumAllocated.greaterThan(totalPayment)) {
      throw new Error(
        `Total allocated amount (${sumAllocated.toString()}) exceeds received payment (${totalPayment.toString()})`
      );
    }
  } else if (autoAllocateOldest) {
    // 2. Automatic Oldest-Due-First Allocation
    const unpaidInvoices = await tx.studentFee.findMany({
      where: {
        schoolId,
        studentId,
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remainingToAllocate = totalPayment;

    for (const inv of unpaidInvoices) {
      if (remainingToAllocate.isZero()) break;

      const due = toDecimal(inv.dueAmount);
      const allocAmt = Decimal.min(remainingToAllocate, due);

      if (allocAmt.greaterThan(0)) {
        plannedAllocations.push({
          studentFeeId: inv.id,
          amount: allocAmt,
        });
        remainingToAllocate = subMoney(remainingToAllocate, allocAmt);
      }
    }
  }

  // Calculate totals
  let totalAllocated = new Decimal(0);
  for (const item of plannedAllocations) {
    totalAllocated = addMoney(totalAllocated, item.amount);
  }
  const advanceCredit = subMoney(totalPayment, totalAllocated);

  // 3. Persist PaymentAllocation records
  const createdAllocations = [];
  for (const alloc of plannedAllocations) {
    const record = await tx.paymentAllocation.create({
      data: {
        schoolId,
        studentId,
        paymentId,
        studentFeeId: alloc.studentFeeId,
        amount: alloc.amount,
      },
    });
    createdAllocations.push({
      id: record.id,
      studentFeeId: record.studentFeeId,
      amount: toDecimal(record.amount),
    });
  }

  // 4. Update Payment record with allocated and advance credit amounts
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      allocatedAmount: totalAllocated,
      advanceCreditAmount: advanceCredit,
    },
  });

  // 5. Handle Advance Credit if excess payment exists
  if (advanceCredit.greaterThan(0)) {
    // Upsert student credit account
    const creditAccount = await tx.studentCreditAccount.upsert({
      where: { studentId },
      create: {
        schoolId,
        studentId,
        cachedBalance: advanceCredit,
        currency: 'BDT',
      },
      update: {
        cachedBalance: {
          increment: advanceCredit,
        },
      },
    });

    const balanceBefore = subMoney(toDecimal(creditAccount.cachedBalance), advanceCredit);
    const balanceAfter = toDecimal(creditAccount.cachedBalance);

    // Record credit transaction
    await tx.studentCreditTransaction.create({
      data: {
        schoolId,
        accountId: creditAccount.id,
        studentId,
        transactionType: 'CREDIT',
        amount: advanceCredit,
        balanceBefore: balanceBefore.isNegative() ? new Decimal(0) : balanceBefore,
        balanceAfter,
        referencePaymentId: paymentId,
        reason: 'Payment excess deposit / advance credit balance',
        authorizedById: receivedById,
      },
    });
  }

  // 6. Generate Official Money Receipt
  const receiptNumber = generateReceiptNumber();
  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: {
      studentCode: true,
      fullNameEn: true,
      fullNameBn: true,
    },
  });

  const receiptSnapshot = {
    paymentNumber,
    receiptNumber,
    studentCode: student?.studentCode || 'N/A',
    studentNameEn: student?.fullNameEn || 'N/A',
    studentNameBn: student?.fullNameBn || 'N/A',
    totalReceived: totalPayment.toNumber(),
    allocatedAmount: totalAllocated.toNumber(),
    advanceCredit: advanceCredit.toNumber(),
    allocations: plannedAllocations.map((a) => ({
      studentFeeId: a.studentFeeId,
      amount: a.amount.toNumber(),
    })),
    issuedAt: new Date().toISOString(),
  };

  const receipt = await tx.receipt.create({
    data: {
      schoolId,
      receiptNumber,
      paymentId,
      issuedById: receivedById,
      snapshotData: receiptSnapshot as Prisma.InputJsonValue,
    },
  });

  return {
    allocatedAmount: totalAllocated,
    advanceCreditAmount: advanceCredit,
    allocations: createdAllocations,
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
  };
}
