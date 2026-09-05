import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateInventoryItemSchema } from '@/lib/validation/inventory';
import { calculateCurrentStock, evaluateStockThresholds } from '@/lib/inventory/stock-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_VIEW' });
    const { itemId } = await params;

    const item = await withTenantContext(schoolId, async () => {
      return prisma.inventoryItem.findFirst({
        where: { id: itemId, schoolId },
        include: {
          category: true,
          stockMovements: {
            include: {
              campus: { select: { id: true, nameEn: true, nameBn: true } },
              createdBy: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          assets: {
            include: {
              campus: { select: { id: true, nameEn: true, nameBn: true } },
              assignedEmployee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
            },
            orderBy: { assetCode: 'asc' },
          },
        },
      });
    });

    if (!item) {
      return NextResponse.json({ success: false, error: 'Inventory item not found' }, { status: 404 });
    }

    const currentStock = calculateCurrentStock(item.stockMovements);
    const thresholds = evaluateStockThresholds(currentStock, item.minStockLevel, item.reorderLevel);

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        currentStock,
        ...thresholds,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_UPDATE' });
    const { itemId } = await params;

    const body = await request.json();
    const parsed = UpdateInventoryItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async () => {
      const existing = await prisma.inventoryItem.findFirst({
        where: { id: itemId, schoolId },
      });
      if (!existing) throw new Error('Inventory item not found');

      return prisma.inventoryItem.update({
        where: { id: itemId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
