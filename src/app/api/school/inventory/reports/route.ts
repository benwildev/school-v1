import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { calculateCurrentStock } from '@/lib/inventory/stock-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'INVENTORY_REPORT_VIEW' });

    const stats = await withTenantContext(schoolId, async (tx) => {
      const [
        totalItems,
        consumableItems,
        assetItems,
        allConsumables,
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        disposedAssets,
        assetValuation,
        purchases,
        totalTransfers,
      ] = await Promise.all([
        tx.inventoryItem.count({ where: { schoolId } }),
        tx.inventoryItem.count({ where: { schoolId, itemType: 'CONSUMABLE' } }),
        tx.inventoryItem.count({ where: { schoolId, itemType: 'ASSET' } }),
        tx.inventoryItem.findMany({
          where: { schoolId, itemType: 'CONSUMABLE' },
          include: {
            stockMovements: { select: { movementType: true, quantity: true } },
          },
        }),
        tx.asset.count({ where: { schoolId } }),
        tx.asset.count({ where: { schoolId, status: 'AVAILABLE' } }),
        tx.asset.count({ where: { schoolId, status: 'ASSIGNED' } }),
        tx.asset.count({ where: { schoolId, status: 'MAINTENANCE' } }),
        tx.asset.count({ where: { schoolId, status: 'DISPOSED' } }),
        tx.asset.aggregate({
          where: { schoolId },
          _sum: { purchaseCost: true },
        }),
        tx.inventoryPurchase.aggregate({
          where: { schoolId },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        tx.inventoryTransfer.count({ where: { schoolId } }),
      ]);

      // Count low stock consumables
      let lowStockCount = 0;
      for (const item of allConsumables) {
        const current = calculateCurrentStock(item.stockMovements);
        if (current <= item.reorderLevel) {
          lowStockCount++;
        }
      }

      return {
        catalog: {
          totalItems,
          consumableItems,
          assetItems,
          lowStockCount,
        },
        assets: {
          totalAssets,
          availableAssets,
          assignedAssets,
          maintenanceAssets,
          disposedAssets,
          totalValuation: Number(assetValuation._sum.purchaseCost || 0),
        },
        procurement: {
          totalPurchases: purchases._count?._all || 0,
          totalPurchaseCost: Number(purchases._sum?.totalAmount || 0),
          totalTransfers,
        },
      };
    });

    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
