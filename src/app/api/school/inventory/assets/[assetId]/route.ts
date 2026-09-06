import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateAssetSchema } from '@/lib/validation/inventory';
import { isValidAssetStatusTransition } from '@/lib/inventory/asset-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ASSET_VIEW' });
    const { assetId } = await params;

    const asset = await withTenantContext(schoolId, async (tx) => {
      return tx.asset.findFirst({
        where: { id: assetId, schoolId },
        include: {
          item: true,
          campus: true,
          assignedEmployee: {
            select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true },
          },
          locationClassroom: true,
          assignments: {
            include: {
              employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
              assignedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { assignedDate: 'desc' },
            take: 20,
          },
          maintenanceLogs: {
            include: {
              createdBy: { select: { id: true, fullName: true } },
            },
            orderBy: { serviceDate: 'desc' },
            take: 20,
          },
        },
      });
    });

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: asset });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ASSET_UPDATE' });
    const { assetId } = await params;

    const body = await request.json();
    const parsed = UpdateAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.asset.findFirst({
        where: { id: assetId, schoolId },
      });
      if (!existing) throw new Error('Asset not found');

      if (parsed.data.status && parsed.data.status !== existing.status) {
        const check = isValidAssetStatusTransition(existing.status, parsed.data.status);
        if (!check.valid) {
          throw new Error(check.reason || `Invalid status transition from ${existing.status} to ${parsed.data.status}`);
        }
      }

      return tx.asset.update({
        where: { id: assetId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
