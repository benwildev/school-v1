import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateStockMovementSchema } from '@/lib/validation/inventory';
import {
  isStockOutMovement,
  calculateCurrentStock,
  validateStockAvailability,
} from '@/lib/inventory/stock-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId') || undefined;
    const campusId = searchParams.get('campusId') || undefined;
    const movementType = (searchParams.get('movementType') as any) || undefined;

    const movements = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (itemId) whereClause.itemId = itemId;
      if (campusId) whereClause.campusId = campusId;
      if (movementType) whereClause.movementType = movementType;

      return prisma.stockMovement.findMany({
        where: whereClause,
        include: {
          item: {
            select: { id: true, itemCode: true, nameEn: true, nameBn: true, stockUnit: true },
          },
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          recipientEmployee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: movements });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateStockMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      itemId,
      campusId,
      movementType,
      quantity,
      unitCost,
      sourceCampusId,
      destinationCampusId,
      recipientEmployeeId,
      referenceType,
      referenceId,
      notes,
    } = parsed.data;

    const requiredPermission = isStockOutMovement(movementType)
      ? 'INVENTORY_STOCK_OUT'
      : 'INVENTORY_STOCK_IN';

    const { schoolId, context } = await requirePermission(request, { permission: requiredPermission });

    const movement = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        // Verify item exists
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, schoolId },
        });
        if (!item) throw new Error('Inventory item not found');

        // If outbound movement, check stock availability
        if (isStockOutMovement(movementType)) {
          const pastMovements = await tx.stockMovement.findMany({
            where: { schoolId, itemId, campusId },
            select: { movementType: true, quantity: true },
          });

          const currentStock = calculateCurrentStock(pastMovements);
          const check = validateStockAvailability(currentStock, quantity);
          if (!check.available) {
            throw new Error(check.error || 'Insufficient stock for this outbound movement.');
          }
        }

        return tx.stockMovement.create({
          data: {
            schoolId,
            itemId,
            campusId,
            movementType,
            quantity,
            unitCost: unitCost || 0,
            sourceCampusId: sourceCampusId || null,
            destinationCampusId: destinationCampusId || null,
            recipientEmployeeId: recipientEmployeeId || null,
            referenceType: referenceType || null,
            referenceId: referenceId || null,
            notes: notes || null,
            createdById: context.userId,
          },
          include: {
            item: true,
            campus: true,
          },
        });
      });
    });

    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
