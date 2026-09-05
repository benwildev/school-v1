import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';

/**
 * 1. Student Directory Report
 * Lists students enrolled in the selected session/campus/class/section.
 * Strictly anchors to Enrollment for historical accuracy and redacts sensitive PII.
 */
export async function executeStudentDirectoryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters, scope, teacherId } = ctx;

  const whereClause: any = {
    schoolId,
    deletedAt: null,
  };

  // Session filter (defaults to active session if none provided)
  if (filters.academicSessionId) {
    whereClause.academicSessionId = filters.academicSessionId;
  }
  if (filters.campusId) {
    whereClause.campusId = filters.campusId;
  }
  if (filters.classId) {
    whereClause.classId = filters.classId;
  }
  if (filters.sectionId) {
    whereClause.sectionId = filters.sectionId;
  }
  if (filters.status) {
    whereClause.status = filters.status;
  }

  // Teacher Scope Constraint
  if (['ASSIGNED_CLASSES', 'ASSIGNED_SUBJECTS'].includes(scope) && teacherId) {
    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: { teacherId, schoolId, status: 'ACTIVE' },
      select: { classId: true, sectionId: true },
    });
    const classIds = Array.from(new Set(teacherAssignments.map((a) => a.classId).filter(Boolean)));
    const sectionIds = Array.from(new Set(teacherAssignments.map((a) => a.sectionId).filter(Boolean)));

    whereClause.classId = { in: classIds as string[] };
    if (sectionIds.length > 0) {
      whereClause.sectionId = { in: sectionIds as string[] };
    }
  }

  // Student demographics filter
  const studentWhere: any = { deletedAt: null };
  if (filters.gender) {
    studentWhere.gender = filters.gender;
  }
  if (filters.search) {
    studentWhere.OR = [
      { studentCode: { contains: filters.filters?.search || filters.search, mode: 'insensitive' } },
      { fullNameEn: { contains: filters.search, mode: 'insensitive' } },
      { fullNameBn: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  whereClause.student = studentWhere;

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, enrollments] = await Promise.all([
    prisma.enrollment.count({ where: whereClause }),
    prisma.enrollment.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            fullNameEn: true,
            fullNameBn: true,
            gender: true,
            bloodGroup: true,
            nationality: true,
            status: true,
            // Sensitive fields (nid, birthCertificateNo, medicalNotes) intentionally omitted for privacy
          },
        },
        class: { select: { nameEn: true, nameBn: true } },
        section: { select: { nameEn: true, nameBn: true } },
        campus: { select: { nameEn: true, nameBn: true } },
        academicSession: { select: { name: true } },
      },
      orderBy: [
        { class: { numericLevel: 'asc' } },
        { rollNo: 'asc' },
      ],
      skip,
      take: limit,
    }),
  ]);

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'শিক্ষার্থী আইডি', type: 'string', sortable: true },
    { key: 'fullNameEn', labelEn: 'Student Name (EN)', labelBn: 'নাম (ইংরেজি)', type: 'string', sortable: true },
    { key: 'fullNameBn', labelEn: 'Student Name (BN)', labelBn: 'নাম (বাংলা)', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'rollNumber', labelEn: 'Roll', labelBn: 'রোল', type: 'number', sortable: true },
    { key: 'gender', labelEn: 'Gender', labelBn: 'লিঙ্গ', type: 'string' },
    { key: 'bloodGroup', labelEn: 'Blood Group', labelBn: 'রক্তের গ্রুপ', type: 'string' },
    { key: 'campusName', labelEn: 'Campus', labelBn: 'ক্যাম্পাস', type: 'string' },
    { key: 'sessionName', labelEn: 'Session', labelBn: 'শিক্ষাবর্ষ', type: 'string' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  const data = enrollments.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    studentCode: e.student.studentCode,
    fullNameEn: e.student.fullNameEn,
    fullNameBn: e.student.fullNameBn || '-',
    className: e.class?.nameEn || '-',
    sectionName: e.section?.nameEn || '-',
    rollNumber: e.rollNo ?? '-',
    gender: e.student.gender || '-',
    bloodGroup: e.student.bloodGroup || '-',
    campusName: e.campus?.nameEn || '-',
    sessionName: e.academicSession?.name || '-',
    status: e.status,
  }));


  // Aggregation Summary
  const summary = [
    { key: 'totalStudents', labelEn: 'Total Enrolled', labelBn: 'মোট শিক্ষার্থী', value: totalCount, type: 'number' as const },
  ];

  return {
    data,
    totalCount,
    columns,
    summary,
  };
}

/**
 * 2. Student Enrollment Status Summary Report
 * Analyzes enrollment distribution: NEW, PROMOTED, TRANSFERRED, REPEATING, WITHDRAWN.
 */
export async function executeEnrollmentSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId, deletedAt: null };
  if (filters.academicSessionId) whereClause.academicSessionId = filters.academicSessionId;
  if (filters.campusId) whereClause.campusId = filters.campusId;
  if (filters.classId) whereClause.classId = filters.classId;

  const enrollments = await prisma.enrollment.findMany({
    where: whereClause,
    select: {
      id: true,
      status: true,
      classId: true,
      class: { select: { nameEn: true } },
    },
  });

  const total = enrollments.length;
  const statusCounts: Record<string, number> = {
    ACTIVE: 0,
    PROMOTED: 0,
    TRANSFERRED: 0,
    REPEATING: 0,
    WITHDRAWN: 0,
  };

  const classCounts: Record<string, { total: number; active: number; promoted: number; withdrawn: number }> = {};

  for (const e of enrollments) {
    const s = e.status || 'ACTIVE';
    statusCounts[s] = (statusCounts[s] || 0) + 1;

    const className = e.class?.nameEn || 'Unassigned';
    if (!classCounts[className]) {
      classCounts[className] = { total: 0, active: 0, promoted: 0, withdrawn: 0 };
    }
    classCounts[className].total++;
    if (s === 'ACTIVE') classCounts[className].active++;
    if (s === 'PROMOTED') classCounts[className].promoted++;
    if (s === 'DROPPED' || s === 'TRANSFERRED_OUT' || (s as any) === 'WITHDRAWN') classCounts[className].withdrawn++;

  }

  const columns: ReportColumn[] = [
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'total', labelEn: 'Total Enrollments', labelBn: 'মোট ভর্তি', type: 'number' },
    { key: 'active', labelEn: 'Active Students', labelBn: 'বর্তমান শিক্ষার্থী', type: 'number' },
    { key: 'promoted', labelEn: 'Promoted', labelBn: 'উত্তীর্ণ', type: 'number' },
    { key: 'withdrawn', labelEn: 'Withdrawn', labelBn: 'বাতিল', type: 'number' },
    { key: 'retentionRate', labelEn: 'Retention Rate', labelBn: 'ধরে রাখার হার', type: 'percentage' },
  ];

  const data = Object.entries(classCounts).map(([cls, counts]) => ({
    className: cls,
    total: counts.total,
    active: counts.active,
    promoted: counts.promoted,
    withdrawn: counts.withdrawn,
    retentionRate: counts.total > 0 ? Number(((counts.active / counts.total) * 100).toFixed(1)) : 0,
  }));

  const charts = [
    {
      id: 'enrollmentStatusChart',
      type: 'pie' as const,
      titleEn: 'Enrollment Status Distribution',
      titleBn: 'ভর্তি অবস্থার বণ্টন',
      labels: Object.keys(statusCounts),
      datasets: [
        {
          label: 'Students',
          data: Object.values(statusCounts),
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#6366F1', '#EF4444'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalEnrollments', labelEn: 'Total Enrollments', labelBn: 'মোট ভর্তি', value: total, type: 'number' },
      { key: 'activeStudents', labelEn: 'Active', labelBn: 'বর্তমান', value: statusCounts.ACTIVE || 0, type: 'number' },
      { key: 'withdrawnStudents', labelEn: 'Withdrawn', labelBn: 'বাতিল', value: statusCounts.WITHDRAWN || 0, type: 'number' },
    ],
    charts,
  };
}

/**
 * 3. Student Demographics Report
 * Gender, blood group, and campus distribution.
 */
export async function executeStudentDemographicsReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId, deletedAt: null };
  if (filters.academicSessionId) whereClause.academicSessionId = filters.academicSessionId;
  if (filters.campusId) whereClause.campusId = filters.campusId;

  const enrollments = await prisma.enrollment.findMany({
    where: whereClause,
    include: {
      student: {
        select: {
          gender: true,
          bloodGroup: true,
        },
      },
      campus: { select: { nameEn: true } },
      class: { select: { nameEn: true } },
    },
  });

  const total = enrollments.length;
  let male = 0;
  let female = 0;
  let otherGender = 0;
  const bloodGroups: Record<string, number> = {};

  for (const e of enrollments) {
    const g = (e.student.gender || 'OTHER').toUpperCase();
    if (g === 'MALE') male++;
    else if (g === 'FEMALE') female++;
    else otherGender++;

    const bg = e.student.bloodGroup || 'UNKNOWN';
    bloodGroups[bg] = (bloodGroups[bg] || 0) + 1;
  }

  const columns: ReportColumn[] = [
    { key: 'metric', labelEn: 'Demographic Factor', labelBn: 'জনমিতিক উপাদান', type: 'string' },
    { key: 'category', labelEn: 'Category', labelBn: 'বিভাগ', type: 'string' },
    { key: 'count', labelEn: 'Student Count', labelBn: 'শিক্ষার্থী সংখ্যা', type: 'number' },
    { key: 'percentage', labelEn: 'Percentage', labelBn: 'শতাংশ', type: 'percentage' },
  ];

  const data: any[] = [
    { metric: 'Gender', category: 'Male (ছাত্র)', count: male, percentage: total > 0 ? Number(((male / total) * 100).toFixed(1)) : 0 },
    { metric: 'Gender', category: 'Female (ছাত্রী)', count: female, percentage: total > 0 ? Number(((female / total) * 100).toFixed(1)) : 0 },
  ];

  if (otherGender > 0) {
    data.push({ metric: 'Gender', category: 'Other (অন্যান্য)', count: otherGender, percentage: Number(((otherGender / total) * 100).toFixed(1)) });
  }

  for (const [bg, cnt] of Object.entries(bloodGroups)) {
    data.push({
      metric: 'Blood Group',
      category: bg,
      count: cnt,
      percentage: total > 0 ? Number(((cnt / total) * 100).toFixed(1)) : 0,
    });
  }

  const charts = [
    {
      id: 'genderDistributionChart',
      type: 'donut' as const,
      titleEn: 'Gender Distribution',
      titleBn: 'লিঙ্গভিত্তিক অনুপাত',
      labels: ['Male', 'Female', ...(otherGender > 0 ? ['Other'] : [])],
      datasets: [
        {
          label: 'Students',
          data: [male, female, ...(otherGender > 0 ? [otherGender] : [])],
          backgroundColor: ['#3B82F6', '#EC4899', '#9CA3AF'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalStudents', labelEn: 'Total Students', labelBn: 'মোট শিক্ষার্থী', value: total, type: 'number' },
      { key: 'maleCount', labelEn: 'Male Students', labelBn: 'মোট ছাত্র', value: male, type: 'number' },
      { key: 'femaleCount', labelEn: 'Female Students', labelBn: 'মোট ছাত্রী', value: female, type: 'number' },
    ],
    charts,
  };
}
