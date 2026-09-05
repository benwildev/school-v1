import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AssignAssetSchema } from '@/lib/validation/inventory';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'ASSET_ASSIGN' });
    const { assetId } = await params;

    const body = await request.json();
    const parsed = AssignAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { employeeId, campusId, classroomId, locationName, condition, notes } = parsed.data;

    const result = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
          where: { id: assetId, schoolId },
        });
        if (!asset) throw new Error('Asset not found');

        if (asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
          throw new Error(`Cannot assign asset in terminal status: ${asset.status}`);
        }

        const now = new Date();

        // Close any active assignment
        await tx.assetAssignment.updateMany({
          where: {
            assetId,
            schoolId,
            returnedDate: null,
          },
          data: {
            returnedDate: now,
            conditionOnReturn: condition,
          },
        });

        // Create new assignment if an employee or classroom was specified
        let newAssignment = null;
        if (employeeId || classroomId || locationName) {
          newAssignment = await tx.assetAssignment.create({
            data: {
              schoolId,
              assetId,
              employeeId: employeeId || null,
              campusId: campusId || asset.campusId,
              classroomId: classroomId || null,
              locationName: locationName || null,
              assignedDate: now,
              conditionOnAssignment: condition,
              notes: notes || null,
              assignedById: context.userId,
            },
          });
        }

        const newStatus = employeeId ? 'ASSIGNED' : 'AVAILABLE';

        const updatedAsset = await tx.asset.update({
          where: { id: assetId },
          data: {
            status: newStatus,
            assignedEmployeeId: employeeId || null,
            campusId: campusId || asset.campusId,
            locationClassroomId: classroomId || null,
            roomLocation: locationName || null,
            currentCondition: condition,
          },
          include: {
            assignedEmployee: true,
            campus: true,
          },
        });

        return {
          asset: updatedAsset,
          assignment: newAssignment,
        };
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
