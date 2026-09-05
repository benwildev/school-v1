import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';
import { formatCurrency } from '../report-formatters';

/**
 * 1. Employee Directory Report
 * Lists institutional employees, departments, designations, and statuses.
 */
export async function executeEmployeeDirectoryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId, deletedAt: null };
  if (filters.departmentId) whereClause.departmentId = filters.departmentId;
  if (filters.campusId) whereClause.campusId = filters.campusId;
  if (filters.status) whereClause.status = filters.status;

  if (filters.search) {
    whereClause.OR = [
      { employeeCode: { contains: filters.search, mode: 'insensitive' } },
      { fullNameEn: { contains: filters.search, mode: 'insensitive' } },
      { fullNameBn: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, employees] = await Promise.all([
    prisma.employee.count({ where: whereClause }),
    prisma.employee.findMany({
      where: whereClause,
      include: {
        department: { select: { nameEn: true } },
        designation: { select: { titleEn: true } },
        campus: { select: { nameEn: true } },
      },
      orderBy: { employeeCode: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  const columns: ReportColumn[] = [
    { key: 'employeeCode', labelEn: 'Employee ID', labelBn: 'আইডি', type: 'string' },
    { key: 'fullNameEn', labelEn: 'Name (EN)', labelBn: 'নাম (ইংরেজি)', type: 'string' },
    { key: 'fullNameBn', labelEn: 'Name (BN)', labelBn: 'নাম (বাংলা)', type: 'string' },
    { key: 'department', labelEn: 'Department', labelBn: 'বিভাগ', type: 'string' },
    { key: 'designation', labelEn: 'Designation', labelBn: 'পদবি', type: 'string' },
    { key: 'campus', labelEn: 'Campus', labelBn: 'ক্যাম্পাস', type: 'string' },
    { key: 'joiningDate', labelEn: 'Joining Date', labelBn: 'যোগদানের তারিখ', type: 'date' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = employees.map((e) => ({
    employeeCode: e.employeeCode,
    fullNameEn: e.fullNameEn,
    fullNameBn: e.fullNameBn || '-',
    department: e.department?.nameEn || 'General',
    designation: e.designation?.titleEn || 'Staff',
    campus: e.campus?.nameEn || '-',
    joiningDate: e.joiningDate ? e.joiningDate.toISOString().split('T')[0] : '-',
    status: e.status,
  }));

  return {
    data,
    totalCount,
    columns,
    summary: [
      { key: 'totalEmployees', labelEn: 'Total Staff', labelBn: 'মোট কর্মকর্তা-কর্মচারী', value: totalCount, type: 'number' },
    ],
  };
}

/**
 * 2. Department Headcount & Attendance Summary
 */
export async function executeDepartmentSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId } = ctx;

  const departments = await prisma.department.findMany({
    where: { schoolId },
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { nameEn: 'asc' },
  });

  const columns: ReportColumn[] = [
    { key: 'nameEn', labelEn: 'Department (EN)', labelBn: 'বিভাগ (ইংরেজি)', type: 'string' },
    { key: 'nameBn', labelEn: 'Department (BN)', labelBn: 'বিভাগ (বাংলা)', type: 'string' },
    { key: 'code', labelEn: 'Code', labelBn: 'কোড', type: 'string' },
    { key: 'activeCount', labelEn: 'Active Staff', labelBn: 'কর্মরত স্টাফ', type: 'number' },
  ];

  const data = departments.map((d) => ({
    nameEn: d.nameEn,
    nameBn: d.nameBn || '-',
    code: d.code,
    activeCount: d._count?.employees ?? 0,
  }));

  return {
    data,
    totalCount: data.length,
    columns,
  };
}

/**
 * 3. Payroll Summary & Department Cost Report
 * Finalized payroll periods are strictly immutable.
 */
export async function executePayrollSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.status) whereClause.status = filters.status;

  const periods = await prisma.payrollPeriod.findMany({
    where: whereClause,
    include: {
      _count: {
        select: { payrollRecords: true },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const columns: ReportColumn[] = [
    { key: 'periodName', labelEn: 'Payroll Period', labelBn: 'বেতন কাল', type: 'string' },
    { key: 'periodMonth', labelEn: 'Month/Year', labelBn: 'মাস/বছর', type: 'string' },
    { key: 'recordCount', labelEn: 'Staff Paid', labelBn: 'বেতনপ্রাপ্ত কর্মী', type: 'number' },
    { key: 'totalGross', labelEn: 'Total Gross (৳)', labelBn: 'মোট গ্রস (৳)', type: 'currency', align: 'right' },
    { key: 'totalDeductions', labelEn: 'Total Deductions (৳)', labelBn: 'মোট কর্তন (৳)', type: 'currency', align: 'right' },
    { key: 'totalNet', labelEn: 'Total Net Salary (৳)', labelBn: 'মোট প্রদেয় বেতন (৳)', type: 'currency', align: 'right' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  let cumulativeCost = 0;

  const data = periods.map((p) => {
    const net = Number(p.totalNet || 0);
    cumulativeCost += net;
    return {
      periodName: p.nameEn,
      periodMonth: p.periodKey,
      recordCount: p._count?.payrollRecords ?? 0,
      totalGross: Number(p.totalGross || 0),
      totalDeductions: Number(p.totalDeductions || 0),
      totalNet: net,
      status: p.status,
    };
  });


  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalPayrollCost', labelEn: 'Cumulative Disbursed', labelBn: 'সর্বমোট বিতরণকৃত', value: formatCurrency(cumulativeCost), type: 'currency' },
    ],
  };
}

/**
 * 4. Salary Advance & Recovery Report
 */
export async function executeSalaryAdvanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.status) whereClause.status = filters.status;

  const advances = await prisma.salaryAdvance.findMany({
    where: whereClause,
    include: {
      employee: { select: { employeeCode: true, fullNameEn: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const columns: ReportColumn[] = [
    { key: 'employeeCode', labelEn: 'Employee ID', labelBn: 'আইডি', type: 'string' },
    { key: 'name', labelEn: 'Staff Name', labelBn: 'নাম', type: 'string' },
    { key: 'requested', labelEn: 'Requested (৳)', labelBn: 'আবেদিত (৳)', type: 'currency', align: 'right' },
    { key: 'approved', labelEn: 'Approved (৳)', labelBn: 'অনুমোদিত (৳)', type: 'currency', align: 'right' },
    { key: 'recovered', labelEn: 'Recovered (৳)', labelBn: 'আদায়কৃত (৳)', type: 'currency', align: 'right' },
    { key: 'outstanding', labelEn: 'Outstanding (৳)', labelBn: 'অবশিষ্ট (৳)', type: 'currency', align: 'right' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = advances.map((a) => {
    const app = Number(a.approvedAmount || 0);
    const rem = Number(a.balanceRemaining || 0);
    const rec = Math.max(0, app - rem);
    return {
      employeeCode: a.employee.employeeCode,
      name: a.employee.fullNameEn,
      requested: Number(a.requestedAmount || 0),
      approved: app,
      recovered: rec,
      outstanding: rem,
      status: a.status,
    };
  });


  return {
    data,
    totalCount: data.length,
    columns,
  };
}
