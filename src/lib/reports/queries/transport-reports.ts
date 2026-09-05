import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';

/**
 * 1. Transport Route & Fleet Utilization Report
 */
export async function executeTransportUtilizationReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.campusId) whereClause.campusId = filters.campusId;

  const routes = await prisma.transportRoute.findMany({
    where: whereClause,
    include: {
      campus: { select: { nameEn: true } },
      _count: {
        select: {
          studentAssignments: { where: { status: 'ACTIVE' } },
        },
      },
    },
    orderBy: { routeName: 'asc' },
  });

  const columns: ReportColumn[] = [
    { key: 'routeCode', labelEn: 'Route Code', labelBn: 'রুট কোড', type: 'string' },
    { key: 'routeName', labelEn: 'Route Name', labelBn: 'রুটের নাম', type: 'string' },
    { key: 'campusName', labelEn: 'Campus', labelBn: 'ক্যাম্পাস', type: 'string' },
    { key: 'assignedCount', labelEn: 'Assigned Students', labelBn: 'নিবন্ধিত শিক্ষার্থী', type: 'number' },
    { key: 'status', labelEn: 'Status', labelBn: 'অবস্থা', type: 'badge' },
  ];

  let totalAssigned = 0;

  const data = routes.map((r) => {
    const assigned = r._count?.studentAssignments ?? 0;
    totalAssigned += assigned;
    return {
      routeCode: r.routeCode,
      routeName: r.routeName,
      campusName: r.campus?.nameEn || '-',
      assignedCount: assigned,
      status: r.status,
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalRoutes', labelEn: 'Active Routes', labelBn: 'সক্রিয় রুট', value: routes.length, type: 'number' },
      { key: 'totalStudents', labelEn: 'Transport Users', labelBn: 'মোট যাত্রী শিক্ষার্থী', value: totalAssigned, type: 'number' },
    ],
  };
}

/**
 * 2. Transport Boarding & Missed Boarding Analytics Report
 */
export async function executeTransportBoardingReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const targetDate = filters.startDate ? new Date(filters.startDate) : new Date();
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  const whereClause: any = {
    schoolId,
    eventTimestamp: { gte: startOfDay, lte: endOfDay },
  };

  const events = await prisma.transportBoardingEvent.findMany({
    where: whereClause,
    include: {
      student: { select: { studentCode: true, fullNameEn: true } },
      trip: {
        select: {
          tripDate: true,
          tripType: true,
          route: { select: { routeName: true } },
          vehicle: { select: { registrationNumber: true, vehicleCode: true } },
        },
      },
    },
    orderBy: { eventTimestamp: 'desc' },
  });

  const columns: ReportColumn[] = [
    { key: 'studentCode', labelEn: 'Student ID', labelBn: 'আইডি', type: 'string' },
    { key: 'studentName', labelEn: 'Student Name', labelBn: 'শিক্ষার্থীর নাম', type: 'string' },
    { key: 'route', labelEn: 'Route', labelBn: 'রুট', type: 'string' },
    { key: 'vehicle', labelEn: 'Vehicle', labelBn: 'যানবাহন', type: 'string' },
    { key: 'eventType', labelEn: 'Boarding Status', labelBn: 'বোর্ডিং অবস্থা', type: 'badge' },
    { key: 'time', labelEn: 'Recorded Time', labelBn: 'রেকর্ডকৃত সময়', type: 'string' },
  ];

  let boardedCount = 0;
  let missedCount = 0;

  const data = events.map((e) => {
    if (e.boardingStatus === 'BOARDED' || (e.boardingStatus as string) === 'DROPPED_OFF') boardedCount++;
    else missedCount++;

    return {
      studentCode: e.student?.studentCode || '-',
      studentName: e.student?.fullNameEn || '-',
      route: e.trip?.route?.routeName || '-',
      vehicle: e.trip?.vehicle?.registrationNumber || e.trip?.vehicle?.vehicleCode || '-',
      eventType: e.boardingStatus,
      time: e.eventTimestamp ? new Date(e.eventTimestamp).toLocaleTimeString('en-US') : '-',
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalBoarded', labelEn: 'Boarded Students', labelBn: 'মোট বোর্ডিং', value: boardedCount, type: 'number' },
      { key: 'missedBoarded', labelEn: 'Missed / No-Show', labelBn: 'অনুপস্থিত / মিস', value: missedCount, type: 'number' },
    ],
  };
}
