import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateInventoryCategorySchema } from '@/lib/validation/inventory';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_VIEW' });

    const categories = await withTenantContext(schoolId, async () => {
      return prisma.inventoryCategory.findMany({
        where: { schoolId },
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { nameEn: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_CREATE' });

    const body = await request.json();
    const parsed = CreateInventoryCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { code, nameEn, nameBn, itemType, description } = parsed.data;

    const category = await withTenantContext(schoolId, async () => {
      const existing = await prisma.inventoryCategory.findFirst({
        where: { schoolId, code },
      });
      if (existing) {
        throw new Error(`Inventory category code "${code}" already exists.`);
      }

      return prisma.inventoryCategory.create({
        data: {
          schoolId,
          code,
          nameEn,
          nameBn,
          itemType: itemType || 'CONSUMABLE',
          description: description || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
