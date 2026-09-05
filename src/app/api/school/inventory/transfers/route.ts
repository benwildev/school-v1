import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateInventoryTransferSchema } from '@/lib/validation/inventory';
import { calculateCurrentStock, validateStockAvailability } from '@/lib/inventory/stock-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId') || undefined;
    const sourceCampusId = searchParams.get('sourceCampusId') || undefined;
    const destinationCampusId = searchParams.get('destinationCampusId') || undefined;

    const transfers = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (itemId) whereClause.itemId = itemId;
      if (sourceCampusId) whereClause.sourceCampusId = sourceCampusId;
      if (destinationCampusId) whereClause.destinationCampusId = destinationCampusId;

      return prisma.inventoryTransfer.findMany({
        where: whereClause,
        include: {
          item: {
            select: { id: true, itemCode: true, nameEn: true, nameBn: true, stockUnit: true },
          },
          sourceCampus: { select: { id: true, nameEn: true, nameBn: true } },
          destinationCampus: { select: { id: true, nameEn: true, nameBn: true } },
          initiatedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { transferDate: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'INVENTORY_TRANSFER' });

    const body = await request.json();
    const parsed = CreateInventoryTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      transferNumber,
      itemId,
      sourceCampusId,
      destinationCampusId,
      quantity,
      transferDate,
      reason,
    } = parsed.data;

    const transfer = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        // 1. Verify item
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, schoolId },
        });
        if (!item) throw new Error('Inventory item not found');

        // 2. Check unique transferNumber
        const existing = await tx.inventoryTransfer.findFirst({
          where: { schoolId, transferNumber },
        });
        if (existing) {
          throw new Error(`Transfer number "${transferNumber}" already exists.`);
        }

        // 3. Verify stock availability at source campus
        const sourceMovements = await tx.stockMovement.findMany({
          where: { schoolId, itemId, campusId: sourceCampusId },
          select: { movementType: true, quantity: true },
        });
        const currentSourceStock = calculateCurrentStock(sourceMovements);
        const check = validateStockAvailability(currentSourceStock, quantity);
        if (!check.available) {
          throw new Error(`Transfer failed: ${check.error}`);
        }

        const date = transferDate ? new Date(transferDate) : new Date();

        // 4. Create Transfer record
        const createdTransfer = await tx.inventoryTransfer.create({
          data: {
            schoolId,
            transferNumber,
            itemId,
            sourceCampusId,
            destinationCampusId,
            quantity,
            transferDate: date,
            reason: reason || null,
            initiatedById: context.userId,
          },
          include: {
            item: true,
            sourceCampus: true,
            destinationCampus: true,
          },
        });

        // 5. Create paired stock movements
        // TRANSFER_OUT from source
        await tx.stockMovement.create({
          data: {
            schoolId,
            itemId,
            campusId: sourceCampusId,
            movementType: 'TRANSFER_OUT',
            quantity,
            destinationCampusId,
            referenceType: 'TRANSFER',
            referenceId: createdTransfer.id,
            notes: `Transfer #${transferNumber} to destination campus`,
            createdById: context.userId,
          },
        });

        // TRANSFER_IN to destination
        await tx.stockMovement.create({
          data: {
            schoolId,
            itemId,
            campusId: destinationCampusId,
            movementType: 'TRANSFER_IN',
            quantity,
            sourceCampusId,
            referenceType: 'TRANSFER',
            referenceId: createdTransfer.id,
            notes: `Transfer #${transferNumber} from source campus`,
            createdById: context.userId,
          },
        });

        return createdTransfer;
      });
    });

    return NextResponse.json({ success: true, data: transfer }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
