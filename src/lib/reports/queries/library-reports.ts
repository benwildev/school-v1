import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';
import { formatCurrency } from '../report-formatters';

/**
 * 1. Library Circulation & Active Loans Report
 */
export async function executeLibraryCirculationReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.status) whereClause.status = filters.status;

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, loans] = await Promise.all([
    prisma.libraryLoan.count({ where: whereClause }),
    prisma.libraryLoan.findMany({
      where: whereClause,
      include: {
        copy: {
          include: {
            book: { select: { titleEn: true, isbn13: true } },
          },
        },
        student: { select: { studentCode: true, fullNameEn: true } },
        employee: { select: { employeeCode: true, fullNameEn: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const columns: ReportColumn[] = [
    { key: 'accessionNumber', labelEn: 'Accession No', labelBn: 'একসেশন নম্বর', type: 'string' },
    { key: 'bookTitle', labelEn: 'Book Title', labelBn: 'বইয়ের নাম', type: 'string' },
    { key: 'borrowerType', labelEn: 'Borrower Type', labelBn: 'গ্রহীতার ধরন', type: 'badge' },
    { key: 'borrowerName', labelEn: 'Borrower Name', labelBn: 'গ্রহীতার নাম', type: 'string' },
    { key: 'issueDate', labelEn: 'Issue Date', labelBn: 'ইস্যুর তারিখ', type: 'date' },
    { key: 'dueDate', labelEn: 'Due Date', labelBn: 'ফেরতের শেষ তারিখ', type: 'date' },
    { key: 'status', labelEn: 'Loan Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = loans.map((l) => ({
    accessionNumber: l.copy.accessionNumber,
    bookTitle: l.copy.book.titleEn,
    borrowerType: l.borrowerType,
    borrowerName: l.borrowerType === 'STUDENT' ? l.student?.fullNameEn : l.employee?.fullNameEn,
    issueDate: l.issueDate.toISOString().split('T')[0],
    dueDate: l.dueDate.toISOString().split('T')[0],
    status: l.status,
  }));

  const activeLoansCount = await prisma.libraryLoan.count({
    where: { schoolId, status: { in: ['ISSUED', 'OVERDUE'] } },
  });
  const overdueCount = await prisma.libraryLoan.count({
    where: { schoolId, status: 'OVERDUE' },
  });

  return {
    data,
    totalCount,
    columns,
    summary: [
      { key: 'activeLoans', labelEn: 'Active Borrowed Books', labelBn: 'বর্তমান ইস্যুকৃত বই', value: activeLoansCount, type: 'number' },
      { key: 'overdueLoans', labelEn: 'Overdue Books', labelBn: 'মেয়াদোত্তীর্ণ বই', value: overdueCount, type: 'number' },
    ],
  };
}

/**
 * 2. Popular & Most Borrowed Books Report
 */
export async function executePopularBooksReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId } = ctx;

  const books = await prisma.libraryBook.findMany({
    where: { schoolId },
    include: {
      category: { select: { nameEn: true } },
      copies: {
        include: {
          loans: { select: { id: true } },
        },
      },
    },
  });

  const columns: ReportColumn[] = [
    { key: 'title', labelEn: 'Book Title', labelBn: 'বইয়ের নাম', type: 'string' },
    { key: 'category', labelEn: 'Category', labelBn: 'বিভাগ', type: 'string' },
    { key: 'totalCopies', labelEn: 'Total Copies', labelBn: 'মোট কপি', type: 'number' },
    { key: 'borrowCount', labelEn: 'Times Borrowed', labelBn: 'ধার দেওয়ার সংখ্যা', type: 'number' },
  ];

  const data = books.map((b) => {
    let borrowCount = 0;
    for (const copy of b.copies) {
      borrowCount += copy.loans.length;
    }
    return {
      title: b.titleEn,
      category: b.category?.nameEn || 'General',
      totalCopies: b.copies.length,
      borrowCount,
    };
  });

  data.sort((a, b) => b.borrowCount - a.borrowCount);

  return {
    data: data.slice(0, 50),
    totalCount: data.length,
    columns,
  };
}

/**
 * 3. Library Overdue & Fines Report
 */
export async function executeLibraryFinesReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.status) whereClause.status = filters.status;

  const fines = await prisma.libraryFine.findMany({
    where: whereClause,
    include: {
      loan: {
        include: {
          copy: {
            include: {
              book: { select: { titleEn: true } },
            },
          },
        },
      },
      student: { select: { studentCode: true, fullNameEn: true } },
      employee: { select: { employeeCode: true, fullNameEn: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalFined = 0;
  let totalPaid = 0;

  const columns: ReportColumn[] = [
    { key: 'borrower', labelEn: 'Borrower', labelBn: 'গ্রহীতা', type: 'string' },
    { key: 'bookTitle', labelEn: 'Book Title', labelBn: 'বইয়ের নাম', type: 'string' },
    { key: 'fineType', labelEn: 'Fine Type', labelBn: 'জরিমানার ধরন', type: 'badge' },
    { key: 'amount', labelEn: 'Fine Amount (৳)', labelBn: 'পরিমাণ (৳)', type: 'currency', align: 'right' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = fines.map((f) => {
    const amt = Number(f.fineAmount || 0);
    totalFined += amt;
    if (f.status === 'PAID') totalPaid += amt;

    const borrowerName = f.borrowerType === 'STUDENT' ? f.student?.fullNameEn : f.employee?.fullNameEn;
    return {
      borrower: borrowerName || '-',
      bookTitle: f.loan?.copy?.book?.titleEn || '-',
      fineType: f.fineType,
      amount: amt,
      status: f.status,
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalFined', labelEn: 'Total Assessed Fines', labelBn: 'মোট জরিমানার পরিমাণ', value: formatCurrency(totalFined), type: 'currency' },
      { key: 'totalCollected', labelEn: 'Fines Collected', labelBn: 'আদায়কৃত জরিমানা', value: formatCurrency(totalPaid), type: 'currency' },
    ],
  };
}
