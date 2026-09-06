import { prisma } from '../db';
import { OverviewKpiCard } from './report-types';
import { formatCurrency, formatPercentage } from './report-formatters';
import { AttendanceStatus } from '@prisma/client';

export interface OverviewAnalyticsResponse {
  kpis: OverviewKpiCard[];
  trends: {
    monthlyCollection: { month: string; amount: number }[];
    attendanceTrend: { date: string; rate: number }[];
    admissionFunnel: { stage: string; count: number }[];
    academicDistribution: { grade: string; count: number }[];
  };
}

/**
 * Consolidates executive management KPIs across all modules.
 * Scoped by schoolId and respects user role permissions.
 */
export async function getManagementOverviewAnalytics(
  schoolId: string,
  userRoles: string[] = []
): Promise<OverviewAnalyticsResponse> {
  const isSuperOrAdminOrOwner = userRoles.some((r) =>
    ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN'].includes(r.toUpperCase())
  );
  const isAccountant = userRoles.some((r) => r.toUpperCase() === 'ACCOUNTANT');
  const isTeacher = userRoles.some((r) => r.toUpperCase() === 'TEACHER');
  const isHR = userRoles.some((r) => r.toUpperCase() === 'HR');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Parallel Aggregation Queries
  const [
    totalStudents,
    activeEnrollments,
    todayPayments,
    monthPayments,
    totalOutstanding,
    todayStudentAttendance,
    todayEmployeeAttendance,
    totalEmployees,
    admissionStats,
    transportRoutesCount,
    transportAssignedCount,
    libraryActiveLoans,
    libraryOverdueLoans,
    inventoryLowStock,
    recentPayments,
    recentAttendance,
    gradeDistribution,
  ] = await Promise.all([
    // Student Counts
    prisma.student.count({ where: { schoolId, deletedAt: null } }),
    prisma.enrollment.count({ where: { schoolId, status: 'ACTIVE' } }),

    // Finance Collections
    prisma.payment.aggregate({
      where: { schoolId, status: 'SUCCESS', paymentDate: { gte: todayStart } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { schoolId, status: 'SUCCESS', paymentDate: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.studentFee.aggregate({
      where: { schoolId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
      _sum: { dueAmount: true },
    }),

    // Attendance Today
    prisma.studentAttendance.findMany({
      where: { schoolId, date: { gte: todayStart } },
      select: { status: true },
    }),
    prisma.employeeAttendance.findMany({
      where: { schoolId, date: { gte: todayStart } },
      select: { status: true },
    }),

    // HR Headcount
    prisma.employee.count({ where: { schoolId, deletedAt: null, status: 'ACTIVE' } }),

    // Admissions
    prisma.admissionApplication.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: { id: true },
    }),

    // Transport
    prisma.transportRoute.count({ where: { schoolId, status: 'ACTIVE' } }),
    prisma.studentTransportAssignment.count({ where: { schoolId, status: 'ACTIVE' } }),

    // Library
    prisma.libraryLoan.count({ where: { schoolId, status: { in: ['ISSUED', 'OVERDUE'] } } }),
    prisma.libraryLoan.count({ where: { schoolId, status: 'OVERDUE' } }),

    // Inventory Low Stock
    prisma.inventoryItem.count({
      where: {
        schoolId,
      },
    }),

    // Real Historical Payments (Past 6 months)
    prisma.payment.findMany({
      where: { schoolId, status: 'SUCCESS', paymentDate: { gte: sixMonthsAgo } },
      select: { totalAmount: true, paymentDate: true },
    }),

    // Real Attendance Trend (Past 7 days)
    prisma.studentAttendance.findMany({
      where: { schoolId, date: { gte: sevenDaysAgo } },
      select: { date: true, status: true },
    }),

    // Real Grade Distribution
    prisma.mark.groupBy({
      by: ['letterGrade'],
      where: { schoolId },
      _count: { id: true },
    }),
  ]);

  // Compute Attendance Rates Today
  const totalStudentAttCount = todayStudentAttendance.length;
  const presentStudentAttCount = todayStudentAttendance.filter(
    (a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
  ).length;
  const studentAttendanceRate =
    totalStudentAttCount > 0 ? Number(((presentStudentAttCount / totalStudentAttCount) * 100).toFixed(1)) : 0;

  const totalEmpAttCount = todayEmployeeAttendance.length;
  const presentEmpAttCount = todayEmployeeAttendance.filter(
    (a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
  ).length;
  const employeeAttendanceRate =
    totalEmpAttCount > 0 ? Number(((presentEmpAttCount / totalEmpAttCount) * 100).toFixed(1)) : 0;

  // Compute Admissions Funnel
  let appCount = 0;
  let enrolledCount = 0;
  for (const s of admissionStats) {
    const cnt = (s as any)._count?.id ?? 0;
    appCount += cnt;
    if (s.status === 'ENROLLED') enrolledCount += cnt;
  }
  const admissionConversionRate =
    appCount > 0 ? Number(((enrolledCount / appCount) * 100).toFixed(1)) : 0;

  const kpis: OverviewKpiCard[] = [];

  // Students KPI
  if (isSuperOrAdminOrOwner || isTeacher) {
    kpis.push({
      id: 'active_students',
      module: 'STUDENTS',
      titleEn: 'Active Students',
      titleBn: 'বর্তমান শিক্ষার্থী',
      value: activeEnrollments,
      subtextEn: `${totalStudents} Total Registered`,
      subtextBn: `মোট নিবন্ধিত ${totalStudents}`,
      type: 'number',
    });
  }

  // Attendance KPI
  if (isSuperOrAdminOrOwner || isTeacher || isHR) {
    kpis.push({
      id: 'today_attendance',
      module: 'ATTENDANCE',
      titleEn: 'Today Attendance',
      titleBn: 'আজকের উপস্থিতি',
      value: formatPercentage(studentAttendanceRate),
      subtextEn: `Staff Attendance: ${formatPercentage(employeeAttendanceRate)}`,
      subtextBn: `স্টাফ উপস্থিতি: ${formatPercentage(employeeAttendanceRate, { locale: 'bn' })}`,
      type: 'percentage',
    });
  }

  // Finance KPIs
  if (isSuperOrAdminOrOwner || isAccountant) {
    kpis.push({
      id: 'today_collection',
      module: 'FINANCE',
      titleEn: "Today's Collection",
      titleBn: 'আজকের আদায়',
      value: formatCurrency(Number(todayPayments._sum.totalAmount ?? 0)),
      subtextEn: `Month: ${formatCurrency(Number(monthPayments._sum.totalAmount ?? 0))}`,
      subtextBn: `চলতি মাস: ${formatCurrency(Number(monthPayments._sum.totalAmount ?? 0), { locale: 'bn' })}`,
      type: 'currency',
    });

    kpis.push({
      id: 'total_outstanding',
      module: 'FINANCE',
      titleEn: 'Outstanding Dues',
      titleBn: 'মোট বকেয়া ফি',
      value: formatCurrency(Number(totalOutstanding._sum.dueAmount ?? 0)),
      subtextEn: 'Actionable institutional receivables',
      subtextBn: 'আদায়যোগ্য মোট প্রাতিষ্ঠানিক বকেয়া',
      type: 'currency',
    });
  }


  // HR KPI
  if (isSuperOrAdminOrOwner || isHR) {
    kpis.push({
      id: 'active_staff',
      module: 'HR',
      titleEn: 'Active Staff & Faculty',
      titleBn: 'কর্মরত শিক্ষক ও কর্মী',
      value: totalEmployees,
      subtextEn: 'Verified payroll members',
      subtextBn: 'অনুমোদিত স্টাফ তালিকা',
      type: 'number',
    });
  }

  // Admissions KPI
  if (isSuperOrAdminOrOwner) {
    kpis.push({
      id: 'admission_conversion',
      module: 'ADMISSIONS',
      titleEn: 'Admission Conversion',
      titleBn: 'ভর্তি রূপান্তর হার',
      value: formatPercentage(admissionConversionRate),
      subtextEn: `${enrolledCount} of ${appCount} Enrolled`,
      subtextBn: `${appCount} জনের মধ্যে ${enrolledCount} জন ভর্তিকৃত`,
      type: 'percentage',
    });
  }

  // Transport KPI
  if (isSuperOrAdminOrOwner) {
    kpis.push({
      id: 'transport_users',
      module: 'TRANSPORT',
      titleEn: 'Transport Riders',
      titleBn: 'পরিবহন যাত্রী',
      value: transportAssignedCount,
      subtextEn: `${transportRoutesCount} Active Routes`,
      subtextBn: `${transportRoutesCount}টি সক্রিয় রুট`,
      type: 'number',
    });
  }

  // Library KPI
  if (isSuperOrAdminOrOwner) {
    kpis.push({
      id: 'library_circulation',
      module: 'LIBRARY',
      titleEn: 'Active Book Loans',
      titleBn: 'বর্তমান বই ঋণ',
      value: libraryActiveLoans,
      subtextEn: `${libraryOverdueLoans} Overdue`,
      subtextBn: `${libraryOverdueLoans}টি মেয়াদোত্তীর্ণ`,
      type: 'number',
    });

    kpis.push({
      id: 'inventory_items',
      module: 'INVENTORY',
      titleEn: 'Catalogued Items',
      titleBn: 'ইনভেন্টরি আইটেম',
      value: inventoryLowStock,
      subtextEn: 'Tracked inventory supplies',
      subtextBn: 'সংরক্ষিত ইনভেন্টরি সামগ্রী',
      type: 'number',
    });
  }


  // 2. Real Monthly Collections Calculation (Past 6 calendar months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyCollectionMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyCollectionMap.set(monthNames[d.getMonth()], 0);
  }
  for (const p of recentPayments) {
    const pMonth = monthNames[new Date(p.paymentDate).getMonth()];
    if (monthlyCollectionMap.has(pMonth)) {
      monthlyCollectionMap.set(pMonth, monthlyCollectionMap.get(pMonth)! + Number(p.totalAmount));
    }
  }
  const monthlyCollection = Array.from(monthlyCollectionMap.entries()).map(([month, amount]) => ({
    month,
    amount: Math.round(amount),
  }));

  // 3. Real Attendance Trend (Past 7 days)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyAttendanceMap = new Map<string, { present: number; total: number }>();
  for (const att of recentAttendance) {
    const d = new Date(att.date);
    const dayName = dayNames[d.getDay()];
    if (!dailyAttendanceMap.has(dayName)) {
      dailyAttendanceMap.set(dayName, { present: 0, total: 0 });
    }
    const stat = dailyAttendanceMap.get(dayName)!;
    stat.total += 1;
    if (
      att.status === AttendanceStatus.PRESENT ||
      att.status === AttendanceStatus.LATE ||
      att.status === AttendanceStatus.HALF_DAY
    ) {
      stat.present += 1;
    }
  }
  const attendanceTrend = Array.from(dailyAttendanceMap.entries()).map(([date, counts]) => ({
    date,
    rate: counts.total > 0 ? Number(((counts.present / counts.total) * 100).toFixed(1)) : 0,
  }));

  // 4. Real Admission Funnel (Aggregated from admissionStats)
  const statusCountMap = new Map<string, number>();
  for (const stat of admissionStats) {
    statusCountMap.set(stat.status, stat._count.id);
  }
  const admissionFunnel = [
    { stage: 'Applications', count: appCount },
    { stage: 'Under Review', count: statusCountMap.get('UNDER_REVIEW') || 0 },
    { stage: 'Approved', count: statusCountMap.get('APPROVED') || 0 },
    { stage: 'Enrolled', count: enrolledCount },
  ];

  // 5. Real Academic Grade Distribution (Aggregated from marks)
  const gradeCountMap = new Map(gradeDistribution.map((g) => [g.letterGrade, g._count.id]));
  const academicDistribution = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'].map((grade) => ({
    grade,
    count: gradeCountMap.get(grade) || 0,
  }));

  return {
    kpis,
    trends: {
      monthlyCollection,
      attendanceTrend,
      admissionFunnel,
      academicDistribution,
    },
  };
}
