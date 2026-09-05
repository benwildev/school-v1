import { prisma } from '../../db';
import { ReportExecutionContext, ReportExecutionResult, ReportColumn } from '../report-types';
import { formatCurrency } from '../report-formatters';
import { STOCK_IN_TYPES, STOCK_OUT_TYPES } from '../../inventory/stock-engine';


/**
 * 1. Current Stock & Inventory Valuation Report
 * Strictly derives authoritative current stock from the stock movement ledger:
 * Stock = sum(IN) - sum(OUT).
 */
export async function executeInventoryStockSummaryReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId, deletedAt: null };
  if (filters.inventoryCategoryId) whereClause.categoryId = filters.inventoryCategoryId;

  const items = await prisma.inventoryItem.findMany({
    where: whereClause,
    include: {
      category: { select: { nameEn: true } },
      stockMovements: {
        where: { schoolId, ...(filters.campusId ? { campusId: filters.campusId } : {}) },
        select: {
          movementType: true,
          quantity: true,
          unitCost: true,
        },
      },
    },
    orderBy: { nameEn: 'asc' },
  });

  const columns: ReportColumn[] = [
    { key: 'itemCode', labelEn: 'Item Code', labelBn: 'আইটেম কোড', type: 'string' },
    { key: 'name', labelEn: 'Item Name', labelBn: 'পণ্যের নাম', type: 'string' },
    { key: 'category', labelEn: 'Category', labelBn: 'বিভাগ', type: 'string' },
    { key: 'stockUnit', labelEn: 'Unit', labelBn: 'একক', type: 'string' },
    { key: 'currentStock', labelEn: 'Current Stock', labelBn: 'বর্তমান মজুদ', type: 'number' },
    { key: 'reorderLevel', labelEn: 'Reorder Level', labelBn: 'পুনর্বরাদ্দ স্তর', type: 'number' },
    { key: 'avgCost', labelEn: 'Average Unit Cost', labelBn: 'গড় একক মূল্য', type: 'currency', align: 'right' },
    { key: 'valuation', labelEn: 'Stock Valuation (৳)', labelBn: 'মজুদ মূল্য (৳)', type: 'currency', align: 'right' },
    { key: 'status', labelEn: 'Stock Status', labelBn: 'মজুদ অবস্থা', type: 'badge' },
  ];

  let totalValuation = 0;
  let lowStockCount = 0;

  const data = items.map((it) => {
    let inQty = 0;
    let outQty = 0;
    let totalInCost = 0;

    for (const sm of it.stockMovements) {
      const q = sm.quantity;
      if (STOCK_IN_TYPES.includes(sm.movementType as any)) {
        inQty += q;
        totalInCost += Number(sm.unitCost || 0) * q;
      } else if (STOCK_OUT_TYPES.includes(sm.movementType as any)) {
        outQty += q;
      }
    }

    const currentStock = Math.max(0, inQty - outQty);
    const avgCost = inQty > 0 ? totalInCost / inQty : 0;
    const valuation = currentStock * avgCost;
    totalValuation += valuation;

    const isLow = currentStock <= it.reorderLevel;
    if (isLow) lowStockCount++;

    return {
      itemCode: it.itemCode,
      name: it.nameEn,
      category: it.category?.nameEn || 'General',
      stockUnit: it.stockUnit,
      currentStock,
      reorderLevel: it.reorderLevel,
      avgCost,
      valuation,
      status: isLow ? 'LOW_STOCK' : 'ADEQUATE',
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalItems', labelEn: 'Catalog Items', labelBn: 'মোট আইটেম', value: items.length, type: 'number' },
      { key: 'totalValuation', labelEn: 'Total Stock Valuation', labelBn: 'মোট মজুদ পণ্যের মূল্য', value: formatCurrency(totalValuation), type: 'currency' },
      { key: 'lowStockAlerts', labelEn: 'Low Stock Alerts', labelBn: 'স্বল্প মজুদ সতর্কবার্তা', value: lowStockCount, type: 'number' },
    ],
  };
}

/**
 * 2. Tracked Asset Register & Condition Valuation Report
 */
export async function executeAssetRegisterValuationReport(
  ctx: ReportExecutionContext
): Promise<ReportExecutionResult> {
  const { schoolId, filters } = ctx;

  const whereClause: any = { schoolId };
  if (filters.campusId) whereClause.campusId = filters.campusId;
  if (filters.status) whereClause.status = filters.status;

  const assets = await prisma.asset.findMany({
    where: whereClause,
    include: {
      item: { select: { nameEn: true } },
      campus: { select: { nameEn: true } },
      assignedEmployee: { select: { fullNameEn: true } },
      maintenanceLogs: { select: { cost: true } },
    },
    orderBy: { assetCode: 'asc' },
  });

  const columns: ReportColumn[] = [
    { key: 'assetCode', labelEn: 'Asset Code', labelBn: 'অ্যাসেট কোড', type: 'string' },
    { key: 'itemName', labelEn: 'Asset Name', labelBn: 'সম্পদের নাম', type: 'string' },
    { key: 'serialNumber', labelEn: 'Serial Number', labelBn: 'সিরিয়াল নম্বর', type: 'string' },
    { key: 'campus', labelEn: 'Campus', labelBn: 'ক্যাম্পাস', type: 'string' },
    { key: 'condition', labelEn: 'Condition', labelBn: 'অবস্থা', type: 'badge' },
    { key: 'status', labelEn: 'Assignment Status', labelBn: 'বরাদ্দ অবস্থা', type: 'badge' },
    { key: 'assignedTo', labelEn: 'Assigned User', labelBn: 'ব্যবহারকারী', type: 'string' },
    { key: 'purchaseCost', labelEn: 'Purchase Value (৳)', labelBn: 'ক্রয়মূল্য (৳)', type: 'currency', align: 'right' },
    { key: 'maintenanceCost', labelEn: 'Maintenance Cost (৳)', labelBn: 'রক্ষণাবেক্ষণ ব্যয় (৳)', type: 'currency', align: 'right' },
  ];

  let totalAssetValue = 0;
  let totalMaintenanceSpent = 0;
  let assignedCount = 0;

  const data = assets.map((a) => {
    const cost = Number(a.purchaseCost || 0);
    totalAssetValue += cost;
    if (a.status === 'ASSIGNED') assignedCount++;

    const maint = a.maintenanceLogs.reduce((acc, m) => acc + Number(m.cost || 0), 0);
    totalMaintenanceSpent += maint;

    return {
      assetCode: a.assetCode,
      itemName: a.item.nameEn,
      serialNumber: a.serialNumber || '-',
      campus: a.campus.nameEn,
      condition: a.currentCondition,
      status: a.status,
      assignedTo: a.assignedEmployee?.fullNameEn || 'Unassigned',
      purchaseCost: cost,
      maintenanceCost: maint,
    };
  });

  return {
    data,
    totalCount: data.length,
    columns,
    summary: [
      { key: 'totalAssets', labelEn: 'Total Assets', labelBn: 'মোট মূলধনী সম্পদ', value: assets.length, type: 'number' },
      { key: 'assignedAssets', labelEn: 'Assigned Assets', labelBn: 'বরাদ্দকৃত সম্পদ', value: assignedCount, type: 'number' },
      { key: 'totalAssetValue', labelEn: 'Total Capital Value', labelBn: 'মোট সম্পদ মূল্য', value: formatCurrency(totalAssetValue), type: 'currency' },
      { key: 'totalMaintCost', labelEn: 'Total Repairs Spent', labelBn: 'মোট মেরামত খরচ', value: formatCurrency(totalMaintenanceSpent), type: 'currency' },
    ],
  };
}
