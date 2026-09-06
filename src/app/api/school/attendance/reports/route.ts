import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AttendanceStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'STUDENT').toUpperCase();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate') || startDate;
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');
    const departmentId = searchParams.get('departmentId');

    return await withTenantContext(schoolId, async (tx) => {
      if (type === 'STUDENT') {
        const where: any = { schoolId };
        if (startDate && endDate) {
          where.date = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          where.date = new Date(startDate);
        }
        if (classId) where.classId = classId;
        if (sectionId) where.sectionId = sectionId;

        const attendances = await tx.studentAttendance.findMany({
          where,
          include: {
            student: {
              select: {
                id: true,
                studentCode: true,
                fullNameEn: true,
                fullNameBn: true,
                phone: true,
              },
            },
            class: { select: { id: true, nameEn: true } },
            section: { select: { id: true, nameEn: true } },
          },
        });

        const total = attendances.length;
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let halfDayCount = 0;
        let excusedCount = 0;

        const absentList: any[] = [];
        const lateList: any[] = [];

        for (const record of attendances) {
          if (record.status === AttendanceStatus.PRESENT) presentCount++;
          else if (record.status === AttendanceStatus.ABSENT) {
            absentCount++;
            absentList.push({
              studentId: record.studentId,
              studentCode: record.student.studentCode,
              name: record.student.fullNameEn,
              className: record.class?.nameEn,
              sectionName: record.section?.nameEn,
              date: record.date,
              leaveReason: record.leaveReason,
            });
          } else if (record.status === AttendanceStatus.LATE) {
            lateCount++;
            lateList.push({
              studentId: record.studentId,
              studentCode: record.student.studentCode,
              name: record.student.fullNameEn,
              className: record.class?.nameEn,
              sectionName: record.section?.nameEn,
              date: record.date,
              lateMinutes: record.lateMinutes,
            });
          } else if (record.status === AttendanceStatus.HALF_DAY) halfDayCount++;
          else if (record.status === AttendanceStatus.EXCUSED) excusedCount++;
        }

        const attendanceRate = total > 0 ? Number(((presentCount + lateCount) / total * 100).toFixed(2)) : 0;

        return NextResponse.json({
          success: true,
          data: {
            type: 'STUDENT',
            summary: {
              total,
              present: presentCount,
              absent: absentCount,
              late: lateCount,
              halfDay: halfDayCount,
              excused: excusedCount,
              attendanceRate,
            },
            absentList,
            lateList,
          },
        });
      } else {
        // Employee Attendance Report
        const where: any = { schoolId };
        if (startDate && endDate) {
          where.date = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          where.date = new Date(startDate);
        }

        const attendances = await tx.employeeAttendance.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                fullNameEn: true,
                departmentId: true,
                department: { select: { id: true, nameEn: true } },
                designation: { select: { id: true, titleEn: true } },
              },
            },
          },
        });

        const filtered = departmentId
          ? attendances.filter((a) => a.employee?.departmentId === departmentId)
          : attendances;

        const total = filtered.length;
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let leaveCount = 0;

        const absentList: any[] = [];
        const lateList: any[] = [];

        for (const record of filtered) {
          if (record.status === AttendanceStatus.PRESENT) presentCount++;
          else if (record.status === AttendanceStatus.ABSENT) {
            absentCount++;
            absentList.push({
              employeeId: record.employeeId,
              employeeCode: record.employee?.employeeCode,
              name: record.employee?.fullNameEn,
              department: record.employee?.department?.nameEn,
              designation: record.employee?.designation?.titleEn,
              date: record.date,
            });
          } else if (record.status === AttendanceStatus.LATE) {
            lateCount++;
            lateList.push({
              employeeId: record.employeeId,
              employeeCode: record.employee?.employeeCode,
              name: record.employee?.fullNameEn,
              department: record.employee?.department?.nameEn,
              designation: record.employee?.designation?.titleEn,
              date: record.date,
              lateMinutes: record.lateMinutes,
            });
          } else if (record.status === AttendanceStatus.LEAVE) leaveCount++;
        }

        const attendanceRate = total > 0 ? Number(((presentCount + lateCount) / total * 100).toFixed(2)) : 0;

        return NextResponse.json({
          success: true,
          data: {
            type: 'EMPLOYEE',
            summary: {
              total,
              present: presentCount,
              absent: absentCount,
              late: lateCount,
              leave: leaveCount,
              attendanceRate,
            },
            absentList,
            lateList,
          },
        });
      }
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
