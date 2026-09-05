import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AttendanceStatus, AuditAction } from '@prisma/client';
import { z } from 'zod';

const AttendanceRecordSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.nativeEnum(AttendanceStatus),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  lateMinutes: z.number().int().min(0).default(0),
});

const BulkAttendanceSchema = z.object({
  records: z.array(AttendanceRecordSchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = { schoolId };
    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }

    const attendances = await prisma.employeeAttendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }],
    });

    return NextResponse.json({ success: true, data: attendances });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_CREATE' });

    const body = await request.json();
    const parseResult = BulkAttendanceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { records } = parseResult.data;

    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, schoolId },
      select: { id: true, userId: true, teacherId: true },
    });

    if (employees.length !== employeeIds.length) {
      return NextResponse.json({ error: 'One or more employees do not belong to this school.' }, { status: 400 });
    }

    const empMap = new Map(employees.map((e) => [e.id, e]));

    const results = await withTenantContext(schoolId, async (tx) => {
      const upserted = [];
      for (const rec of records) {
        const emp = empMap.get(rec.employeeId);
        const targetUserId = emp?.userId || context.userId;
        const dateObj = new Date(rec.date);

        const item = await tx.employeeAttendance.upsert({
          where: {
            schoolId_userId_date: {
              schoolId,
              userId: targetUserId,
              date: dateObj,
            },
          },
          create: {
            schoolId,
            userId: targetUserId,
            employeeId: rec.employeeId,
            teacherId: emp?.teacherId ?? null,
            date: dateObj,
            status: rec.status,
            lateMinutes: rec.lateMinutes ?? 0,
            markedById: context.userId,
            markedAt: new Date(),
          },
          update: {
            employeeId: rec.employeeId,
            status: rec.status,
            lateMinutes: rec.lateMinutes ?? 0,
            markedById: context.userId,
            markedAt: new Date(),
          },
        });
        upserted.push(item);
      }
      return upserted;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'EmployeeAttendance',
      entityId: records[0].employeeId,
      changeSummary: `Recorded ${records.length} employee attendance entries`,
    });

    return NextResponse.json({ success: true, count: results.length, data: results }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
