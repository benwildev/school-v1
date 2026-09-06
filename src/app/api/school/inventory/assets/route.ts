import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateAssetSchema } from '@/lib/validation/inventory';
import { generateAssetCode } from '@/lib/inventory/asset-engine';
import { generateBarcode } from '@/lib/library/book-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ASSET_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId') || undefined;
    const campusId = searchParams.get('campusId') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const assignedEmployeeId = searchParams.get('assignedEmployeeId') || undefined;
    const query = searchParams.get('q')?.trim();

    const assets = await withTenantContext(schoolId, async (tx) => {
      const whereClause: any = { schoolId };
      if (itemId) whereClause.itemId = itemId;
      if (campusId) whereClause.campusId = campusId;
      if (status) whereClause.status = status;
      if (assignedEmployeeId) whereClause.assignedEmployeeId = assignedEmployeeId;
      if (query) {
        whereClause.OR = [
          { assetCode: { contains: query, mode: 'insensitive' } },
          { serialNumber: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
          { roomLocation: { contains: query, mode: 'insensitive' } },
        ];
      }

      return tx.asset.findMany({
        where: whereClause,
        include: {
          item: {
            select: { id: true, itemCode: true, nameEn: true, nameBn: true, stockUnit: true },
          },
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          assignedEmployee: {
            select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true },
          },
          locationClassroom: { select: { id: true, roomNo: true } },
          _count: {
            select: {
              assignments: true,
              maintenanceLogs: true,
            },
          },
        },
        orderBy: { assetCode: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: assets });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'ASSET_CREATE' });

    const body = await request.json();
    const parsed = CreateAssetSchema.safeParse({
      ...body,
      assetCode: body.assetCode || generateAssetCode('AST'),
      barcode: body.barcode || generateBarcode('AST'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      itemId,
      campusId,
      assetCode,
      serialNumber,
      barcode,
      modelNumber,
      purchaseDate,
      purchaseCost,
      warrantyExpiry,
      currentCondition,
      assignedEmployeeId,
      locationClassroomId,
      roomLocation,
      notes,
    } = parsed.data;

    const asset = await withTenantContext(schoolId, async (tx) => {
      return tx.$transaction(async (tx) => {
        // 1. Verify item exists and is ASSET
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, schoolId },
        });
        if (!item) throw new Error('Inventory item not found');

        // 2. Check unique assetCode
        const existing = await tx.asset.findFirst({
          where: { schoolId, assetCode },
        });
        if (existing) {
          throw new Error(`Asset code "${assetCode}" already exists.`);
        }

        const isAssigned = !!assignedEmployeeId;
        const initialStatus = isAssigned ? 'ASSIGNED' : 'AVAILABLE';

        const createdAsset = await tx.asset.create({
          data: {
            schoolId,
            itemId,
            campusId,
            assetCode,
            serialNumber: serialNumber || null,
            barcode: barcode || null,
            modelNumber: modelNumber || null,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
            purchaseCost: purchaseCost || 0,
            warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
            currentCondition: currentCondition || 'NEW',
            status: initialStatus,
            assignedEmployeeId: assignedEmployeeId || null,
            locationClassroomId: locationClassroomId || null,
            roomLocation: roomLocation || null,
            notes: notes || null,
          },
          include: {
            item: true,
            campus: true,
            assignedEmployee: true,
          },
        });

        // If initially assigned, create initial AssetAssignment record
        if (assignedEmployeeId) {
          await tx.assetAssignment.create({
            data: {
              schoolId,
              assetId: createdAsset.id,
              employeeId: assignedEmployeeId,
              campusId,
              classroomId: locationClassroomId || null,
              locationName: roomLocation || null,
              assignedDate: new Date(),
              conditionOnAssignment: currentCondition || 'NEW',
              assignedById: context.userId,
            },
          });
        }

        return createdAsset;
      });
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
