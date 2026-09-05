import { z } from 'zod';

export const InventoryItemTypeSchema = z.enum(['CONSUMABLE', 'ASSET']);

export const StockUnitSchema = z.enum([
  'PCS',
  'BOX',
  'KG',
  'LITER',
  'SET',
  'ROLL',
  'PACKET',
  'METER',
  'OTHER',
]);

export const StockMovementTypeSchema = z.enum([
  'PURCHASE_IN',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ISSUE_OUT',
  'RETURN_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'LOSS',
  'DISPOSAL',
]);

export const PurchaseStatusSchema = z.enum([
  'ORDERED',
  'RECEIVED',
  'PARTIAL',
  'CANCELLED',
]);

export const AssetStatusSchema = z.enum([
  'AVAILABLE',
  'ASSIGNED',
  'MAINTENANCE',
  'LOST',
  'DAMAGED',
  'DISPOSED',
  'RETIRED',
]);

export const AssetConditionSchema = z.enum([
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
]);

export const CreateInventoryCategorySchema = z.object({
  code: z.string().trim().min(1, 'Category code is required').max(50),
  nameEn: z.string().trim().min(1, 'English name is required').max(100),
  nameBn: z.string().trim().min(1, 'Bangla name is required').max(100),
  itemType: InventoryItemTypeSchema.default('CONSUMABLE'),
  description: z.string().trim().optional().nullable(),
});

export const CreateInventoryItemSchema = z.object({
  categoryId: z.string().uuid('Valid category ID is required'),
  itemCode: z.string().trim().min(1, 'Item code is required').max(50),
  nameEn: z.string().trim().min(1, 'Item name is required').max(150),
  nameBn: z.string().trim().optional().nullable(),
  itemType: InventoryItemTypeSchema.default('CONSUMABLE'),
  stockUnit: StockUnitSchema.default('PCS'),
  minStockLevel: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  description: z.string().trim().optional().nullable(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial();

export const CreateSupplierSchema = z.object({
  supplierCode: z.string().trim().min(1, 'Supplier code is required').max(50),
  name: z.string().trim().min(1, 'Supplier name is required').max(150),
  companyName: z.string().trim().optional().nullable(),
  contactPerson: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email('Valid email address is required').optional().nullable().or(z.literal('')),
  address: z.string().trim().optional().nullable(),
});

export const CreatePurchaseSchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid('Valid supplier ID is required'),
  purchaseNumber: z.string().trim().min(1, 'Purchase number is required').max(50),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  receivedDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid('Valid item ID is required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        unitCost: z.number().min(0, 'Unit cost cannot be negative'),
      })
    )
    .min(1, 'Purchase must have at least one item'),
});

export const CreateStockMovementSchema = z.object({
  itemId: z.string().uuid('Valid item ID is required'),
  campusId: z.string().uuid('Valid campus ID is required'),
  movementType: StockMovementTypeSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.number().min(0).default(0),
  sourceCampusId: z.string().uuid().optional().nullable(),
  destinationCampusId: z.string().uuid().optional().nullable(),
  recipientEmployeeId: z.string().uuid().optional().nullable(),
  referenceType: z.string().trim().max(50).optional().nullable(),
  referenceId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const CreateInventoryTransferSchema = z
  .object({
    transferNumber: z.string().trim().min(1, 'Transfer number is required').max(50),
    itemId: z.string().uuid('Valid item ID is required'),
    sourceCampusId: z.string().uuid('Source campus is required'),
    destinationCampusId: z.string().uuid('Destination campus is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    transferDate: z.string().optional().nullable(),
    reason: z.string().trim().optional().nullable(),
  })
  .refine((data) => data.sourceCampusId !== data.destinationCampusId, {
    message: 'Source campus and destination campus cannot be the same',
    path: ['destinationCampusId'],
  });

export const CreateAssetSchema = z.object({
  itemId: z.string().uuid('Valid item ID is required'),
  campusId: z.string().uuid('Valid campus ID is required'),
  assetCode: z.string().trim().min(1, 'Asset code is required').max(100),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  modelNumber: z.string().trim().max(100).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().min(0).default(0),
  warrantyExpiry: z.string().optional().nullable(),
  currentCondition: AssetConditionSchema.default('NEW'),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  locationClassroomId: z.string().uuid().optional().nullable(),
  roomLocation: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const UpdateAssetSchema = z.object({
  campusId: z.string().uuid().optional(),
  currentCondition: AssetConditionSchema.optional(),
  status: AssetStatusSchema.optional(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  locationClassroomId: z.string().uuid().optional().nullable(),
  roomLocation: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const AssignAssetSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  campusId: z.string().uuid().optional().nullable(),
  classroomId: z.string().uuid().optional().nullable(),
  locationName: z.string().trim().max(150).optional().nullable(),
  condition: AssetConditionSchema.default('GOOD'),
  notes: z.string().trim().optional().nullable(),
});

export const DisposeAssetSchema = z.object({
  disposalDate: z.string().optional().nullable(),
  disposalReason: z.string().trim().min(3, 'Disposal reason must be at least 3 characters').max(500),
  disposalValue: z.number().min(0).optional().nullable(),
});

export const CreateAssetMaintenanceSchema = z.object({
  assetId: z.string().uuid('Valid asset ID is required'),
  maintenanceType: z.string().trim().min(1, 'Maintenance type is required').max(100),
  serviceDate: z.string().min(1, 'Service date is required'),
  vendorName: z.string().trim().max(150).optional().nullable(),
  issueDescription: z.string().trim().optional().nullable(),
  cost: z.number().min(0).default(0),
  status: z.string().trim().default('COMPLETED'),
  nextServiceDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
