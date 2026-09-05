import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';
import { formatCurrency } from '../report-formatters';

/**
 * 1. Fee Collection Report
 * Authoritative collections broken down by payment date, invoice, and payment method.
 * Financial exactness: All arithmetic uses string/Decimal conversions or integer-cents.
 */
export async function executeFeeCollectionReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = {
    schoolId,
    status: 'SUCCESS',
  };

  if (filters.startDate && filters.endDate) {
    whereClause.paymentDate = {
      gte: new Date(filters.startDate),
      lte: new Date(`${filters.endDate}T23:59:59.999Z`),
    };
  } else if (filters.startDate) {
    whereClause.paymentDate = { gte: new Date(filters.startDate) };
  }

  if (filters.paymentStatus) {
    whereClause.paymentMethod = filters.paymentStatus;
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, payments, sumAggregate] = await Promise.all([
    prisma.payment.count({ where: whereClause }),
    prisma.payment.findMany({
      where: whereClause,
      include: {
        student: { select: { studentCode: true, fullNameEn: true } },
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.aggregate({
      where: whereClause,
      _sum: { totalAmount: true },
    }),
  ]);

  const totalCollected = Number(sumAggregate._sum.totalAmount || 0);

  const columns: ReportColumn[] = [
    { key: 'receiptNumber', labelEn: 'Receipt No', labelBn: 'রশিদ নম্বর', type: 'string' },
    { key: 'paymentDate', labelEn: 'Date', labelBn: 'তারিখ', type: 'date' },
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'studentName', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'paymentMethod', labelEn: 'Payment Method', labelBn: 'পরিশোধের মাধ্যম', type: 'badge' },
    { key: 'amount', labelEn: 'Collected Amount', labelBn: 'আদায়কৃত পরিমাণ', type: 'currency', align: 'right' },
  ];

  const data = payments.map((p) => ({
    receiptNumber: p.paymentNumber,
    paymentDate: p.paymentDate.toISOString().split('T')[0],
    studentCode: p.student.studentCode,
    studentName: p.student.fullNameEn,
    paymentMethod: p.paymentMethod,
    amount: Number(p.totalAmount),
  }));


  return {
    data,
    totalCount,
    columns,
    summary: [
      { key: 'totalTransactions', labelEn: 'Transactions', labelBn: 'মোট লেনদেন', value: totalCount, type: 'number' },
      { key: 'totalCollected', labelEn: 'Total Collected', labelBn: 'মোট আদায়', value: formatCurrency(totalCollected), type: 'currency' },
    ],
  };
}

/**
 * 2. Outstanding Due & Aging Report
 * Buckets receivables into 0-30 days, 31-60 days, 61-90 days, 90+ days.
 */
export async function executeOutstandingAgingReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const now = new Date();
  const whereClause: any = {
    schoolId,
    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    dueAmount: { gt: 0 },
  };

  if (filters.academicSessionId) whereClause.academicSessionId = filters.academicSessionId;
  if (filters.studentId) whereClause.studentId = filters.studentId;

  const dueFees = await prisma.studentFee.findMany({
    where: whereClause,
    include: {
      student: { select: { studentCode: true, fullNameEn: true } },
      feeType: { select: { nameEn: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  let bucket0_30 = 0;
  let bucket31_60 = 0;
  let bucket61_90 = 0;
  let bucket90Plus = 0;
  let totalDue = 0;

  const data = dueFees.map((f) => {
    const dueDate = new Date(f.dueDate);
    const diffDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const due = Number(f.dueAmount);
    totalDue += due;

    let agingBucket = '0–30 days';
    if (diffDays > 90) {
      agingBucket = '90+ days';
      bucket90Plus += due;
    } else if (diffDays > 60) {
      agingBucket = '61–90 days';
      bucket61_90 += due;
    } else if (diffDays > 30) {
      agingBucket = '31–60 days';
      bucket31_60 += due;
    } else {
      bucket0_30 += due;
    }

    return {
      id: f.id,
      studentCode: f.student.studentCode,
      studentName: f.student.fullNameEn,
      feeTitle: f.feeType?.nameEn || 'Tuition Fee',
      dueDate: f.dueDate.toISOString().split('T')[0],
      daysOverdue: diffDays,

      agingBucket,
      dueAmount: due,
      status: f.status,
    };
  });

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'studentName', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'feeTitle', labelEn: 'Fee Description', labelBn: 'ফি বিবরণ', type: 'string' },
    { key: 'dueDate', labelEn: 'Due Date', labelBn: 'নির্ধারিত তারিখ', type: 'date' },
    { key: 'daysOverdue', labelEn: 'Days Overdue', labelBn: 'অতিক্রান্ত দিন', type: 'number' },
    { key: 'agingBucket', labelEn: 'Aging Bucket', labelBn: 'বকেয়ার মেয়াদ', type: 'badge' },
    { key: 'dueAmount', labelEn: 'Due Amount', labelBn: 'বকেয়া পরিমাণ', type: 'currency', align: 'right' },
  ];

  const charts = [
    {
      id: 'agingDistributionChart',
      type: 'bar' as const,
      titleEn: 'Receivables Aging Distribution',
      titleBn: 'বকেয়া মেয়াদের বণ্টন',
      labels: ['0–30 Days', '31–60 Days', '61–90 Days', '90+ Days'],
      datasets: [
        {
          label: 'Outstanding Amount (৳)',
          data: [bucket0_30, bucket31_60, bucket61_90, bucket90Plus],
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalOutstanding', labelEn: 'Total Outstanding', labelBn: 'মোট বকেয়া', value: formatCurrency(totalDue), type: 'currency' },
      { key: 'criticalDue', labelEn: 'Overdue > 90 Days', labelBn: '৯০+ দিনের বকেয়া', value: formatCurrency(bucket90Plus), type: 'currency' },
      { key: 'unpaidInvoicesCount', labelEn: 'Unpaid Invoices', labelBn: 'অবিক্রীত ইনভয়েস', value: data.length, type: 'number' },
    ],
    charts,
  };
}

/**
 * 3. Payment Method Distribution Report
 */
export async function executePaymentMethodsReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId, status: 'SUCCESS' };
  if (filters.startDate && filters.endDate) {
    whereClause.paymentDate = {
      gte: new Date(filters.startDate),
      lte: new Date(`${filters.endDate}T23:59:59.999Z`),
    };
  }

  const payments = await prisma.payment.findMany({
    where: whereClause,
    select: {
      paymentMethod: true,
      totalAmount: true,
    },
  });

  const methodMap: Record<string, { count: number; totalAmount: number }> = {};
  let grandTotal = 0;

  for (const p of payments) {
    const m = p.paymentMethod || 'OTHER';
    if (!methodMap[m]) methodMap[m] = { count: 0, totalAmount: 0 };
    const amt = Number(p.totalAmount);
    methodMap[m].count++;
    methodMap[m].totalAmount += amt;
    grandTotal += amt;
  }

  const columns: ReportColumn[] = [
    { key: 'method', labelEn: 'Payment Method', labelBn: 'পরিশোধের মাধ্যম', type: 'string' },
    { key: 'count', labelEn: 'Transaction Count', labelBn: 'লেনদেন সংখ্যা', type: 'number' },
    { key: 'total', labelEn: 'Total Amount', labelBn: 'মোট পরিমাণ', type: 'currency', align: 'right' },
    { key: 'percentage', labelEn: 'Share (%)', labelBn: 'অংশীদারিত্ব (%)', type: 'percentage' },
  ];

  const data = Object.entries(methodMap).map(([m, stats]) => ({
    method: m,
    count: stats.count,
    total: stats.totalAmount,
    percentage: grandTotal > 0 ? Number(((stats.totalAmount / grandTotal) * 100).toFixed(1)) : 0,
  }));

  const charts = [
    {
      id: 'paymentMethodPie',
      type: 'donut' as const,
      titleEn: 'Collection by Channel',
      titleBn: 'চ্যানেলভিত্তিক আদায়',
      labels: data.map((d) => d.method),
      datasets: [
        {
          label: 'Amount (৳)',
          data: data.map((d) => d.total),
          backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'grandTotal', labelEn: 'Total Collected', labelBn: 'মোট সংগৃহীত', value: formatCurrency(grandTotal), type: 'currency' },
    ],
    charts,
  };
}

/**
 * 4. Student Financial Ledger Report
 * Provides a debit/credit ledger for a single student.
 */
export async function executeStudentLedgerReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  if (!filters.studentId) {
    return {
      data: [],
      totalCount: 0,
      columns: [],
      summary: [{ key: 'error', labelEn: 'Select Student', labelBn: 'শিক্ষার্থী নির্বাচন করুন', value: 'Student ID is required', type: 'string' }],
    };
  }

  const [fees, payments] = await Promise.all([
    prisma.studentFee.findMany({
      where: { schoolId, studentId: filters.studentId },
      include: { feeType: { select: { nameEn: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { schoolId, studentId: filters.studentId, status: 'SUCCESS' },
      orderBy: { paymentDate: 'asc' },
    }),
  ]);

  interface LedgerEntry {
    date: string;
    description: string;
    type: 'DEBIT' | 'CREDIT';
    debit: number;
    credit: number;
    balance: number;
  }

  const entries: { date: Date; entry: LedgerEntry }[] = [];

  for (const f of fees) {
    entries.push({
      date: f.createdAt,
      entry: {
        date: f.createdAt.toISOString().split('T')[0],
        description: `Fee Assessed: ${f.feeType?.nameEn || 'Tuition'}`,
        type: 'DEBIT',
        debit: Number(f.netAmount),
        credit: 0,
        balance: 0,
      },
    });
  }

  for (const p of payments) {
    entries.push({
      date: p.paymentDate,
      entry: {
        date: p.paymentDate.toISOString().split('T')[0],
        description: `Payment: Receipt #${p.paymentNumber} (${p.paymentMethod})`,
        type: 'CREDIT',
        debit: 0,
        credit: Number(p.totalAmount),

        balance: 0,
      },
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  const data: LedgerEntry[] = [];

  for (const item of entries) {
    if (item.entry.type === 'DEBIT') {
      runningBalance += item.entry.debit;
    } else {
      runningBalance -= item.entry.credit;
    }
    item.entry.balance = runningBalance;
    data.push(item.entry);
  }

  const columns: ReportColumn[] = [
    { key: 'date', labelEn: 'Date', labelBn: 'তারিখ', type: 'date' },
    { key: 'description', labelEn: 'Particulars', labelBn: 'বিবরণ', type: 'string' },
    { key: 'debit', labelEn: 'Debit (৳)', labelBn: 'ডেবিট (৳)', type: 'currency', align: 'right' },
    { key: 'credit', labelEn: 'Credit (৳)', labelBn: 'ক্রেডিট (৳)', type: 'currency', align: 'right' },
    { key: 'balance', labelEn: 'Running Due (৳)', labelBn: 'মোট বকেয়া (৳)', type: 'currency', align: 'right' },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'finalBalance', labelEn: 'Current Balance Due', labelBn: 'বর্তমান বকেয়া স্থিতি', value: formatCurrency(runningBalance), type: 'currency' },
    ],
  };
}

/**
 * 5. Discounts & Concessions Report
 */
export async function executeDiscountsReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.studentId) whereClause.studentId = filters.studentId;

  const discounts = await prisma.studentDiscount.findMany({
    where: whereClause,
    include: {
      student: { select: { studentCode: true, fullNameEn: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'name', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'discountType', labelEn: 'Discount Type', labelBn: 'ছাড়ের ধরন', type: 'string' },
    { key: 'value', labelEn: 'Value', labelBn: 'পরিমাণ / হার', type: 'string' },
    { key: 'reason', labelEn: 'Concession Reason', labelBn: 'ছাড়ের কারণ', type: 'string' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = discounts.map((d) => ({
    studentCode: d.student.studentCode,
    name: d.student.fullNameEn,
    discountType: d.discountType,
    value: d.discountType === 'PERCENTAGE' ? `${d.discountValue}%` : `৳${d.discountValue}`,
    reason: d.reason || 'Scholarship / Concession',
    status: d.status,
  }));

  return {
    data,
    totalCount: data.length,
    columns,
  };
}
