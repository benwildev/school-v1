import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/employee/reports
 * Employee self-service report: attendance, leaves, payslips, and assigned assets.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Locate employee profile
    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        deletedAt: null,
      },
      include: {
        department: { select: { nameEn: true } },
        designation: { select: { titleEn: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found for this account.' }, { status: 404 });
    }

    const schoolId = employee.schoolId;

    // Attendance stats
    const attendances = await prisma.employeeAttendance.findMany({
      where: { schoolId, employeeId: employee.id },
      select: { status: true },
    });
    const totalWorkingDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const leaveDays = attendances.filter((a) => a.status === 'LEAVE').length;
    const rate = totalWorkingDays > 0 ? Number(((presentDays / totalWorkingDays) * 100).toFixed(1)) : 0;

    // Recent Payslips
    const payrollRecords = await prisma.payrollRecord.findMany({
      where: { employeeId: employee.id },
      include: { period: { select: { nameEn: true, periodKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    // Assigned Assets
    const assignedAssets = await prisma.asset.findMany({
      where: { schoolId, assignedEmployeeId: employee.id },
      include: { item: { select: { nameEn: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          name: employee.fullNameEn,
          department: employee.department?.nameEn || 'General',
          designation: employee.designation?.titleEn || 'Staff',
        },
        attendance: {
          totalWorkingDays,
          presentDays,
          leaveDays,
          attendanceRate: rate,
        },
        payslips: payrollRecords.map((pr) => ({
          id: pr.id,
          periodName: pr.period?.nameEn || 'N/A',
          monthYear: pr.period?.periodKey || '',
          grossSalary: Number(pr.grossEarnings),
          deductions: Number(pr.totalDeductions),
          netSalary: Number(pr.netSalary),
          status: pr.status,
        })),
        assignedAssets: assignedAssets.map((a) => ({
          assetCode: a.assetCode,
          name: a.item.nameEn,
          condition: a.currentCondition,
        })),
      },
    });

  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
