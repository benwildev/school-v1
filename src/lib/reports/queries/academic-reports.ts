import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';

/**
 * 1. Result Summary Report
 * Aggregates exam pass/fail and GPA by Class and Section.
 */
export async function executeResultSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters, scope, teacherId } = ctx;

  const whereClause: any = { schoolId };
  if (filters.examId) whereClause.examId = filters.examId;
  if (filters.classId) whereClause.classId = filters.classId;
  if (filters.sectionId) whereClause.sectionId = filters.sectionId;

  // Teacher Scope
  if (['ASSIGNED_CLASSES', 'ASSIGNED_SUBJECTS'].includes(scope) && teacherId) {
    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: { teacherId, schoolId, status: 'ACTIVE' },
      select: { classId: true, sectionId: true },
    });
    const classIds = Array.from(new Set(teacherAssignments.map((a) => a.classId).filter(Boolean)));
    whereClause.classId = { in: classIds as string[] };
  }

  const results = await prisma.studentExamResult.findMany({
    where: whereClause,
    include: {
      exam: { select: { nameEn: true, nameBn: true } },
      class: { select: { nameEn: true, nameBn: true } },
      section: { select: { nameEn: true, nameBn: true } },
    },
  });

  // Group by Exam + Class + Section
  const groups: Record<
    string,
    {
      examName: string;
      className: string;
      sectionName: string;
      studentCount: number;
      passCount: number;
      failCount: number;
      totalGpa: number;
      totalMarks: number;
      maxMarks: number;
    }
  > = {};

  for (const r of results) {
    const key = `${r.examId}_${r.classId}_${r.sectionId}`;
    if (!groups[key]) {
      groups[key] = {
        examName: r.exam.nameEn,
        className: r.class.nameEn,
        sectionName: r.section.nameEn,
        studentCount: 0,
        passCount: 0,
        failCount: 0,
        totalGpa: 0,
        totalMarks: 0,
        maxMarks: 0,
      };
    }
    const g = groups[key];
    g.studentCount++;
    if (r.isPassed) g.passCount++;
    else g.failCount++;
    g.totalGpa += Number(r.calculatedGpa || 0);
    g.totalMarks += Number(r.totalMarksObtained || 0);
    g.maxMarks += Number(r.totalFullMarks || 0);
  }

  const columns: ReportColumn[] = [
    { key: 'examName', labelEn: 'Exam', labelBn: 'পরীক্ষা', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'studentCount', labelEn: 'Total Students', labelBn: 'মোট শিক্ষার্থী', type: 'number' },
    { key: 'passCount', labelEn: 'Passed', labelBn: 'উত্তীর্ণ', type: 'number' },
    { key: 'failCount', labelEn: 'Failed', labelBn: 'অনুত্তীর্ণ', type: 'number' },
    { key: 'passRate', labelEn: 'Pass Rate (%)', labelBn: 'পাসের হার (%)', type: 'percentage' },
    { key: 'avgGpa', labelEn: 'Average GPA', labelBn: 'গড় জিপিএ', type: 'number' },
  ];

  const data = Object.values(groups).map((g) => ({
    examName: g.examName,
    className: g.className,
    sectionName: g.sectionName,
    studentCount: g.studentCount,
    passCount: g.passCount,
    failCount: g.failCount,
    passRate: g.studentCount > 0 ? Number(((g.passCount / g.studentCount) * 100).toFixed(2)) : 0,
    avgGpa: g.studentCount > 0 ? Number((g.totalGpa / g.studentCount).toFixed(2)) : 0,
  }));

  const totalStudents = results.length;
  const totalPassed = results.filter((r) => r.isPassed).length;
  const overallPassRate = totalStudents > 0 ? Number(((totalPassed / totalStudents) * 100).toFixed(2)) : 0;
  const overallAvgGpa =
    totalStudents > 0
      ? Number((results.reduce((acc, r) => acc + Number(r.calculatedGpa || 0), 0) / totalStudents).toFixed(2))
      : 0;

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalExaminees', labelEn: 'Total Examinees', labelBn: 'মোট পরীক্ষার্থী', value: totalStudents, type: 'number' },
      { key: 'totalPassed', labelEn: 'Total Passed', labelBn: 'মোট উত্তীর্ণ', value: totalPassed, type: 'number' },
      { key: 'overallPassRate', labelEn: 'Overall Pass Rate', labelBn: 'সার্বিক পাসের হার', value: `${overallPassRate}%`, type: 'percentage' },
      { key: 'overallAvgGpa', labelEn: 'Average GPA', labelBn: 'গড় জিপিএ', value: overallAvgGpa, type: 'number' },
    ],
  };
}

/**
 * 2. Subject Performance Report
 * Analyzes highest, lowest, average marks, pass rates, and grade distribution per subject.
 */
export async function executeSubjectPerformanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.examId) whereClause.examId = filters.examId;
  if (filters.subjectId) whereClause.subjectId = filters.subjectId;

  const marks = await prisma.mark.findMany({
    where: whereClause,
    include: {
      exam: { select: { nameEn: true } },
      subject: { select: { nameEn: true, code: true } },
    },
  });

  const subjectStats: Record<
    string,
    {
      subjectName: string;
      subjectCode: string;
      examName: string;
      totalExaminees: number;
      marksList: number[];
      gradeDist: Record<string, number>;
      absentCount: number;
    }
  > = {};

  for (const m of marks) {
    const key = `${m.examId}_${m.subjectId}`;
    if (!subjectStats[key]) {
      subjectStats[key] = {
        subjectName: m.subject.nameEn,
        subjectCode: m.subject.code,
        examName: m.exam.nameEn,
        totalExaminees: 0,
        marksList: [],
        gradeDist: { 'A+': 0, A: 0, 'A-': 0, B: 0, C: 0, D: 0, F: 0 },
        absentCount: 0,
      };
    }
    const stat = subjectStats[key];
    stat.totalExaminees++;
    if (m.isAbsent) {
      stat.absentCount++;
      stat.gradeDist['F'] = (stat.gradeDist['F'] || 0) + 1;
    } else {
      const obt = Number(m.totalObtained || 0);
      stat.marksList.push(obt);
      const grade = m.letterGrade || 'F';
      stat.gradeDist[grade] = (stat.gradeDist[grade] || 0) + 1;
    }
  }

  const columns: ReportColumn[] = [
    { key: 'subjectName', labelEn: 'Subject', labelBn: 'বিষয়', type: 'string' },
    { key: 'subjectCode', labelEn: 'Code', labelBn: 'কোড', type: 'string' },
    { key: 'totalExaminees', labelEn: 'Examinees', labelBn: 'পরীক্ষার্থী', type: 'number' },
    { key: 'highest', labelEn: 'Highest', labelBn: 'সর্বোচ্চ', type: 'number' },
    { key: 'lowest', labelEn: 'Lowest', labelBn: 'সর্বনিম্ন', type: 'number' },
    { key: 'average', labelEn: 'Average', labelBn: 'গড় নম্বর', type: 'number' },
    { key: 'passRate', labelEn: 'Pass Rate (%)', labelBn: 'পাসের হার (%)', type: 'percentage' },
    { key: 'failRate', labelEn: 'Fail Rate (%)', labelBn: 'ফেলের হার (%)', type: 'percentage' },
  ];

  const data = Object.values(subjectStats).map((s) => {
    const validMarks = s.marksList;
    const highest = validMarks.length > 0 ? Math.max(...validMarks) : 0;
    const lowest = validMarks.length > 0 ? Math.min(...validMarks) : 0;
    const average =
      validMarks.length > 0
        ? Number((validMarks.reduce((a, b) => a + b, 0) / validMarks.length).toFixed(2))
        : 0;
    const failCount = s.gradeDist['F'] || 0;
    const passCount = s.totalExaminees - failCount;
    const passRate = s.totalExaminees > 0 ? Number(((passCount / s.totalExaminees) * 100).toFixed(2)) : 0;
    const failRate = s.totalExaminees > 0 ? Number(((failCount / s.totalExaminees) * 100).toFixed(2)) : 0;

    return {
      subjectName: s.subjectName,
      subjectCode: s.subjectCode,
      totalExaminees: s.totalExaminees,
      highest,
      lowest,
      average,
      passRate,
      failRate,
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
  };
}

/**
 * 3. Class Comparison Report
 * Comparative academic KPI metrics across classes.
 */
export async function executeClassPerformanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.examId) whereClause.examId = filters.examId;

  const results = await prisma.studentExamResult.findMany({
    where: whereClause,
    include: {
      class: { select: { id: true, nameEn: true, numericLevel: true } },
    },
    orderBy: { class: { numericLevel: 'asc' } },
  });


  const classMap: Record<
    string,
    {
      className: string;
      total: number;
      passed: number;
      failed: number;
      totalGpa: number;
      aPlusCount: number;
    }
  > = {};

  for (const r of results) {
    const cName = r.class.nameEn;
    if (!classMap[cName]) {
      classMap[cName] = { className: cName, total: 0, passed: 0, failed: 0, totalGpa: 0, aPlusCount: 0 };
    }
    const c = classMap[cName];
    c.total++;
    if (r.isPassed) c.passed++;
    else c.failed++;
    c.totalGpa += Number(r.calculatedGpa || 0);
    if (r.finalGrade === 'A+') c.aPlusCount++;
  }

  const columns: ReportColumn[] = [
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'total', labelEn: 'Total Students', labelBn: 'মোট শিক্ষার্থী', type: 'number' },
    { key: 'passed', labelEn: 'Passed', labelBn: 'উত্তীর্ণ', type: 'number' },
    { key: 'failed', labelEn: 'Failed', labelBn: 'অনুত্তীর্ণ', type: 'number' },
    { key: 'passRate', labelEn: 'Pass Rate (%)', labelBn: 'পাসের হার (%)', type: 'percentage' },
    { key: 'avgGpa', labelEn: 'Average GPA', labelBn: 'গড় জিপিএ', type: 'number' },
    { key: 'aPlusCount', labelEn: 'GPA 5.00 / A+', labelBn: 'জিপিএ ৫.০০ / এ+', type: 'number' },
  ];

  const data = Object.values(classMap).map((c) => ({
    className: c.className,
    total: c.total,
    passed: c.passed,
    failed: c.failed,
    passRate: c.total > 0 ? Number(((c.passed / c.total) * 100).toFixed(2)) : 0,
    avgGpa: c.total > 0 ? Number((c.totalGpa / c.total).toFixed(2)) : 0,
    aPlusCount: c.aPlusCount,
  }));

  return {
    data,
    totalCount: data.length,
    columns,
  };
}

/**
 * 4. Student Performance & Merit Rank Report
 */
export async function executeStudentPerformanceReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.examId) whereClause.examId = filters.examId;
  if (filters.classId) whereClause.classId = filters.classId;
  if (filters.sectionId) whereClause.sectionId = filters.sectionId;

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, results] = await Promise.all([
    prisma.studentExamResult.count({ where: whereClause }),
    prisma.studentExamResult.findMany({
      where: whereClause,
      include: {
        student: { select: { studentCode: true, fullNameEn: true, fullNameBn: true } },
        class: { select: { nameEn: true } },
        section: { select: { nameEn: true } },
        enrollment: { select: { rollNo: true } },
      },
      orderBy: [
        { calculatedGpa: 'desc' },
        { totalMarksObtained: 'desc' },
      ],
      skip,
      take: limit,
    }),
  ]);

  const columns: ReportColumn[] = [
    { key: 'meritRank', labelEn: 'Rank', labelBn: 'মেধা স্থান', type: 'number' },
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'name', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'rollNumber', labelEn: 'Roll', labelBn: 'রোল', type: 'number' },
    { key: 'totalMarks', labelEn: 'Total Marks', labelBn: 'মোট নম্বর', type: 'number' },
    { key: 'gpa', labelEn: 'GPA', labelBn: 'জিপিএ', type: 'number' },
    { key: 'grade', labelEn: 'Grade', labelBn: 'গ্রেড', type: 'badge' },
    { key: 'status', labelEn: 'Result', labelBn: 'ফলাফল', type: 'badge' },
  ];

  const data = results.map((r, idx) => ({
    meritRank: r.classPosition ?? (skip + idx + 1),
    studentCode: r.student.studentCode,
    name: r.student.fullNameEn,
    className: r.class.nameEn,
    sectionName: r.section.nameEn,
    rollNumber: r.enrollment?.rollNo ?? '-',
    totalMarks: Number(r.totalMarksObtained),
    gpa: Number(r.calculatedGpa),
    grade: r.finalGrade,
    status: r.isPassed ? 'PASSED' : 'FAILED',
  }));


  return {
    data,
    totalCount,
    columns,
  };
}

/**
 * 5. At-Risk Students Report
 * Identifies students who failed one or more subjects or have critical academic deficits.
 * Purely rule-based academic triggers; zero psychological or medical labels.
 */
export async function executeAtRiskStudentsReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = {
    schoolId,
    OR: [
      { isPassed: false },
      { failedSubjectsCount: { gt: 0 } },
      { calculatedGpa: { lt: 2.0 } },
    ],
  };

  if (filters.examId) whereClause.examId = filters.examId;
  if (filters.classId) whereClause.classId = filters.classId;
  if (filters.sectionId) whereClause.sectionId = filters.sectionId;

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [totalCount, results] = await Promise.all([
    prisma.studentExamResult.count({ where: whereClause }),
    prisma.studentExamResult.findMany({
      where: whereClause,
      include: {
        student: { select: { studentCode: true, fullNameEn: true } },
        class: { select: { nameEn: true } },
        section: { select: { nameEn: true } },
        enrollment: { select: { rollNo: true } },
      },
      orderBy: { failedSubjectsCount: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'শিক্ষার্থী আইডি', type: 'string' },
    { key: 'name', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'className', labelEn: 'Class', labelBn: 'শ্রেণি', type: 'string' },
    { key: 'sectionName', labelEn: 'Section', labelBn: 'শাখা', type: 'string' },
    { key: 'rollNumber', labelEn: 'Roll', labelBn: 'রোল', type: 'number' },
    { key: 'failedSubjects', labelEn: 'Failed Subjects', labelBn: 'অনুত্তীর্ণ বিষয়', type: 'number' },
    { key: 'gpa', labelEn: 'GPA', labelBn: 'জিপিএ', type: 'number' },
    { key: 'riskReason', labelEn: 'Academic Risk Trigger', labelBn: 'ঝুঁকির কারণ', type: 'string' },
  ];

  const data = results.map((r) => {
    const reasons: string[] = [];
    if (r.failedSubjectsCount > 0) reasons.push(`${r.failedSubjectsCount} subject(s) failed`);
    if (Number(r.calculatedGpa) < 2.0) reasons.push('Low GPA (< 2.00)');
    if (!r.isPassed && reasons.length === 0) reasons.push('Exam Failed');

    return {
      studentCode: r.student.studentCode,
      name: r.student.fullNameEn,
      className: r.class.nameEn,
      sectionName: r.section.nameEn,
      rollNumber: r.enrollment?.rollNo ?? '-',
      failedSubjects: r.failedSubjectsCount,
      gpa: Number(r.calculatedGpa),
      riskReason: reasons.join('; '),
    };
  });

  return {
    data,
    totalCount,
    columns,
    summary: [
      { key: 'atRiskCount', labelEn: 'Total At-Risk Students', labelBn: 'মোট ঝুঁকিপূর্ণ শিক্ষার্থী', value: totalCount, type: 'number' },
    ],
  };
}
