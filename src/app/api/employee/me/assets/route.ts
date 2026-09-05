import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/employee/me/assets
 * Employee self-service endpoint to view institutional assets assigned to them.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Resolve employee linked to the authenticated user
    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        employeeCode: true,
        fullNameEn: true,
        fullNameBn: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'No employee record linked to current user session.' },
        { status: 404 }
      );
    }

    const { id: employeeId, schoolId } = employee;

    const [activeAssets, assignmentHistory] = await Promise.all([
      prisma.asset.findMany({
        where: {
          schoolId,
          assignedEmployeeId: employeeId,
          status: 'ASSIGNED',
        },
        include: {
          item: { select: { id: true, itemCode: true, nameEn: true, nameBn: true, stockUnit: true } },
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          locationClassroom: { select: { id: true, roomNo: true } },
        },
        orderBy: { assetCode: 'asc' },
      }),
      prisma.assetAssignment.findMany({
        where: {
          schoolId,
          employeeId,
        },
        include: {
          asset: {
            include: {
              item: { select: { id: true, itemCode: true, nameEn: true, nameBn: true } },
            },
          },
        },
        orderBy: { assignedDate: 'desc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        employee,
        activeAssets,
        assignmentHistory,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
