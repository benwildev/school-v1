import { prisma } from '../../db';
import { AttendanceStatus } from '@prisma/client';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';


/**
 * 1. Daily Attendance Report
 * Aggregates daily student attendance by class and section.
 */
export async function executeDailyAttendanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const targetDate = filters.startDate ? new Date(filters.startDate) : new Date();
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  const whereClause: any = {
    schoolId,
    date: { gte: startOfDay, lte: endOfDay },
  };

  if (filters.classId) whereClause.classId = filters.classId;
  if (filters.sectionId) whereClause.sectionId = filters.sectionId;

  const attendances = await prisma.studentAttendance.findMany({
    where: whereClause,
    include: {
      class: { select: { nameEn: true } },
      section: { select: { nameEn: true } },
    },
  });

  const sectionMap: Record<
    string,
    {
      className: string;
      sectionName: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      excused: number;
    }
  > = {};

  for (const a of attendances) {
    const key = `${a.classId}_${a.sectionId}`;
    if (!sectionMap[key]) {
      sectionMap[key] = {
        className: a.class?.nameEn || 'Unassigned',
        sectionName: a.section?.nameEn || 'Unassigned',
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        excused: 0,
      };
    }
    const s = sectionMap[key];
    s.total++;
    if (a.status === AttendanceStatus.PRESENT) s.present++;
    else if (a.status === AttendanceStatus.ABSENT) s.absent++;
    else if (a.status === AttendanceStatus.LATE) s.late++;
    else if (a.status === AttendanceStatus.HALF_DAY) s.halfDay++;
    else if (a.status === AttendanceStatus.EXCUSED || a.status === AttendanceStatus.LEAVE) s.excused++;
  }

  const columns: ReportColumn[] = [
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'total', labelEn: 'Total Enrolled', labelBn: 'মোট শিক্ষার্থী', type: 'number' },
    { key: 'present', labelEn: 'Present', labelBn: 'উপস্থিত', type: 'number' },
    { key: 'late', labelEn: 'Late', labelBn: 'বিলম্বে', type: 'number' },
    { key: 'absent', labelEn: 'Absent', labelBn: 'অনুপস্থিত', type: 'number' },
    { key: 'halfDay', labelEn: 'Half-Day', labelBn: 'হাফ-ডে', type: 'number' },
    { key: 'excused', labelEn: 'Excused', labelBn: 'অনুমোদিত', type: 'number' },
    { key: 'rate', labelEn: 'Attendance Rate (%)', labelBn: 'উপস্থিতির হার (%)', type: 'percentage' },
  ];

  const data = Object.values(sectionMap).map((s) => ({
    className: s.className,
    sectionName: s.sectionName,
    total: s.total,
    present: s.present,
    late: s.late,
    absent: s.absent,
    halfDay: s.halfDay,
    excused: s.excused,
    rate: s.total > 0 ? Number((((s.present + s.late) / s.total) * 100).toFixed(1)) : 0,
  }));

  const totalAll = attendances.length;
  const presentAll = attendances.filter((a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length;
  const overallRate = totalAll > 0 ? Number(((presentAll / totalAll) * 100).toFixed(1)) : 0;

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalRecords', labelEn: 'Total Students Logged', labelBn: 'মোট রেকর্ডভুক্ত শিক্ষার্থী', value: totalAll, type: 'number' },
      { key: 'overallRate', labelEn: 'Overall Attendance Rate', labelBn: 'সার্বিক উপস্থিতি হার', value: `${overallRate}%`, type: 'percentage' },
    ],
  };
}

/**
 * 2. Monthly Attendance Matrix & Trend Report
 */
export async function executeMonthlyAttendanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const now = new Date();
  const startDate = filters.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const whereClause: any = {
    schoolId,
    date: { gte: startDate, lte: endDate },
  };
  if (filters.classId) whereClause.classId = filters.classId;

  const attendances = await prisma.studentAttendance.findMany({
    where: whereClause,
    include: {
      class: { select: { nameEn: true } },
    },
  });

  const dailyMap: Record<string, { total: number; present: number }> = {};
  for (const a of attendances) {
    const dStr = a.date.toISOString().split('T')[0];
    if (!dailyMap[dStr]) dailyMap[dStr] = { total: 0, present: 0 };
    dailyMap[dStr].total++;
    if (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE) {
      dailyMap[dStr].present++;
    }
  }

  const sortedDates = Object.keys(dailyMap).sort();
  const columns: ReportColumn[] = [
    { key: 'date', labelEn: 'Date', labelBn: 'তারিখ', type: 'date' },
    { key: 'total', labelEn: 'Total Expected', labelBn: 'প্রত্যাশিত মোট', type: 'number' },
    { key: 'present', labelEn: 'Total Present', labelBn: 'মোট উপস্থিত', type: 'number' },
    { key: 'rate', labelEn: 'Attendance Rate', labelBn: 'উপস্থিতির হার', type: 'percentage' },
  ];

  const data = sortedDates.map((d) => {
    const entry = dailyMap[d];
    return {
      date: d,
      total: entry.total,
      present: entry.present,
      rate: entry.total > 0 ? Number(((entry.present / entry.total) * 100).toFixed(1)) : 0,
    };
  });

  const charts = [
    {
      id: 'attendanceTrendChart',
      type: 'line' as const,
      titleEn: 'Daily Attendance Trend',
      titleBn: 'দৈনিক উপস্থিতির ধারা',
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: data.map((d) => d.rate),
          borderColor: ['#10B981'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    charts,
  };
}

/**
 * 3. Student Attendance Summary Report
 * Aggregates attendance statistics per student over a date range.
 */
export async function executeStudentAttendanceSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.startDate && filters.endDate) {
    whereClause.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
  }
  if (filters.classId) whereClause.classId = filters.classId;
  if (filters.sectionId) whereClause.sectionId = filters.sectionId;

  const attendances = await prisma.studentAttendance.findMany({
    where: whereClause,
    include: {
      student: { select: { studentCode: true, fullNameEn: true } },
      class: { select: { nameEn: true } },
      section: { select: { nameEn: true } },
    },
  });

  const studentMap: Record<
    string,
    {
      studentCode: string;
      name: string;
      className: string;
      sectionName: string;
      totalDays: number;
      presentDays: number;
      absentDays: number;
      lateDays: number;
      excusedDays: number;
    }
  > = {};

  for (const a of attendances) {
    const sId = a.studentId;
    if (!studentMap[sId]) {
      studentMap[sId] = {
        studentCode: a.student.studentCode,
        name: a.student.fullNameEn,
        className: a.class?.nameEn || '-',
        sectionName: a.section?.nameEn || '-',
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        excusedDays: 0,
      };
    }
    const sm = studentMap[sId];
    sm.totalDays++;
    if (a.status === AttendanceStatus.PRESENT) sm.presentDays++;
    else if (a.status === AttendanceStatus.ABSENT) sm.absentDays++;
    else if (a.status === AttendanceStatus.LATE) sm.lateDays++;
    else if (a.status === AttendanceStatus.EXCUSED || a.status === AttendanceStatus.LEAVE) sm.excusedDays++;
  }

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'name', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'totalDays', labelEn: 'Working Days', labelBn: 'মোট কার্যদিবস', type: 'number' },
    { key: 'presentDays', labelEn: 'Present', labelBn: 'উপস্থিত', type: 'number' },
    { key: 'lateDays', labelEn: 'Late', labelBn: 'বিলম্বে', type: 'number' },
    { key: 'absentDays', labelEn: 'Absent', labelBn: 'অনুপস্থিত', type: 'number' },
    { key: 'rate', labelEn: 'Attendance Rate', labelBn: 'উপস্থিতির হার', type: 'percentage' },
  ];

  const data = Object.values(studentMap).map((sm) => ({
    studentCode: sm.studentCode,
    name: sm.name,
    className: sm.className,
    sectionName: sm.sectionName,
    totalDays: sm.totalDays,
    presentDays: sm.presentDays,
    lateDays: sm.lateDays,
    absentDays: sm.absentDays,
    rate: sm.totalDays > 0 ? Number((((sm.presentDays + sm.lateDays) / sm.totalDays) * 100).toFixed(1)) : 0,
  }));

  return {
    data,
    totalCount: data.length,
    columns,
  };
}

/**
 * 4. Employee & Teacher Attendance Summary Report
 */
export async function executeEmployeeAttendanceSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.startDate && filters.endDate) {
    whereClause.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
  }

  const attendances = await prisma.employeeAttendance.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          employeeCode: true,
          fullNameEn: true,
          department: { select: { nameEn: true } },
          designation: { select: { titleEn: true } },
        },
      },
    },
  });

  const empMap: Record<
    string,
    {
      code: string;
      name: string;
      dept: string;
      desig: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      leave: number;
    }
  > = {};

  for (const a of attendances) {
    const eId = a.employeeId || a.userId;
    if (!eId) continue;
    if (!empMap[eId]) {
      empMap[eId] = {
        code: a.employee?.employeeCode || '-',
        name: a.employee?.fullNameEn || '-',
        dept: a.employee?.department?.nameEn || '-',
        desig: a.employee?.designation?.titleEn || '-',
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      };
    }
    const e = empMap[eId];
    e.total++;

    if (a.status === AttendanceStatus.PRESENT) e.present++;
    else if (a.status === AttendanceStatus.ABSENT) e.absent++;
    else if (a.status === AttendanceStatus.LATE) e.late++;
    else if (a.status === AttendanceStatus.LEAVE) e.leave++;
  }

  const columns: ReportColumn[] = [
    { key: 'code', labelEn: 'Employee ID', labelBn: 'কর্মচারী আইডি', type: 'string' },
    { key: 'name', labelEn: 'Employee Name', labelBn: 'কর্মচারীর নাম', type: 'string' },
    { key: 'dept', labelEn: 'Department', labelBn: 'বিভাগ', type: 'string' },
    { key: 'desig', labelEn: 'Designation', labelBn: 'পদবি', type: 'string' },
    { key: 'total', labelEn: 'Working Days', labelBn: 'মোট কার্যদিবস', type: 'number' },
    { key: 'present', labelEn: 'Present', labelBn: 'উপস্থিত', type: 'number' },
    { key: 'late', labelEn: 'Late', labelBn: 'বিলম্বে', type: 'number' },
    { key: 'absent', labelEn: 'Absent', labelBn: 'অনুপস্থিত', type: 'number' },
    { key: 'leave', labelEn: 'Leave', labelBn: 'ছুটি', type: 'number' },
    { key: 'rate', labelEn: 'Attendance Rate', labelBn: 'উপস্থিতির হার', type: 'percentage' },
  ];

  const data = Object.values(empMap).map((e) => ({
    code: e.code,
    name: e.name,
    dept: e.dept,
    desig: e.desig,
    total: e.total,
    present: e.present,
    late: e.late,
    absent: e.absent,
    leave: e.leave,
    rate: e.total > 0 ? Number((((e.present + e.late) / e.total) * 100).toFixed(1)) : 0,
  }));

  return {
    data,
    totalCount: data.length,
    columns,
  };
}

/**
 * 5. Attendance Exceptions Report (Late Arrivals & Unexcused Absences)
 */
export async function executeAttendanceExceptionsReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const targetDate = filters.startDate ? new Date(filters.startDate) : new Date();
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  const exceptions = await prisma.studentAttendance.findMany({
    where: {
      schoolId,
      date: { gte: startOfDay, lte: endOfDay },
      status: { in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE] },
      ...(filters.classId ? { classId: filters.classId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    },
    include: {
      student: { select: { studentCode: true, fullNameEn: true } },
      class: { select: { nameEn: true } },
      section: { select: { nameEn: true } },
      enrollment: { select: { rollNo: true } },
    },
    orderBy: [{ classId: 'asc' }, { status: 'asc' }],
  });

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'name', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'rollNumber', labelEn: 'Roll', labelBn: 'রোল', type: 'number' },
    { key: 'status', labelEn: 'Exception Type', labelBn: 'ব্যতিক্রমের ধরন', type: 'badge' },
    { key: 'lateMinutes', labelEn: 'Minutes Late', labelBn: 'বিলম্বে মিনিট', type: 'number' },
    { key: 'leaveReason', labelEn: 'Documented Reason', labelBn: 'কারণ', type: 'string' },
  ];

  const data = exceptions.map((e) => ({
    studentCode: e.student.studentCode,
    name: e.student.fullNameEn,
    className: e.class?.nameEn || '-',
    sectionName: e.section?.nameEn || '-',
    rollNumber: e.enrollment?.rollNo ?? '-',
    status: e.status,
    lateMinutes: e.lateMinutes ?? 0,
    leaveReason: e.leaveReason || '-',
  }));


  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalExceptions', labelEn: 'Total Exceptions', labelBn: 'মোট ব্যতিক্রম', value: data.length, type: 'number' },
    ],
  };
}
