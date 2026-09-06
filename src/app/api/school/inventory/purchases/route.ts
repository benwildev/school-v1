import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreatePurchaseSchema } from '@/lib/validation/inventory';
import { calculatePurchaseTotal } from '@/lib/inventory/purchase-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'PURCHASE_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId') || undefined;
    const status = searchParams.get('status') || undefined;
    const campusId = searchParams.get('campusId') || undefined;

    const purchases = await withTenantContext(schoolId, async (tx) => {
      const whereClause: any = { schoolId };
      if (supplierId) whereClause.supplierId = supplierId;
      if (status) whereClause.status = status;
      if (campusId) whereClause.campusId = campusId;

      return tx.inventoryPurchase.findMany({
        where: whereClause,
        include: {
          supplier: true,
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          items: {
            include: {
              item: { select: { id: true, itemCode: true, nameEn: true, nameBn: true, stockUnit: true } },
            },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { purchaseDate: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: purchases });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'PURCHASE_CREATE' });

    const body = await request.json();
    const parsed = CreatePurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      campusId,
      supplierId,
      purchaseNumber,
      invoiceNumber,
      purchaseDate,
      receivedDate,
      notes,
      items,
    } = parsed.data;

    const purchase = await withTenantContext(schoolId, async (tx) => {
      return tx.$transaction(async (tx) => {
        // 1. Verify supplier
        const supplier = await tx.inventorySupplier.findFirst({
          where: { id: supplierId, schoolId },
        });
        if (!supplier) throw new Error('Supplier not found');

        // 2. Verify campus if provided
        let targetCampusId = campusId;
        if (!targetCampusId) {
          const firstCampus = await tx.campus.findFirst({
            where: { schoolId },
            select: { id: true },
          });
          if (!firstCampus) throw new Error('No campus found for school');
          targetCampusId = firstCampus.id;
        }

        // 3. Check unique purchaseNumber
        const existing = await tx.inventoryPurchase.findFirst({
          where: { schoolId, purchaseNumber },
        });
        if (existing) {
          throw new Error(`Purchase number "${purchaseNumber}" already exists.`);
        }

        // 4. Calculate total
        const totalAmount = calculatePurchaseTotal(items);

        const status = receivedDate ? 'RECEIVED' : 'ORDERED';

        // 5. Create purchase
        const createdPurchase = await tx.inventoryPurchase.create({
          data: {
            schoolId,
            campusId: targetCampusId,
            supplierId,
            purchaseNumber,
            invoiceNumber: invoiceNumber || null,
            purchaseDate: new Date(purchaseDate),
            receivedDate: receivedDate ? new Date(receivedDate) : null,
            totalAmount,
            status,
            notes: notes || null,
            createdById: context.userId,
            items: {
              create: items.map((i: { itemId: string; quantity: number; unitCost: number }) => ({
                schoolId,
                itemId: i.itemId,
                quantity: i.quantity,
                unitCost: i.unitCost,
                totalCost: i.quantity * i.unitCost,
              })),
            },
          },
          include: {
            items: true,
            supplier: true,
          },
        });

        // 6. If marked as received, create automatic PURCHASE_IN stock movements
        if (status === 'RECEIVED' && targetCampusId) {
          for (const item of items) {
            await tx.stockMovement.create({
              data: {
                schoolId,
                itemId: item.itemId,
                campusId: targetCampusId,
                movementType: 'PURCHASE_IN',
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.quantity * item.unitCost,
                referenceType: 'PURCHASE',
                referenceId: createdPurchase.id,
                notes: `Auto stock-in from purchase ${purchaseNumber}`,
                createdById: context.userId,
              },
            });
          }
        }

        return createdPurchase;
      });
    });

    return NextResponse.json({ success: true, data: purchase }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
