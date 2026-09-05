import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';

/**
 * Admission Funnel & Conversion Analytics Report
 * Analyzes application stages: Submitted -> Under Review -> Accepted -> Enrolled.
 * Redacts applicant sensitive confidential records.
 */
export async function executeAdmissionFunnelReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.academicSessionId) whereClause.academicSessionId = filters.academicSessionId;
  if (filters.campusId) whereClause.campusId = filters.campusId;
  if (filters.classId) whereClause.appliedClassId = filters.classId;

  const applications = await prisma.admissionApplication.findMany({
    where: whereClause,
    include: {
      appliedClass: { select: { nameEn: true } },
    },
  });

  const total = applications.length;
  let underReview = 0;
  let accepted = 0;
  let enrolled = 0;

  const classDemand: Record<string, { total: number; enrolled: number }> = {};

  for (const app of applications) {
    const s = app.status;
    if ((s as any) === 'UNDER_REVIEW') underReview++;
    else if (s === 'APPROVED') accepted++;
    else if (s === 'ENROLLED') {
      enrolled++;
      accepted++; // Enrolled implies previously accepted
    }


    const cName = app.appliedClass?.nameEn || 'General';
    if (!classDemand[cName]) classDemand[cName] = { total: 0, enrolled: 0 };
    classDemand[cName].total++;
    if (s === 'ENROLLED') classDemand[cName].enrolled++;
  }


  const columns: ReportColumn[] = [
    { key: 'className', labelEn: 'Class Applied For', labelBn: 'আবেদিত শ্রেণি', type: 'string' },
    { key: 'total', labelEn: 'Applications', labelBn: 'আবেদন সংখ্যা', type: 'number' },
    { key: 'enrolled', labelEn: 'Final Enrolled', labelBn: 'ভর্তিকৃত', type: 'number' },
    { key: 'conversionRate', labelEn: 'Conversion Rate (%)', labelBn: 'রূপান্তরের হার (%)', type: 'percentage' },
  ];

  const data = Object.entries(classDemand).map(([cls, counts]) => ({
    className: cls,
    total: counts.total,
    enrolled: counts.enrolled,
    conversionRate: counts.total > 0 ? Number(((counts.enrolled / counts.total) * 100).toFixed(1)) : 0,
  }));

  const overallConversion = total > 0 ? Number(((enrolled / total) * 100).toFixed(1)) : 0;
  const approvalRate = total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 0;

  const charts = [
    {
      id: 'admissionFunnelChart',
      type: 'bar' as const,
      titleEn: 'Admission Funnel Stages',
      titleBn: 'ভর্তি প্রক্রিয়ার পর্যায়সমূহ',
      labels: ['Applications', 'Under Review', 'Approved', 'Enrolled'],
      datasets: [
        {
          label: 'Applicants',
          data: [total, underReview, accepted, enrolled],
          backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#6366F1'],
        },
      ],
    },
  ];

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalApps', labelEn: 'Total Applications', labelBn: 'মোট আবেদন', value: total, type: 'number' },
      { key: 'enrolledCount', labelEn: 'Total Enrolled', labelBn: 'মোট ভর্তিকৃত', value: enrolled, type: 'number' },
      { key: 'conversionRate', labelEn: 'Overall Conversion Rate', labelBn: 'সার্বিক রূপান্তরের হার', value: `${overallConversion}%`, type: 'percentage' },
      { key: 'approvalRate', labelEn: 'Approval Rate', labelBn: 'অনুমোদনের হার', value: `${approvalRate}%`, type: 'percentage' },
    ],
    charts,
  };
}
