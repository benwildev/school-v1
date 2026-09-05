import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { DisposeAssetSchema } from '@/lib/validation/inventory';
import { validateAssetDisposal } from '@/lib/inventory/asset-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'ASSET_DISPOSE' });
    const { assetId } = await params;

    const body = await request.json();
    const parsed = DisposeAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { disposalDate, disposalReason, disposalValue } = parsed.data;

    const disposed = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        const asset = await tx.asset.findFirst({
          where: { id: assetId, schoolId },
        });
        if (!asset) throw new Error('Asset not found');

        const check = validateAssetDisposal(asset.status);
        if (!check.valid) {
          throw new Error(check.reason || 'Asset cannot be disposed');
        }

        const now = disposalDate ? new Date(disposalDate) : new Date();

        // Close any active assignments
        await tx.assetAssignment.updateMany({
          where: {
            assetId,
            schoolId,
            returnedDate: null,
          },
          data: {
            returnedDate: now,
            conditionOnReturn: 'DAMAGED',
          },
        });

        return tx.asset.update({
          where: { id: assetId },
          data: {
            status: 'DISPOSED',
            assignedEmployeeId: null,
            disposalDate: now,
            disposalReason,
            disposalValue: disposalValue || 0,
            disposedById: context.userId,
          },
        });
      });
    });

    return NextResponse.json({ success: true, data: disposed });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
