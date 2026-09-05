import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { toDecimal, addMoney, subMoney, formatMoney } from './money';

export interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'REFUND' | 'CREDIT_ADJUSTMENT';
  referenceId: string;
  referenceNumber: string;
  description: string;
  debit: number; // Charges (increases due)
  credit: number; // Payments / credits (decreases due)
  runningBalance: number;
}

export interface StudentLedgerSummary {
  studentId: string;
  studentCode: string;
  studentName: string;
  totalInvoiced: number;
  totalPaid: number;
  totalRefunded: number;
  totalDue: number;
  creditWalletBalance: number;
  entries: LedgerEntry[];
}

/**
 * Builds an immutable, chronological financial ledger for a student.
 */
export async function generateStudentLedger(
  prisma: any,
  schoolId: string,
  studentId: string
): Promise<StudentLedgerSummary> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      creditAccount: true,
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // 1. Fetch Invoices
  const fees = await prisma.studentFee.findMany({
    where: {
      schoolId,
      studentId,
      status: { not: 'VOIDED' },
    },
    include: {
      feeType: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Fetch Payments
  const payments = await prisma.payment.findMany({
    where: {
      schoolId,
      studentId,
      status: 'SUCCESS',
    },
    orderBy: { paymentDate: 'asc' },
  });

  // 3. Fetch Refunds
  const refunds = await prisma.refund.findMany({
    where: {
      schoolId,
      studentId,
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'asc' },
  });

  // Combine into unified event stream
  type RawEvent = {
    timestamp: Date;
    type: 'INVOICE' | 'PAYMENT' | 'REFUND';
    referenceId: string;
    referenceNumber: string;
    description: string;
    debit: Decimal;
    credit: Decimal;
  };

  const rawEvents: RawEvent[] = [];

  for (const f of fees) {
    rawEvents.push({
      timestamp: new Date(f.createdAt),
      type: 'INVOICE',
      referenceId: f.id,
      referenceNumber: f.invoiceNumber,
      description: `${f.feeType?.nameEn || 'Fee'} (${f.billingPeriodKey})`,
      debit: toDecimal(f.netAmount),
      credit: new Decimal(0),
    });
  }

  for (const p of payments) {
    rawEvents.push({
      timestamp: new Date(p.paymentDate),
      type: 'PAYMENT',
      referenceId: p.id,
      referenceNumber: p.paymentNumber,
      description: `Payment via ${p.paymentMethod}${p.transactionId ? ` (Trx: ${p.transactionId})` : ''}`,
      debit: new Decimal(0),
      credit: toDecimal(p.totalAmount),
    });
  }

  for (const r of refunds) {
    rawEvents.push({
      timestamp: new Date(r.createdAt),
      type: 'REFUND',
      referenceId: r.id,
      referenceNumber: r.refundNumber,
      description: `Refund: ${r.reason}`,
      debit: toDecimal(r.amount),
      credit: new Decimal(0),
    });
  }

  // Sort chronologically
  rawEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Compute running balance
  let running = new Decimal(0);
  let totalInvoiced = new Decimal(0);
  let totalPaid = new Decimal(0);
  let totalRefunded = new Decimal(0);

  const entries: LedgerEntry[] = [];

  for (const ev of rawEvents) {
    if (ev.type === 'INVOICE') {
      totalInvoiced = addMoney(totalInvoiced, ev.debit);
      running = addMoney(running, ev.debit);
    } else if (ev.type === 'PAYMENT') {
      totalPaid = addMoney(totalPaid, ev.credit);
      running = subMoney(running, ev.credit);
    } else if (ev.type === 'REFUND') {
      totalRefunded = addMoney(totalRefunded, ev.debit);
      running = addMoney(running, ev.debit);
    }

    entries.push({
      date: ev.timestamp.toISOString().split('T')[0],
      type: ev.type,
      referenceId: ev.referenceId,
      referenceNumber: ev.referenceNumber,
      description: ev.description,
      debit: ev.debit.toNumber(),
      credit: ev.credit.toNumber(),
      runningBalance: running.toNumber(),
    });
  }

  const walletBalance = student.creditAccount
    ? toDecimal(student.creditAccount.cachedBalance).toNumber()
    : 0;

  return {
    studentId,
    studentCode: student.studentCode,
    studentName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    totalInvoiced: totalInvoiced.toNumber(),
    totalPaid: totalPaid.toNumber(),
    totalRefunded: totalRefunded.toNumber(),
    totalDue: Math.max(0, running.toNumber()),
    creditWalletBalance: walletBalance,
    entries,
  };
}
