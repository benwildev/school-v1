import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateAssetMaintenanceSchema } from '@/lib/validation/inventory';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ASSET_MAINTENANCE_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const assetId = searchParams.get('assetId') || undefined;

    const logs = await withTenantContext(schoolId, async (tx) => {
      const whereClause: any = { schoolId };
      if (assetId) whereClause.assetId = assetId;

      return tx.assetMaintenanceLog.findMany({
        where: whereClause,
        include: {
          asset: {
            include: {
              item: { select: { id: true, itemCode: true, nameEn: true, nameBn: true } },
              campus: { select: { id: true, nameEn: true, nameBn: true } },
            },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { serviceDate: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'ASSET_MAINTENANCE_CREATE' });

    const body = await request.json();
    const parsed = CreateAssetMaintenanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      assetId,
      maintenanceType,
      serviceDate,
      vendorName,
      issueDescription,
      cost,
      status,
      nextServiceDate,
      notes,
    } = parsed.data;

    const log = await withTenantContext(schoolId, async (tx) => {
      return tx.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
          where: { id: assetId, schoolId },
        });
        if (!asset) throw new Error('Asset not found');

        const createdLog = await tx.assetMaintenanceLog.create({
          data: {
            schoolId,
            assetId,
            maintenanceType,
            serviceDate: new Date(serviceDate),
            vendorName: vendorName || null,
            issueDescription: issueDescription || null,
            cost: cost || 0,
            status: status || 'COMPLETED',
            nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
            notes: notes || null,
            createdById: context.userId,
          },
          include: {
            asset: true,
          },
        });

        // If maintenance is ongoing, set asset status to MAINTENANCE
        if (status === 'IN_PROGRESS' && asset.status !== 'MAINTENANCE') {
          await tx.asset.update({
            where: { id: assetId },
            data: { status: 'MAINTENANCE' },
          });
        } else if (status === 'COMPLETED' && asset.status === 'MAINTENANCE') {
          await tx.asset.update({
            where: { id: assetId },
            data: { status: asset.assignedEmployeeId ? 'ASSIGNED' : 'AVAILABLE' },
          });
        }

        return createdLog;
      });
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
