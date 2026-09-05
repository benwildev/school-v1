import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateInventoryItemSchema } from '@/lib/validation/inventory';
import { calculateCurrentStock, evaluateStockThresholds } from '@/lib/inventory/stock-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId') || undefined;
    const itemType = searchParams.get('itemType') || undefined;
    const campusId = searchParams.get('campusId') || undefined;
    const query = searchParams.get('q')?.trim();

    const items = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (categoryId) whereClause.categoryId = categoryId;
      if (itemType) whereClause.itemType = itemType;
      if (query) {
        whereClause.OR = [
          { itemCode: { contains: query, mode: 'insensitive' } },
          { nameEn: { contains: query, mode: 'insensitive' } },
          { nameBn: { contains: query, mode: 'insensitive' } },
        ];
      }

      return prisma.inventoryItem.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, code: true, nameEn: true, nameBn: true } },
          stockMovements: {
            where: campusId ? { campusId } : undefined,
            select: { movementType: true, quantity: true },
          },
          _count: {
            select: {
              assets: true,
              stockMovements: true,
            },
          },
        },
        orderBy: { nameEn: 'asc' },
      });
    });

    const enriched = items.map((item) => {
      const currentStock = calculateCurrentStock(item.stockMovements);
      const thresholds = evaluateStockThresholds(currentStock, item.minStockLevel, item.reorderLevel);
      return {
        id: item.id,
        itemCode: item.itemCode,
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        itemType: item.itemType,
        stockUnit: item.stockUnit,
        minStockLevel: item.minStockLevel,
        reorderLevel: item.reorderLevel,
        description: item.description,
        category: item.category,
        currentStock,
        ...thresholds,
        assetsCount: item._count.assets,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_CREATE' });

    const body = await request.json();
    const parsed = CreateInventoryItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      categoryId,
      itemCode,
      nameEn,
      nameBn,
      itemType,
      stockUnit,
      minStockLevel,
      reorderLevel,
      description,
    } = parsed.data;

    const item = await withTenantContext(schoolId, async () => {
      // Validate category belongs to school
      const category = await prisma.inventoryCategory.findFirst({
        where: { id: categoryId, schoolId },
      });
      if (!category) throw new Error('Category not found in this school');

      // Check unique itemCode
      const existing = await prisma.inventoryItem.findFirst({
        where: { schoolId, itemCode },
      });
      if (existing) {
        throw new Error(`Item code "${itemCode}" already exists.`);
      }

      return prisma.inventoryItem.create({
        data: {
          schoolId,
          categoryId,
          itemCode,
          nameEn,
          nameBn: nameBn || null,
          itemType: itemType || 'CONSUMABLE',
          stockUnit: stockUnit || 'PCS',
          minStockLevel: minStockLevel || 0,
          reorderLevel: reorderLevel || 0,
          description: description || null,
        },
        include: {
          category: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
