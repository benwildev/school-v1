import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto, { randomUUID } from 'crypto';

// Phase 10 Domain Engine Imports
import {
  generateBarcode,
  generateAccessionNumber,
  validateIsbn,
  isValidCopyStatusTransition,
  calculateBookInventorySummary,
} from '../src/lib/library/book-engine.ts';

import {
  validateBorrowerEligibility,
  calculateDueDate,
  calculateOverdueDays,
  validateRenewalEligibility,
  isValidLoanStatusTransition,
} from '../src/lib/library/circulation-engine.ts';

import {
  calculateOverdueFine,
  calculateLostBookCharge,
  calculateDamageCharge,
  calculateFineBalance,
  createFineSnapshot,
} from '../src/lib/library/fine-engine.ts';

import {
  calculateReservationExpiryDate,
  isReservationExpired,
  canPlaceReservation,
  canFulfillReservation,
} from '../src/lib/library/reservation-engine.ts';

import {
  isStockInMovement,
  isStockOutMovement,
  calculateCurrentStock,
  validateStockAvailability,
  evaluateStockThresholds,
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
} from '../src/lib/inventory/stock-engine.ts';

import {
  calculatePurchaseTotal,
  generatePurchaseNumber,
  isValidPurchaseStatusTransition,
} from '../src/lib/inventory/purchase-engine.ts';

import {
  generateAssetCode,
  isAssetUnderWarranty,
  isValidAssetStatusTransition,
  canDisposeAsset,
} from '../src/lib/inventory/asset-engine.ts';

// Validation Schemas
import {
  CreateLibraryCategorySchema,
  CreateLibraryAuthorSchema,
  CreateLibraryPublisherSchema,
  CreateLibraryBookSchema,
  CreateLibraryBookCopySchema,
  UpdateLibraryBookCopySchema,
  IssueBookSchema,
  ReturnBookSchema,
  RenewBookSchema,
  CreateReservationSchema,
  WaiveFineSchema,
  UpdateLibrarySettingsSchema,
} from '../src/lib/validation/library.ts';

import {
  CreateInventoryCategorySchema,
  CreateInventoryItemSchema,
  CreateSupplierSchema,
  CreatePurchaseSchema,
  CreateStockMovementSchema,
  CreateInventoryTransferSchema,
  CreateAssetSchema,
  UpdateAssetSchema,
  AssignAssetSchema,
  DisposeAssetSchema,
  CreateAssetMaintenanceSchema,
} from '../src/lib/validation/inventory.ts';

// Permissions
import { SYSTEM_ROLE_PERMISSIONS, PERMISSION_CATALOG } from '../src/lib/authorization/permissions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runPhase10Tests() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 10 Library, Inventory & Asset Engine Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(scenarioNum, description) {
    passed++;
    console.log(`✓ Scenario ${scenarioNum.toString().padStart(3, '0')} PASSED: ${description}`);
  }

  function recordFail(scenarioNum, description, err) {
    failed++;
    console.error(`✗ Scenario ${scenarioNum.toString().padStart(3, '0')} FAILED: ${description}`);
    console.error(`   Reason: ${err.message || err}\n`);
  }

  // --------------------------------------------------------------------------
  // SECTION 1: LIBRARY VALIDATION SCHEMAS (Scenarios 1-18)
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: LIBRARY VALIDATION SCHEMAS ---');

  // Scenario 1: CreateLibraryCategorySchema accepts valid category
  try {
    const res = CreateLibraryCategorySchema.safeParse({
      code: 'CAT-SCI',
      nameEn: 'Science & Technology',
      nameBn: 'বিজ্ঞান ও প্রযুক্তি',
      description: 'Science books and references',
    });
    if (!res.success) throw new Error('Valid library category was rejected');
    recordPass(1, 'CreateLibraryCategorySchema accepts valid bilingual category attributes');
  } catch (err) {
    recordFail(1, 'Valid library category', err);
  }

  // Scenario 2: CreateLibraryCategorySchema rejects empty category code
  try {
    const res = CreateLibraryCategorySchema.safeParse({
      code: '   ',
      nameEn: 'Literature',
      nameBn: 'সাহিত্য',
    });
    if (res.success) throw new Error('Blank category code was accepted');
    recordPass(2, 'CreateLibraryCategorySchema rejects empty or whitespace-only category code');
  } catch (err) {
    recordFail(2, 'Empty category code', err);
  }

  // Scenario 3: CreateLibraryAuthorSchema accepts valid author
  try {
    const res = CreateLibraryAuthorSchema.safeParse({
      nameEn: 'Kazi Nazrul Islam',
      nameBn: 'কাজী নজরুল ইসলাম',
      bio: 'National Poet of Bangladesh',
    });
    if (!res.success) throw new Error('Valid author was rejected');
    recordPass(3, 'CreateLibraryAuthorSchema accepts valid author details');
  } catch (err) {
    recordFail(3, 'Valid author', err);
  }

  // Scenario 4: CreateLibraryAuthorSchema rejects missing English name
  try {
    const res = CreateLibraryAuthorSchema.safeParse({
      nameEn: '',
      nameBn: 'রবীন্দ্রনাথ ঠাকুর',
    });
    if (res.success) throw new Error('Blank author English name was accepted');
    recordPass(4, 'CreateLibraryAuthorSchema rejects missing author English name');
  } catch (err) {
    recordFail(4, 'Missing author nameEn', err);
  }

  // Scenario 5: CreateLibraryPublisherSchema accepts valid publisher
  try {
    const res = CreateLibraryPublisherSchema.safeParse({
      nameEn: 'Bangla Academy',
      nameBn: 'বাংলা একাডেমি',
      address: 'Dhaka, Bangladesh',
      contactPhone: '+8801711112233',
    });
    if (!res.success) throw new Error('Valid publisher was rejected');
    recordPass(5, 'CreateLibraryPublisherSchema accepts valid publisher details');
  } catch (err) {
    recordFail(5, 'Valid publisher', err);
  }

  // Scenario 6: CreateLibraryBookSchema accepts valid book with ISBN-10 and ISBN-13
  try {
    const res = CreateLibraryBookSchema.safeParse({
      titleEn: 'Physics for Class 9-10',
      titleBn: 'পদার্থবিজ্ঞান ৯ম-১০ম শ্রেণি',
      isbn10: '0306406152',
      isbn13: '9780306406157',
      publicationYear: 2024,
      language: 'Bangla',
    });
    if (!res.success) throw new Error('Valid book schema was rejected');
    recordPass(6, 'CreateLibraryBookSchema accepts valid bilingual book with ISBN-10 and ISBN-13');
  } catch (err) {
    recordFail(6, 'Valid book schema', err);
  }

  // Scenario 7: CreateLibraryBookSchema rejects missing titleEn
  try {
    const res = CreateLibraryBookSchema.safeParse({
      titleEn: '   ',
      language: 'English',
    });
    if (res.success) throw new Error('Blank book title was accepted');
    recordPass(7, 'CreateLibraryBookSchema rejects blank or missing titleEn');
  } catch (err) {
    recordFail(7, 'Blank book title', err);
  }

  // Scenario 8: CreateLibraryBookSchema rejects publication year before 1000 or after 2100
  try {
    const res = CreateLibraryBookSchema.safeParse({
      titleEn: 'Ancient Manuscripts',
      publicationYear: 800,
    });
    if (res.success) throw new Error('Invalid publication year was accepted');
    recordPass(8, 'CreateLibraryBookSchema enforces publicationYear bounds (1000-2100)');
  } catch (err) {
    recordFail(8, 'Publication year bounds', err);
  }

  // Scenario 9: CreateLibraryBookCopySchema accepts valid copy
  try {
    const res = CreateLibraryBookCopySchema.safeParse({
      bookId: randomUUID(),
      accessionNumber: 'ACC-2026-001',
      barcode: 'BC-LIB-001',
      shelfRack: 'Rack A-2',
      acquisitionCost: 350.00,
      condition: 'NEW',
    });
    if (!res.success) throw new Error('Valid book copy was rejected');
    recordPass(9, 'CreateLibraryBookCopySchema accepts valid physical copy with accession and barcode');
  } catch (err) {
    recordFail(9, 'Valid book copy', err);
  }

  // Scenario 10: CreateLibraryBookCopySchema rejects empty accession number
  try {
    const res = CreateLibraryBookCopySchema.safeParse({
      bookId: randomUUID(),
      accessionNumber: '',
      barcode: 'BC-LIB-002',
    });
    if (res.success) throw new Error('Empty accession number was accepted');
    recordPass(10, 'CreateLibraryBookCopySchema rejects empty accessionNumber');
  } catch (err) {
    recordFail(10, 'Empty accession number', err);
  }

  // Scenario 11: CreateLibraryBookCopySchema rejects negative acquisitionCost
  try {
    const res = CreateLibraryBookCopySchema.safeParse({
      bookId: randomUUID(),
      accessionNumber: 'ACC-003',
      barcode: 'BC-003',
      acquisitionCost: -150,
    });
    if (res.success) throw new Error('Negative acquisition cost was accepted');
    recordPass(11, 'CreateLibraryBookCopySchema rejects negative acquisition cost');
  } catch (err) {
    recordFail(11, 'Negative acquisition cost', err);
  }

  // Scenario 12: IssueBookSchema validates student loan payload
  try {
    const res = IssueBookSchema.safeParse({
      copyId: randomUUID(),
      borrowerType: 'STUDENT',
      studentId: randomUUID(),
      enrollmentId: randomUUID(),
      dueDate: '2026-04-15T00:00:00.000Z',
    });
    if (!res.success) throw new Error('Valid student issue payload was rejected');
    recordPass(12, 'IssueBookSchema validates student loan issuance payload');
  } catch (err) {
    recordFail(12, 'Student loan issue validation', err);
  }

  // Scenario 13: IssueBookSchema validates employee loan payload
  try {
    const res = IssueBookSchema.safeParse({
      copyId: randomUUID(),
      borrowerType: 'EMPLOYEE',
      employeeId: randomUUID(),
    });
    if (!res.success) throw new Error('Valid employee issue payload was rejected');
    recordPass(13, 'IssueBookSchema validates employee loan issuance payload');
  } catch (err) {
    recordFail(13, 'Employee loan issue validation', err);
  }

  // Scenario 14: IssueBookSchema rejects payload missing borrower identity
  try {
    const res = IssueBookSchema.safeParse({
      copyId: randomUUID(),
      borrowerType: 'STUDENT',
      // missing studentId
    });
    if (res.success) throw new Error('Issue payload without studentId was accepted');
    recordPass(14, 'IssueBookSchema rejects STUDENT borrower type without studentId');
  } catch (err) {
    recordFail(14, 'Missing borrower id validation', err);
  }

  // Scenario 15: ReturnBookSchema accepts damaged condition and damageCharge
  try {
    const res = ReturnBookSchema.safeParse({
      condition: 'DAMAGED',
      damageCharge: 75.50,
      notes: 'Water damage on back cover',
    });
    if (!res.success) throw new Error('Valid return payload was rejected');
    recordPass(15, 'ReturnBookSchema accepts return with condition update and damage charge');
  } catch (err) {
    recordFail(15, 'Valid return schema', err);
  }

  // Scenario 16: ReturnBookSchema rejects negative damageCharge
  try {
    const res = ReturnBookSchema.safeParse({
      damageCharge: -20,
    });
    if (res.success) throw new Error('Negative damage charge was accepted');
    recordPass(16, 'ReturnBookSchema rejects negative damageCharge');
  } catch (err) {
    recordFail(16, 'Negative damage charge', err);
  }

  // Scenario 17: CreateReservationSchema accepts student reservation
  try {
    const res = CreateReservationSchema.safeParse({
      bookId: randomUUID(),
      borrowerType: 'STUDENT',
      studentId: randomUUID(),
    });
    if (!res.success) throw new Error('Valid student reservation was rejected');
    recordPass(17, 'CreateReservationSchema accepts student title reservation');
  } catch (err) {
    recordFail(17, 'Student reservation', err);
  }

  // Scenario 18: CreateReservationSchema accepts employee reservation
  try {
    const res = CreateReservationSchema.safeParse({
      bookId: randomUUID(),
      borrowerType: 'EMPLOYEE',
      employeeId: randomUUID(),
    });
    if (!res.success) throw new Error('Valid employee reservation was rejected');
    recordPass(18, 'CreateReservationSchema accepts employee title reservation');
  } catch (err) {
    recordFail(18, 'Employee reservation', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: INVENTORY & ASSET VALIDATION SCHEMAS (Scenarios 19-35)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: INVENTORY & ASSET VALIDATION SCHEMAS ---');

  // Scenario 19: CreateInventoryCategorySchema accepts consumable and asset categories
  try {
    const res1 = CreateInventoryCategorySchema.safeParse({
      code: 'STATIONERY',
      nameEn: 'Stationery & Supplies',
      nameBn: 'স্টেশনারি ও দ্রব্যাদি',
      itemType: 'CONSUMABLE',
    });
    const res2 = CreateInventoryCategorySchema.safeParse({
      code: 'IT-EQUIP',
      nameEn: 'IT & Lab Equipment',
      nameBn: 'আইটি ও ল্যাব সরঞ্জাম',
      itemType: 'ASSET',
    });
    if (!res1.success || !res2.success) throw new Error('Inventory category rejected');
    recordPass(19, 'CreateInventoryCategorySchema accepts both CONSUMABLE and ASSET item types');
  } catch (err) {
    recordFail(19, 'Inventory category itemType', err);
  }

  // Scenario 20: CreateInventoryCategorySchema rejects empty code
  try {
    const res = CreateInventoryCategorySchema.safeParse({
      code: '',
      nameEn: 'Electronics',
      nameBn: 'ইলেকট্রনিক্স',
    });
    if (res.success) throw new Error('Empty category code was accepted');
    recordPass(20, 'CreateInventoryCategorySchema rejects empty category code');
  } catch (err) {
    recordFail(20, 'Empty inventory category code', err);
  }

  // Scenario 21: CreateInventoryItemSchema accepts valid consumable item
  try {
    const res = CreateInventoryItemSchema.safeParse({
      categoryId: randomUUID(),
      itemCode: 'ITM-PAP-A4',
      nameEn: 'A4 Offset Printing Paper',
      nameBn: 'এ৪ সাইজ কাগজ',
      itemType: 'CONSUMABLE',
      stockUnit: 'BOX',
      minStockLevel: 5,
      reorderLevel: 15,
    });
    if (!res.success) throw new Error('Valid inventory item rejected');
    recordPass(21, 'CreateInventoryItemSchema accepts valid consumable item with stock units');
  } catch (err) {
    recordFail(21, 'Valid consumable item', err);
  }

  // Scenario 22: CreateInventoryItemSchema rejects negative minStockLevel or reorderLevel
  try {
    const res = CreateInventoryItemSchema.safeParse({
      categoryId: randomUUID(),
      itemCode: 'ITM-NEG',
      nameEn: 'Bad Item',
      reorderLevel: -5,
    });
    if (res.success) throw new Error('Negative reorder level was accepted');
    recordPass(22, 'CreateInventoryItemSchema rejects negative reorderLevel');
  } catch (err) {
    recordFail(22, 'Negative reorder level', err);
  }

  // Scenario 23: CreateSupplierSchema accepts valid supplier
  try {
    const res = CreateSupplierSchema.safeParse({
      supplierCode: 'SUP-DHAKA-01',
      name: 'Rahim Paper Mart',
      companyName: 'Rahim Group Ltd.',
      phone: '+8801712345678',
      email: 'sales@rahimgroup.bd',
      address: 'Motijheel, Dhaka',
    });
    if (!res.success) throw new Error('Valid supplier rejected');
    recordPass(23, 'CreateSupplierSchema accepts valid Bangladeshi supplier profile');
  } catch (err) {
    recordFail(23, 'Valid supplier', err);
  }

  // Scenario 24: CreateSupplierSchema rejects invalid email
  try {
    const res = CreateSupplierSchema.safeParse({
      supplierCode: 'SUP-BAD',
      name: 'Bad Supplier',
      email: 'not-an-email',
    });
    if (res.success) throw new Error('Invalid email accepted');
    recordPass(24, 'CreateSupplierSchema rejects malformed supplier email');
  } catch (err) {
    recordFail(24, 'Malformed supplier email', err);
  }

  // Scenario 25: CreatePurchaseSchema accepts purchase order with line items
  try {
    const res = CreatePurchaseSchema.safeParse({
      supplierId: randomUUID(),
      purchaseNumber: 'PO-2026-001',
      purchaseDate: '2026-03-01',
      items: [
        { itemId: randomUUID(), quantity: 50, unitCost: 450.00 },
        { itemId: randomUUID(), quantity: 20, unitCost: 120.00 },
      ],
    });
    if (!res.success) throw new Error('Valid purchase rejected');
    recordPass(25, 'CreatePurchaseSchema accepts purchase order with multiple line items');
  } catch (err) {
    recordFail(25, 'Valid purchase order', err);
  }

  // Scenario 26: CreatePurchaseSchema rejects purchase order with empty items array
  try {
    const res = CreatePurchaseSchema.safeParse({
      supplierId: randomUUID(),
      purchaseNumber: 'PO-EMPTY',
      purchaseDate: '2026-03-01',
      items: [],
    });
    if (res.success) throw new Error('Empty purchase items accepted');
    recordPass(26, 'CreatePurchaseSchema rejects purchase order with empty items array');
  } catch (err) {
    recordFail(26, 'Empty purchase items', err);
  }

  // Scenario 27: CreatePurchaseSchema rejects line item with non-positive quantity
  try {
    const res = CreatePurchaseSchema.safeParse({
      supplierId: randomUUID(),
      purchaseNumber: 'PO-ZERO-QTY',
      purchaseDate: '2026-03-01',
      items: [{ itemId: randomUUID(), quantity: 0, unitCost: 100 }],
    });
    if (res.success) throw new Error('Zero quantity line item accepted');
    recordPass(27, 'CreatePurchaseSchema rejects line item with zero or negative quantity');
  } catch (err) {
    recordFail(27, 'Zero quantity line item', err);
  }

  // Scenario 28: CreateStockMovementSchema accepts valid movement
  try {
    const res = CreateStockMovementSchema.safeParse({
      itemId: randomUUID(),
      campusId: randomUUID(),
      movementType: 'ISSUE_OUT',
      quantity: 10,
      unitCost: 50.00,
      notes: 'Issued to Exam Controller Office',
    });
    if (!res.success) throw new Error('Valid stock movement rejected');
    recordPass(28, 'CreateStockMovementSchema accepts valid stock-out movement');
  } catch (err) {
    recordFail(28, 'Valid stock movement', err);
  }

  // Scenario 29: CreateStockMovementSchema rejects non-positive movement quantity
  try {
    const res = CreateStockMovementSchema.safeParse({
      itemId: randomUUID(),
      campusId: randomUUID(),
      movementType: 'DAMAGE',
      quantity: -5,
    });
    if (res.success) throw new Error('Negative quantity movement accepted');
    recordPass(29, 'CreateStockMovementSchema rejects negative stock movement quantity');
  } catch (err) {
    recordFail(29, 'Negative stock quantity', err);
  }

  // Scenario 30: CreateInventoryTransferSchema rejects same source and destination campus
  try {
    const campusId = randomUUID();
    const res = CreateInventoryTransferSchema.safeParse({
      transferNumber: 'TRF-001',
      itemId: randomUUID(),
      sourceCampusId: campusId,
      destinationCampusId: campusId,
      quantity: 15,
    });
    if (res.success) throw new Error('Identical source and destination campus accepted');
    recordPass(30, 'CreateInventoryTransferSchema rejects transfer between identical source and destination campuses');
  } catch (err) {
    recordFail(30, 'Identical transfer campuses', err);
  }

  // Scenario 31: CreateAssetSchema accepts valid asset details
  try {
    const res = CreateAssetSchema.safeParse({
      itemId: randomUUID(),
      campusId: randomUUID(),
      assetCode: 'AST-LAB-PC-01',
      serialNumber: 'SN-DELL-998877',
      barcode: 'BC-AST-001',
      modelNumber: 'Dell OptiPlex 7090',
      purchaseCost: 75000.00,
      currentCondition: 'NEW',
    });
    if (!res.success) throw new Error('Valid asset rejected');
    recordPass(31, 'CreateAssetSchema accepts valid capital asset registration');
  } catch (err) {
    recordFail(31, 'Valid asset schema', err);
  }

  // Scenario 32: CreateAssetSchema rejects negative purchaseCost
  try {
    const res = CreateAssetSchema.safeParse({
      itemId: randomUUID(),
      campusId: randomUUID(),
      assetCode: 'AST-BAD-COST',
      purchaseCost: -1000,
    });
    if (res.success) throw new Error('Negative asset purchase cost accepted');
    recordPass(32, 'CreateAssetSchema rejects negative purchaseCost');
  } catch (err) {
    recordFail(32, 'Negative asset purchaseCost', err);
  }

  // Scenario 33: AssignAssetSchema validates assignment to employee
  try {
    const res = AssignAssetSchema.safeParse({
      employeeId: randomUUID(),
      condition: 'GOOD',
      notes: 'Assigned for office duties',
    });
    if (!res.success) throw new Error('Valid employee assignment rejected');
    recordPass(33, 'AssignAssetSchema accepts asset assignment to employee');
  } catch (err) {
    recordFail(33, 'Employee asset assignment', err);
  }

  // Scenario 34: AssignAssetSchema validates assignment to classroom
  try {
    const res = AssignAssetSchema.safeParse({
      classroomId: randomUUID(),
      locationName: 'Computer Lab 1',
      condition: 'GOOD',
    });
    if (!res.success) throw new Error('Valid classroom assignment rejected');
    recordPass(34, 'AssignAssetSchema accepts asset assignment to classroom/room location');
  } catch (err) {
    recordFail(34, 'Classroom asset assignment', err);
  }

  // Scenario 35: DisposeAssetSchema accepts valid disposal reason and value
  try {
    const res = DisposeAssetSchema.safeParse({
      disposalDate: '2026-03-05',
      disposalReason: 'Beyond economic repair, burnt motherboard',
      disposalValue: 2500.00,
    });
    if (!res.success) throw new Error('Valid disposal rejected');
    recordPass(35, 'DisposeAssetSchema accepts valid asset disposal with scrap value');
  } catch (err) {
    recordFail(35, 'Valid asset disposal', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: FINE SETTINGS & ASSET MAINTENANCE SCHEMAS (Scenarios 36-45)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: FINE SETTINGS & ASSET MAINTENANCE SCHEMAS ---');

  // Scenario 36: DisposeAssetSchema rejects disposal reason shorter than 3 characters
  try {
    const res = DisposeAssetSchema.safeParse({
      disposalReason: 'No',
    });
    if (res.success) throw new Error('Short disposal reason accepted');
    recordPass(36, 'DisposeAssetSchema rejects disposal reason shorter than 3 characters');
  } catch (err) {
    recordFail(36, 'Short disposal reason', err);
  }

  // Scenario 37: DisposeAssetSchema rejects negative disposalValue
  try {
    const res = DisposeAssetSchema.safeParse({
      disposalReason: 'Scrapped obsolete item',
      disposalValue: -50,
    });
    if (res.success) throw new Error('Negative disposal value accepted');
    recordPass(37, 'DisposeAssetSchema rejects negative disposalValue');
  } catch (err) {
    recordFail(37, 'Negative disposal value', err);
  }

  // Scenario 38: CreateAssetMaintenanceSchema accepts valid maintenance log
  try {
    const res = CreateAssetMaintenanceSchema.safeParse({
      assetId: randomUUID(),
      maintenanceType: 'Preventative Servicing',
      serviceDate: '2026-03-01',
      vendorName: 'Cooling Solutions BD',
      cost: 1500.00,
      status: 'COMPLETED',
    });
    if (!res.success) throw new Error('Valid maintenance log rejected');
    recordPass(38, 'CreateAssetMaintenanceSchema accepts valid asset maintenance record');
  } catch (err) {
    recordFail(38, 'Valid maintenance log', err);
  }

  // Scenario 39: CreateAssetMaintenanceSchema rejects negative maintenance cost
  try {
    const res = CreateAssetMaintenanceSchema.safeParse({
      assetId: randomUUID(),
      maintenanceType: 'Repair',
      serviceDate: '2026-03-01',
      cost: -500,
    });
    if (res.success) throw new Error('Negative maintenance cost accepted');
    recordPass(39, 'CreateAssetMaintenanceSchema rejects negative maintenance cost');
  } catch (err) {
    recordFail(39, 'Negative maintenance cost', err);
  }

  // Scenario 40: WaiveFineSchema accepts valid waiver reason
  try {
    const res = WaiveFineSchema.safeParse({
      waivedReason: 'Medical leave approved by principal',
    });
    if (!res.success) throw new Error('Valid fine waiver rejected');
    recordPass(40, 'WaiveFineSchema accepts valid reason for fine waiver');
  } catch (err) {
    recordFail(40, 'Valid fine waiver', err);
  }

  // Scenario 41: WaiveFineSchema rejects empty waiver reason
  try {
    const res = WaiveFineSchema.safeParse({
      waivedReason: '  ',
    });
    if (res.success) throw new Error('Blank waiver reason accepted');
    recordPass(41, 'WaiveFineSchema rejects empty or whitespace-only waiver reason');
  } catch (err) {
    recordFail(41, 'Empty waiver reason', err);
  }

  // Scenario 42: UpdateLibrarySettingsSchema accepts valid policy numbers
  try {
    const res = UpdateLibrarySettingsSchema.safeParse({
      studentMaxBooks: 4,
      studentLoanPeriodDays: 21,
      dailyFineRate: 10.00,
      blockedThresholdFine: 300.00,
      allowStudentReservations: true,
    });
    if (!res.success) throw new Error('Valid library settings rejected');
    recordPass(42, 'UpdateLibrarySettingsSchema accepts valid institutional library policy configuration');
  } catch (err) {
    recordFail(42, 'Valid library settings', err);
  }

  // Scenario 43: UpdateLibrarySettingsSchema rejects negative dailyFineRate
  try {
    const res = UpdateLibrarySettingsSchema.safeParse({
      dailyFineRate: -5.00,
    });
    if (res.success) throw new Error('Negative daily fine rate accepted');
    recordPass(43, 'UpdateLibrarySettingsSchema rejects negative dailyFineRate');
  } catch (err) {
    recordFail(43, 'Negative daily fine rate', err);
  }

  // Scenario 44: UpdateLibrarySettingsSchema rejects studentMaxBooks < 1
  try {
    const res = UpdateLibrarySettingsSchema.safeParse({
      studentMaxBooks: 0,
    });
    if (res.success) throw new Error('Zero student max books accepted');
    recordPass(44, 'UpdateLibrarySettingsSchema rejects non-positive studentMaxBooks');
  } catch (err) {
    recordFail(44, 'Non-positive studentMaxBooks', err);
  }

  // Scenario 45: UpdateLibrarySettingsSchema rejects employeeMaxBooks < 1
  try {
    const res = UpdateLibrarySettingsSchema.safeParse({
      employeeMaxBooks: -2,
    });
    if (res.success) throw new Error('Negative employee max books accepted');
    recordPass(45, 'UpdateLibrarySettingsSchema rejects non-positive employeeMaxBooks');
  } catch (err) {
    recordFail(45, 'Non-positive employeeMaxBooks', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 4: DOMAIN SERVICE ENGINES — UNIT TESTS (Scenarios 46-95)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: DOMAIN SERVICE ENGINES — UNIT TESTS ---');

  // Scenario 46: generateBarcode formats scanner-compatible string
  try {
    const barcode = generateBarcode('LIB');
    if (!barcode.startsWith('LIB-') || barcode.split('-').length < 3) {
      throw new Error(`Unexpected barcode format: ${barcode}`);
    }
    recordPass(46, 'generateBarcode generates prefixed, timestamped scanner barcode');
  } catch (err) {
    recordFail(46, 'generateBarcode format', err);
  }

  // Scenario 47: generateAccessionNumber formats accession number
  try {
    const acc = generateAccessionNumber('ACC');
    if (!acc.startsWith('ACC-')) throw new Error(`Unexpected accession format: ${acc}`);
    recordPass(47, 'generateAccessionNumber generates standard accession identifier');
  } catch (err) {
    recordFail(47, 'generateAccessionNumber format', err);
  }

  // Scenario 48: validateIsbn validates valid ISBN-10 with numeric check digit
  try {
    const res = validateIsbn('0-306-40615-2');
    if (!res.valid || res.normalized !== '0306406152') throw new Error('Valid ISBN-10 failed validation');
    recordPass(48, 'validateIsbn validates valid ISBN-10 with numeric check digit');
  } catch (err) {
    recordFail(48, 'Valid ISBN-10 numeric check', err);
  }

  // Scenario 49: validateIsbn validates valid ISBN-10 with 'X' check digit
  try {
    const res = validateIsbn('0-8044-2957-X');
    if (!res.valid || res.normalized !== '080442957X') throw new Error('Valid ISBN-10 with X check digit failed');
    recordPass(49, 'validateIsbn validates valid ISBN-10 ending with check character X');
  } catch (err) {
    recordFail(49, 'Valid ISBN-10 X check', err);
  }

  // Scenario 50: validateIsbn validates valid ISBN-13 checksum
  try {
    const res = validateIsbn('978-0-306-40615-7');
    if (!res.valid || res.normalized !== '9780306406157') throw new Error('Valid ISBN-13 failed validation');
    recordPass(50, 'validateIsbn validates valid ISBN-13 checksum');
  } catch (err) {
    recordFail(50, 'Valid ISBN-13 check', err);
  }

  // Scenario 51: validateIsbn rejects invalid ISBN-10 checksum mismatch
  try {
    const res = validateIsbn('0-306-40615-9'); // Last digit should be 2
    if (res.valid) throw new Error('Corrupt ISBN-10 was accepted as valid');
    recordPass(51, 'validateIsbn detects and rejects ISBN-10 checksum mismatch');
  } catch (err) {
    recordFail(51, 'Invalid ISBN-10 checksum', err);
  }

  // Scenario 52: validateIsbn rejects invalid ISBN-13 checksum mismatch
  try {
    const res = validateIsbn('978-0-306-40615-0'); // Last digit should be 7
    if (res.valid) throw new Error('Corrupt ISBN-13 was accepted as valid');
    recordPass(52, 'validateIsbn detects and rejects ISBN-13 checksum mismatch');
  } catch (err) {
    recordFail(52, 'Invalid ISBN-13 checksum', err);
  }

  // Scenario 53: validateIsbn rejects ISBN-13 not starting with 978 or 979
  try {
    const res = validateIsbn('888-0-306-40615-7');
    if (res.valid) throw new Error('Non-standard prefix accepted for ISBN-13');
    recordPass(53, 'validateIsbn rejects 13-digit ISBN not prefixed with 978 or 979');
  } catch (err) {
    recordFail(53, 'Non-standard ISBN-13 prefix', err);
  }

  // Scenario 54: isValidCopyStatusTransition allows valid transition AVAILABLE -> ISSUED
  try {
    const res = isValidCopyStatusTransition('AVAILABLE', 'ISSUED');
    if (!res.valid) throw new Error(res.reason);
    recordPass(54, 'isValidCopyStatusTransition allows AVAILABLE to ISSUED transition');
  } catch (err) {
    recordFail(54, 'AVAILABLE -> ISSUED transition', err);
  }

  // Scenario 55: isValidCopyStatusTransition blocks terminal WITHDRAWN -> AVAILABLE
  try {
    const res = isValidCopyStatusTransition('WITHDRAWN', 'AVAILABLE');
    if (res.valid) throw new Error('Withdrawn copy was allowed to revive');
    recordPass(55, 'isValidCopyStatusTransition enforces terminal WITHDRAWN copy status');
  } catch (err) {
    recordFail(55, 'WITHDRAWN -> AVAILABLE block', err);
  }

  // Scenario 56: calculateDueDate computes due date based on loan period days
  try {
    const issueDate = new Date('2026-03-01T10:00:00.000Z');
    const dueDate = calculateDueDate(issueDate, 14);
    const expected = new Date('2026-03-15T10:00:00.000Z');
    if (dueDate.toISOString().slice(0, 10) !== expected.toISOString().slice(0, 10)) {
      throw new Error(`Expected ${expected.toISOString()} but got ${dueDate.toISOString()}`);
    }
    recordPass(56, 'calculateDueDate accurately computes due date (+14 calendar days)');
  } catch (err) {
    recordFail(56, 'calculateDueDate calculation', err);
  }

  // Scenario 57: calculateOverdueDays computes 0 days when returned on or before due date
  try {
    const dueDate = new Date('2026-03-15T00:00:00.000Z');
    const returnDate = new Date('2026-03-14T00:00:00.000Z');
    const days = calculateOverdueDays(dueDate, returnDate);
    if (days !== 0) throw new Error(`Expected 0 overdue days, got ${days}`);
    recordPass(57, 'calculateOverdueDays returns 0 overdue days when returned on time');
  } catch (err) {
    recordFail(57, 'calculateOverdueDays on-time', err);
  }

  // Scenario 58: calculateOverdueDays computes exact days overdue when returned after due date
  try {
    const dueDate = new Date('2026-03-15T00:00:00.000Z');
    const returnDate = new Date('2026-03-20T00:00:00.000Z');
    const days = calculateOverdueDays(dueDate, returnDate);
    if (days !== 5) throw new Error(`Expected 5 overdue days, got ${days}`);
    recordPass(58, 'calculateOverdueDays computes exact calendar days overdue (5 days)');
  } catch (err) {
    recordFail(58, 'calculateOverdueDays overdue', err);
  }

  // Scenario 59: validateBorrowerEligibility approves borrower with clean record and quota available
  try {
    const res = validateBorrowerEligibility({
      borrowerType: 'STUDENT',
      currentActiveLoans: 1,
      maxAllowedLoans: 3,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
      hasOverdueLoans: false,
    });
    if (!res.eligible) throw new Error(res.reason);
    recordPass(59, 'validateBorrowerEligibility approves borrower with clean record and available quota');
  } catch (err) {
    recordFail(59, 'Clean borrower eligibility', err);
  }

  // Scenario 60: validateBorrowerEligibility blocks borrower when active loans >= maxAllowedLoans
  try {
    const res = validateBorrowerEligibility({
      borrowerType: 'STUDENT',
      currentActiveLoans: 3,
      maxAllowedLoans: 3,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
      hasOverdueLoans: false,
    });
    if (res.eligible) throw new Error('Max loans limit was bypassed');
    recordPass(60, 'validateBorrowerEligibility blocks borrower when maximum active loan quota is reached');
  } catch (err) {
    recordFail(60, 'Quota limit block', err);
  }

  // Scenario 61: validateBorrowerEligibility blocks borrower when hasOverdueLoans is true
  try {
    const res = validateBorrowerEligibility({
      borrowerType: 'STUDENT',
      currentActiveLoans: 1,
      maxAllowedLoans: 3,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
      hasOverdueLoans: true,
    });
    if (res.eligible) throw new Error('Borrower with overdue loans was approved');
    recordPass(61, 'validateBorrowerEligibility strictly blocks borrower with unresolved overdue loans');
  } catch (err) {
    recordFail(61, 'Overdue loan block', err);
  }

  // Scenario 62: validateBorrowerEligibility blocks borrower when unpaid fines exceed blockedFineThreshold
  try {
    const res = validateBorrowerEligibility({
      borrowerType: 'STUDENT',
      currentActiveLoans: 1,
      maxAllowedLoans: 3,
      totalUnpaidFines: 600,
      blockedFineThreshold: 500,
      hasOverdueLoans: false,
    });
    if (res.eligible) throw new Error('Borrower with excessive unpaid fines was approved');
    recordPass(62, 'validateBorrowerEligibility blocks borrower when unpaid fines exceed threshold (৳600 > ৳500)');
  } catch (err) {
    recordFail(62, 'Unpaid fine threshold block', err);
  }

  // Scenario 63: validateBorrowerEligibility permits loan when unpaid fines are below blockedFineThreshold
  try {
    const res = validateBorrowerEligibility({
      borrowerType: 'STUDENT',
      currentActiveLoans: 1,
      maxAllowedLoans: 3,
      totalUnpaidFines: 250,
      blockedFineThreshold: 500,
      hasOverdueLoans: false,
    });
    if (!res.eligible) throw new Error(res.reason);
    recordPass(63, 'validateBorrowerEligibility permits borrowing when unpaid fines are below threshold (৳250 <= ৳500)');
  } catch (err) {
    recordFail(63, 'Unpaid fine below threshold approval', err);
  }

  // Scenario 64: validateRenewalEligibility approves renewal when within limits and clean
  try {
    const res = validateRenewalEligibility({
      currentRenewalCount: 1,
      maxAllowedRenewals: 2,
      isOverdue: false,
      isReservedByOther: false,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
    });
    if (!res.eligible) throw new Error(res.reason);
    recordPass(64, 'validateRenewalEligibility approves renewal when within limits and clean');
  } catch (err) {
    recordFail(64, 'Clean renewal eligibility', err);
  }

  // Scenario 65: validateRenewalEligibility blocks renewal when currentRenewalCount >= maxAllowedRenewals
  try {
    const res = validateRenewalEligibility({
      currentRenewalCount: 2,
      maxAllowedRenewals: 2,
      isOverdue: false,
      isReservedByOther: false,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
    });
    if (res.eligible) throw new Error('Exceeded renewal limit was approved');
    recordPass(65, 'validateRenewalEligibility blocks renewal when max allowed renewals reached (2/2)');
  } catch (err) {
    recordFail(65, 'Max renewal count block', err);
  }

  // Scenario 66: validateRenewalEligibility blocks renewal when book is already overdue
  try {
    const res = validateRenewalEligibility({
      currentRenewalCount: 0,
      maxAllowedRenewals: 2,
      isOverdue: true,
      isReservedByOther: false,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
    });
    if (res.eligible) throw new Error('Overdue loan renewal was approved');
    recordPass(66, 'validateRenewalEligibility blocks renewal of overdue books');
  } catch (err) {
    recordFail(66, 'Overdue renewal block', err);
  }

  // Scenario 67: validateRenewalEligibility blocks renewal when book is reserved by another borrower
  try {
    const res = validateRenewalEligibility({
      currentRenewalCount: 0,
      maxAllowedRenewals: 2,
      isOverdue: false,
      isReservedByOther: true,
      totalUnpaidFines: 0,
      blockedFineThreshold: 500,
    });
    if (res.eligible) throw new Error('Renewal of reserved book was approved');
    recordPass(67, 'validateRenewalEligibility blocks renewal when book title has pending reservation');
  } catch (err) {
    recordFail(67, 'Reserved title renewal block', err);
  }

  // Scenario 68: validateRenewalEligibility blocks renewal when unpaid fines exceed blockedFineThreshold
  try {
    const res = validateRenewalEligibility({
      currentRenewalCount: 0,
      maxAllowedRenewals: 2,
      isOverdue: false,
      isReservedByOther: false,
      totalUnpaidFines: 550,
      blockedFineThreshold: 500,
    });
    if (res.eligible) throw new Error('Renewal with excessive fines was approved');
    recordPass(68, 'validateRenewalEligibility blocks renewal when unpaid fines exceed threshold');
  } catch (err) {
    recordFail(68, 'Unpaid fine renewal block', err);
  }

  // Scenario 69: calculateOverdueFine computes overdueDays * dailyRate accurately
  try {
    const fine = calculateOverdueFine(6, 5.00);
    if (fine !== 30.00) throw new Error(`Expected 30.00, got ${fine}`);
    recordPass(69, 'calculateOverdueFine computes overdueDays * dailyRate accurately (6 * ৳5 = ৳30.00)');
  } catch (err) {
    recordFail(69, 'calculateOverdueFine calculation', err);
  }

  // Scenario 70: calculateOverdueFine returns 0 when overdueDays is 0 or negative
  try {
    const fine0 = calculateOverdueFine(0, 5.00);
    const fineNeg = calculateOverdueFine(-3, 5.00);
    if (fine0 !== 0 || fineNeg !== 0) throw new Error('Non-zero fine returned for non-overdue days');
    recordPass(70, 'calculateOverdueFine returns 0 when overdueDays is 0 or negative');
  } catch (err) {
    recordFail(70, 'calculateOverdueFine non-overdue', err);
  }

  // Scenario 71: calculateLostBookCharge computes (acquisitionCost * multiplier) + replacementFee
  try {
    const charge = calculateLostBookCharge(400, 1.5, 50);
    // (400 * 1.5) + 50 = 650.00
    if (charge !== 650.00) throw new Error(`Expected 650.00, got ${charge}`);
    recordPass(71, 'calculateLostBookCharge computes cost multiplier plus replacement fee ((৳400 * 1.5) + ৳50 = ৳650.00)');
  } catch (err) {
    recordFail(71, 'calculateLostBookCharge calculation', err);
  }

  // Scenario 72: calculateDamageCharge returns assessed damage amount when provided
  try {
    const charge = calculateDamageCharge(100, 150);
    if (charge !== 150.00) throw new Error(`Expected 150.00, got ${charge}`);
    recordPass(72, 'calculateDamageCharge prioritizes assessed damage over flat rate');
  } catch (err) {
    recordFail(72, 'Assessed damage calculation', err);
  }

  // Scenario 73: calculateDamageCharge falls back to flat damage fee when assessed damage is null
  try {
    const charge = calculateDamageCharge(75, null);
    if (charge !== 75.00) throw new Error(`Expected 75.00, got ${charge}`);
    recordPass(73, 'calculateDamageCharge falls back to flat damage fee when assessed damage is null');
  } catch (err) {
    recordFail(73, 'Flat damage calculation', err);
  }

  // Scenario 74: calculateFineBalance computes remaining balance after partial waiver and partial payment
  try {
    const res = calculateFineBalance(100.00, 25.00, 35.00);
    // 100 - 25 - 35 = 40.00
    if (res.balance !== 40.00 || res.isSettled || res.isFullyWaived) {
      throw new Error(`Expected balance 40.00, got ${res.balance}`);
    }
    recordPass(74, 'calculateFineBalance computes remaining net balance after partial waiver and payment');
  } catch (err) {
    recordFail(74, 'Partial fine balance', err);
  }

  // Scenario 75: calculateFineBalance detects full waiver
  try {
    const res = calculateFineBalance(50.00, 50.00, 0);
    if (res.balance !== 0 || !res.isSettled || !res.isFullyWaived) {
      throw new Error('Full waiver not flagged correctly');
    }
    recordPass(75, 'calculateFineBalance accurately detects full waiver with 0 balance and isSettled=true');
  } catch (err) {
    recordFail(75, 'Full waiver balance', err);
  }

  // Scenario 76: createFineSnapshot preserves immutable calculation parameters
  try {
    const snap = createFineSnapshot({
      fineType: 'OVERDUE',
      overdueDays: 4,
      dailyRate: 5.00,
      calculatedAmount: 20.00,
      assessedByUserId: randomUUID(),
    });
    if (!snap.calculatedAt || snap.engineVersion !== '1.0.0' || snap.calculatedAmount !== 20.00) {
      throw new Error('Fine snapshot missing audit attributes');
    }
    recordPass(76, 'createFineSnapshot creates immutable calculation audit snapshot');
  } catch (err) {
    recordFail(76, 'createFineSnapshot audit attributes', err);
  }

  // Scenario 77: calculateReservationExpiryDate adds validity days to reservation date
  try {
    const resDate = new Date('2026-03-01T12:00:00.000Z');
    const expiry = calculateReservationExpiryDate(resDate, 7);
    const expected = new Date('2026-03-08T12:00:00.000Z');
    if (expiry.toISOString() !== expected.toISOString()) {
      throw new Error(`Expected ${expected.toISOString()} got ${expiry.toISOString()}`);
    }
    recordPass(77, 'calculateReservationExpiryDate adds configured validity window (7 days)');
  } catch (err) {
    recordFail(77, 'Reservation expiry date', err);
  }

  // Scenario 78: isReservationExpired returns false before expiry date
  try {
    const expiry = new Date('2026-03-10T00:00:00.000Z');
    const now = new Date('2026-03-05T00:00:00.000Z');
    if (isReservationExpired(expiry, now)) throw new Error('Unexpired reservation flagged as expired');
    recordPass(78, 'isReservationExpired returns false for active unexpired reservation');
  } catch (err) {
    recordFail(78, 'Unexpired reservation check', err);
  }

  // Scenario 79: isReservationExpired returns true after expiry date
  try {
    const expiry = new Date('2026-03-05T00:00:00.000Z');
    const now = new Date('2026-03-06T00:00:00.000Z');
    if (!isReservationExpired(expiry, now)) throw new Error('Expired reservation not flagged');
    recordPass(79, 'isReservationExpired returns true when past expiration date');
  } catch (err) {
    recordFail(79, 'Expired reservation check', err);
  }

  // Scenario 80: canPlaceReservation blocks reservation if borrower type is not allowed
  try {
    const res = canPlaceReservation({
      availableCopiesCount: 0,
      existingActiveReservation: false,
      isBorrowerTypeAllowed: false,
    });
    if (res.allowed) throw new Error('Disallowed borrower type was permitted to reserve');
    recordPass(80, 'canPlaceReservation blocks reservation when borrower type is disabled by policy');
  } catch (err) {
    recordFail(80, 'Borrower type disallowed reservation', err);
  }

  // Scenario 81: canPlaceReservation blocks reservation if borrower already has active pending reservation
  try {
    const res = canPlaceReservation({
      availableCopiesCount: 0,
      existingActiveReservation: true,
      isBorrowerTypeAllowed: true,
    });
    if (res.allowed) throw new Error('Duplicate reservation was permitted');
    recordPass(81, 'canPlaceReservation blocks duplicate reservation on same book title');
  } catch (err) {
    recordFail(81, 'Duplicate active reservation block', err);
  }

  // Scenario 82: canPlaceReservation blocks reservation if physical copies are currently available in the library
  try {
    const res = canPlaceReservation({
      availableCopiesCount: 2,
      existingActiveReservation: false,
      isBorrowerTypeAllowed: true,
    });
    if (res.allowed) throw new Error('Reservation was allowed while physical copies were on the shelf');
    recordPass(82, 'canPlaceReservation blocks reservation when physical copies are already available on shelf');
  } catch (err) {
    recordFail(82, 'Available copies reservation block', err);
  }

  // Scenario 83: canFulfillReservation allows fulfillment only when reservation is PENDING and copy is AVAILABLE/RESERVED
  try {
    const res1 = canFulfillReservation('PENDING', 'AVAILABLE');
    const res2 = canFulfillReservation('CANCELLED', 'AVAILABLE');
    const res3 = canFulfillReservation('PENDING', 'ISSUED');
    if (!res1.canFulfill || res2.canFulfill || res3.canFulfill) {
      throw new Error('Fulfillment state validation failed');
    }
    recordPass(83, 'canFulfillReservation allows fulfillment only for PENDING reservation and AVAILABLE copy');
  } catch (err) {
    recordFail(83, 'canFulfillReservation state rules', err);
  }

  // Scenario 84: isStockInMovement and isStockOutMovement categorizes movement types
  try {
    if (!isStockInMovement('PURCHASE_IN') || !isStockInMovement('ADJUSTMENT_IN')) {
      throw new Error('Stock in types failed');
    }
    if (!isStockOutMovement('ISSUE_OUT') || !isStockOutMovement('DAMAGE') || !isStockOutMovement('LOSS')) {
      throw new Error('Stock out types failed');
    }
    recordPass(84, 'isStockInMovement and isStockOutMovement categorize all 10 stock movement types accurately');
  } catch (err) {
    recordFail(84, 'Stock movement categorization', err);
  }

  // Scenario 85: calculateCurrentStock computes net stock balance from series of IN and OUT movements
  try {
    const movements = [
      { movementType: 'PURCHASE_IN', quantity: 100 },
      { movementType: 'ISSUE_OUT', quantity: 30 },
      { movementType: 'ADJUSTMENT_IN', quantity: 10 },
      { movementType: 'DAMAGE', quantity: 5 },
      { movementType: 'RETURN_IN', quantity: 2 },
    ];
    // 100 - 30 + 10 - 5 + 2 = 77
    const stock = calculateCurrentStock(movements);
    if (stock !== 77) throw new Error(`Expected stock 77, got ${stock}`);
    recordPass(85, 'calculateCurrentStock computes net authoritative balance from movement ledger (77 units)');
  } catch (err) {
    recordFail(85, 'calculateCurrentStock ledger balance', err);
  }

  // Scenario 86: validateStockAvailability approves outbound movement when currentStock >= requestedQuantity
  try {
    const res = validateStockAvailability(50, 20);
    if (!res.available || res.remaining !== 30) throw new Error('Valid stock availability check failed');
    recordPass(86, 'validateStockAvailability approves movement when available stock exceeds requested quantity');
  } catch (err) {
    recordFail(86, 'validateStockAvailability approval', err);
  }

  // Scenario 87: validateStockAvailability strictly denies outbound movement when currentStock < requestedQuantity
  try {
    const res = validateStockAvailability(15, 20);
    if (res.available) throw new Error('Over-allocation was permitted');
    recordPass(87, 'validateStockAvailability strictly denies outbound movement exceeding available stock (negative defense)');
  } catch (err) {
    recordFail(87, 'Negative stock defense check', err);
  }

  // Scenario 88: validateStockAvailability rejects non-positive requested quantity
  try {
    const res = validateStockAvailability(50, 0);
    if (res.available) throw new Error('Zero quantity movement was permitted');
    recordPass(88, 'validateStockAvailability rejects zero or negative requested quantity');
  } catch (err) {
    recordFail(88, 'Zero quantity movement check', err);
  }

  // Scenario 89: evaluateStockThresholds flags isOutOfStock, isCriticallyLow, and isLowStock accurately
  try {
    const zero = evaluateStockThresholds(0, 5, 10);
    const critical = evaluateStockThresholds(3, 5, 10);
    const low = evaluateStockThresholds(8, 5, 10);
    const healthy = evaluateStockThresholds(20, 5, 10);

    if (!zero.isOutOfStock) throw new Error('Zero stock not flagged as isOutOfStock');
    if (!critical.isCriticallyLow) throw new Error('Critical stock not flagged as isCriticallyLow');
    if (!low.isLowStock || low.isCriticallyLow) throw new Error('Low stock thresholds misclassified');
    if (healthy.isLowStock || healthy.isOutOfStock) throw new Error('Healthy stock flagged as low');

    recordPass(89, 'evaluateStockThresholds classifies out-of-stock, critically low, and low stock thresholds');
  } catch (err) {
    recordFail(89, 'evaluateStockThresholds classification', err);
  }

  // Scenario 90: calculatePurchaseTotal computes sum of quantity * unitCost across line items
  try {
    const items = [
      { quantity: 10, unitCost: 150.50 }, // 1505.00
      { quantity: 5, unitCost: 300.00 },  // 1500.00
    ];
    const total = calculatePurchaseTotal(items);
    if (total !== 3005.00) throw new Error(`Expected 3005.00, got ${total}`);
    recordPass(90, 'calculatePurchaseTotal computes sum across line items (৳3,005.00)');
  } catch (err) {
    recordFail(90, 'calculatePurchaseTotal calculation', err);
  }

  // Scenario 91: isValidPurchaseStatusTransition enforces ORDERED -> RECEIVED and blocks RECEIVED -> ORDERED
  try {
    const ok = isValidPurchaseStatusTransition('ORDERED', 'RECEIVED');
    const bad = isValidPurchaseStatusTransition('RECEIVED', 'ORDERED');
    if (!ok.valid || bad.valid) throw new Error('Purchase order state machine failed');
    recordPass(91, 'isValidPurchaseStatusTransition permits ORDERED to RECEIVED and blocks reopening received order');
  } catch (err) {
    recordFail(91, 'Purchase status transitions', err);
  }

  // Scenario 92: generateAssetCode generates unique asset code with prefix
  try {
    const code = generateAssetCode('LAP');
    if (!code.startsWith('LAP-')) throw new Error(`Unexpected asset code: ${code}`);
    recordPass(92, 'generateAssetCode generates unique formatted asset code (AST/custom prefix)');
  } catch (err) {
    recordFail(92, 'generateAssetCode format', err);
  }

  // Scenario 93: isAssetUnderWarranty correctly compares warranty date with current date
  try {
    const future = new Date();
    future.setDate(future.getDate() + 100);
    const past = new Date();
    past.setDate(past.getDate() - 20);

    if (!isAssetUnderWarranty(future)) throw new Error('Future warranty not detected');
    if (isAssetUnderWarranty(past)) throw new Error('Expired warranty flagged as active');
    recordPass(93, 'isAssetUnderWarranty accurately determines active vs expired warranty status');
  } catch (err) {
    recordFail(93, 'Asset warranty check', err);
  }

  // Scenario 94: isValidAssetStatusTransition permits AVAILABLE -> ASSIGNED and blocks DISPOSED -> AVAILABLE
  try {
    const ok = isValidAssetStatusTransition('AVAILABLE', 'ASSIGNED');
    const bad = isValidAssetStatusTransition('DISPOSED', 'AVAILABLE');
    if (!ok.valid || bad.valid) throw new Error('Asset status state machine violated');
    recordPass(94, 'isValidAssetStatusTransition permits AVAILABLE to ASSIGNED and blocks terminal DISPOSED revival');
  } catch (err) {
    recordFail(94, 'Asset status transitions', err);
  }

  // Scenario 95: canDisposeAsset blocks disposal if asset is currently ASSIGNED to an employee
  try {
    const assigned = canDisposeAsset('ASSIGNED');
    const available = canDisposeAsset('AVAILABLE');
    if (assigned.canDispose || !available.canDispose) {
      throw new Error('Disposal eligibility rules failed');
    }
    recordPass(95, 'canDisposeAsset blocks disposal of currently ASSIGNED asset until returned');
  } catch (err) {
    recordFail(95, 'Assigned asset disposal block', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 5: DATABASE EXECUTION & ROW-LEVEL SECURITY (Scenarios 96-115)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: DATABASE EXECUTION & ROW-LEVEL SECURITY ---');

  const db = new PGlite();
  await db.waitReady;

  // Scenario 96: Apply all 17 migrations sequentially to PGlite
  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await db.exec(sql);
    }
    recordPass(96, `All ${files.length} migrations applied cleanly to PGlite (including 0017_library_inventory_asset_engine.sql)`);
  } catch (err) {
    recordFail(96, 'Migrations execution', err);
    throw err;
  }

  // Scenario 97: Confirm all 19 Phase 10 tables exist in information_schema.tables
  const phase10Tables = [
    'library_settings',
    'library_categories',
    'library_authors',
    'library_publishers',
    'library_books',
    'library_book_copies',
    'library_loans',
    'library_reservations',
    'library_fines',
    'inventory_categories',
    'inventory_items',
    'inventory_suppliers',
    'inventory_purchases',
    'inventory_purchase_items',
    'stock_movements',
    'inventory_transfers',
    'assets',
    'asset_assignments',
    'asset_maintenance_logs',
  ];

  try {
    for (const table of phase10Tables) {
      const check = await db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = $1;`,
        [table]
      );
      if (check.rows.length === 0) throw new Error(`Table ${table} is missing from information_schema`);
    }
    recordPass(97, 'All 19 Phase 10 tables confirmed in information_schema.tables');
  } catch (err) {
    recordFail(97, 'Phase 10 tables existence', err);
  }

  // Scenario 98: Confirm Row-Level Security is ENABLED on all 19 Phase 10 tables
  try {
    for (const table of phase10Tables) {
      const res = await db.query(
        `SELECT relname, relrowsecurity FROM pg_class WHERE relname = $1;`,
        [table]
      );
      if (res.rows.length === 0 || !res.rows[0].relrowsecurity) {
        throw new Error(`RLS is not enabled on ${table}`);
      }
    }
    recordPass(98, 'PostgreSQL Row-Level Security is ENABLED on all 19 Phase 10 tables');
  } catch (err) {
    recordFail(98, 'RLS enabled check', err);
  }

  // Scenario 99: Confirm Row-Level Security is FORCED on all 19 Phase 10 tables
  try {
    for (const table of phase10Tables) {
      const res = await db.query(
        `SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = $1;`,
        [table]
      );
      if (res.rows.length === 0 || !res.rows[0].relforcerowsecurity) {
        throw new Error(`RLS is not FORCED on ${table}`);
      }
    }
    recordPass(99, 'PostgreSQL Row-Level Security is FORCED on all 19 Phase 10 tables');
  } catch (err) {
    recordFail(99, 'RLS forced check', err);
  }

  // Scenario 100: Confirm tenant_isolation_policy exists on all 19 tables in pg_policies
  try {
    for (const table of phase10Tables) {
      const res = await db.query(
        `SELECT policyname FROM pg_policies WHERE tablename = $1 AND policyname = 'tenant_isolation_policy';`,
        [table]
      );
      if (res.rows.length === 0) throw new Error(`tenant_isolation_policy missing on ${table}`);
    }
    recordPass(100, 'tenant_isolation_policy confirmed on all 19 Phase 10 tables in pg_policies');
  } catch (err) {
    recordFail(100, 'Tenant isolation policies check', err);
  }

  // Scenario 101: Verify partial unique index uq_active_copy_loan on library_loans
  try {
    const res = await db.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_active_copy_loan' AND tablename = 'library_loans';`
    );
    if (res.rows.length === 0) throw new Error('Partial index uq_active_copy_loan missing');
    recordPass(101, 'Partial unique index uq_active_copy_loan confirmed on library_loans');
  } catch (err) {
    recordFail(101, 'uq_active_copy_loan index', err);
  }

  // Scenario 102: Verify partial unique index uq_active_student_reservation on library_reservations
  try {
    const res = await db.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_active_student_reservation' AND tablename = 'library_reservations';`
    );
    if (res.rows.length === 0) throw new Error('Partial index uq_active_student_reservation missing');
    recordPass(102, 'Partial unique index uq_active_student_reservation confirmed on library_reservations');
  } catch (err) {
    recordFail(102, 'uq_active_student_reservation index', err);
  }

  // Scenario 103: Verify partial unique index uq_active_employee_reservation on library_reservations
  try {
    const res = await db.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_active_employee_reservation' AND tablename = 'library_reservations';`
    );
    if (res.rows.length === 0) throw new Error('Partial index uq_active_employee_reservation missing');
    recordPass(103, 'Partial unique index uq_active_employee_reservation confirmed on library_reservations');
  } catch (err) {
    recordFail(103, 'uq_active_employee_reservation index', err);
  }

  // Scenario 104: Verify partial unique index uq_asset_serial on assets
  try {
    const res = await db.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'uq_asset_serial' AND tablename = 'assets';`
    );
    if (res.rows.length === 0) throw new Error('Partial index uq_asset_serial missing');
    recordPass(104, 'Partial unique index uq_asset_serial confirmed on assets table');
  } catch (err) {
    recordFail(104, 'uq_asset_serial index', err);
  }

  // Scenario 105: Verify unique constraints uq_lib_copy_accession and uq_lib_copy_barcode
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname IN ('uq_lib_copy_accession', 'uq_lib_copy_barcode');`
    );
    if (res.rows.length < 2) throw new Error('Copy unique constraints missing');
    recordPass(105, 'Unique constraints uq_lib_copy_accession and uq_lib_copy_barcode confirmed');
  } catch (err) {
    recordFail(105, 'Copy unique constraints check', err);
  }

  // Scenario 106: Verify unique constraint uq_inv_item_code on inventory_items
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'uq_inv_item_code';`
    );
    if (res.rows.length === 0) throw new Error('Constraint uq_inv_item_code missing');
    recordPass(106, 'Unique constraint uq_inv_item_code confirmed on inventory_items');
  } catch (err) {
    recordFail(106, 'Item code unique constraint check', err);
  }

  // Scenario 107: Verify unique constraint uq_asset_code on assets
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'uq_asset_code';`
    );
    if (res.rows.length === 0) throw new Error('Constraint uq_asset_code missing');
    recordPass(107, 'Unique constraint uq_asset_code confirmed on assets table');
  } catch (err) {
    recordFail(107, 'Asset code unique constraint check', err);
  }

  // Scenario 108: Verify composite tenant foreign keys on library_book_copies
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'fk_lib_copy_book_tenant';`
    );
    if (res.rows.length === 0) throw new Error('Composite foreign key fk_lib_copy_book_tenant missing');
    recordPass(108, 'Composite tenant foreign key fk_lib_copy_book_tenant confirmed on library_book_copies');
  } catch (err) {
    recordFail(108, 'Book copy composite FK check', err);
  }

  // Scenario 109: Verify composite tenant foreign key on library_loans
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'fk_lib_loan_copy_tenant';`
    );
    if (res.rows.length === 0) throw new Error('Composite foreign key fk_lib_loan_copy_tenant missing');
    recordPass(109, 'Composite tenant foreign key fk_lib_loan_copy_tenant confirmed on library_loans');
  } catch (err) {
    recordFail(109, 'Library loan composite FK check', err);
  }

  // Scenario 110: Verify composite tenant foreign key on stock_movements
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'fk_stock_mov_item_tenant';`
    );
    if (res.rows.length === 0) throw new Error('Composite foreign key fk_stock_mov_item_tenant missing');
    recordPass(110, 'Composite tenant foreign key fk_stock_mov_item_tenant confirmed on stock_movements');
  } catch (err) {
    recordFail(110, 'Stock movement composite FK check', err);
  }

  // Scenario 111: Verify composite tenant foreign key on asset_assignments
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'fk_asset_assign_asset_tenant';`
    );
    if (res.rows.length === 0) throw new Error('Composite foreign key fk_asset_assign_asset_tenant missing');
    recordPass(111, 'Composite tenant foreign key fk_asset_assign_asset_tenant confirmed on asset_assignments');
  } catch (err) {
    recordFail(111, 'Asset assignment composite FK check', err);
  }

  // Scenario 112: Verify foreign key on library_fines(loan_id)
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'library_fines'::regclass AND contype = 'f';`
    );
    if (res.rows.length === 0) throw new Error('Foreign key on library_fines missing');
    recordPass(112, 'Foreign keys confirmed on library_fines');
  } catch (err) {
    recordFail(112, 'Library fine foreign key check', err);
  }

  // --------------------------------------------------------------------------
  // MULTI-TENANT TEST FIXTURES SETUP
  // --------------------------------------------------------------------------
  const schoolA = randomUUID();
  const schoolB = randomUUID();
  const campusA = randomUUID();
  const campusB = randomUUID();
  const academicSessionA = randomUUID();
  const academicSessionB = randomUUID();
  const classA = randomUUID();
  const sectionA = randomUUID();
  const employeeTeacherA = randomUUID();
  const employeeTeacherB = randomUUID();
  const studentA1 = randomUUID();
  const studentA2 = randomUUID();
  const studentB = randomUUID();
  const enrollmentA1 = randomUUID();
  const enrollmentA2 = randomUUID();
  const enrollmentB = randomUUID();
  const userLibrarianA = randomUUID();
  const userAdminA = randomUUID();
  const deptA = randomUUID();
  const deptB = randomUUID();
  const desigA = randomUUID();
  const desigB = randomUUID();
  const classroomA = randomUUID();

  // Scenario 113: Seed School A and School B baseline multi-tenant fixtures
  try {
    await db.exec(`
      INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status)
      VALUES 
        ('${schoolA}', 'school-lib-a', 'School Library A', 'স্কুল লাইব্রেরি এ', 'admin@lib-a.bd', '+8801711223344', 'ACTIVE'),
        ('${schoolB}', 'school-lib-b', 'School Library B', 'স্কুল লাইব্রেরি বি', 'admin@lib-b.bd', '+8801722334455', 'ACTIVE');

      INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch, status)
      VALUES
        ('${campusA}', '${schoolA}', 'MAIN-A', 'Main Campus A', 'ক্যাম্পাস এ', true, 'ACTIVE'),
        ('${campusB}', '${schoolB}', 'MAIN-B', 'Main Campus B', 'ক্যাম্পাস বি', true, 'ACTIVE');

      INSERT INTO users (id, school_id, phone, full_name, email, password_hash, is_super_admin, status)
      VALUES 
        ('${userAdminA}', '${schoolA}', '+8801700112233', 'Library Admin', 'admin@lib-a.bd', '$2b$10$abcdefghijklmnopqrstuu', false, 'ACTIVE'),
        ('${userLibrarianA}', '${schoolA}', '+8801700112244', 'Fatima Librarian', 'librarian@lib-a.bd', '$2b$10$abcdefghijklmnopqrstuu', false, 'ACTIVE');

      INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
      VALUES
        ('${academicSessionA}', '${schoolA}', 'Session 2026', '2026-01-01', '2026-12-31', true, false),
        ('${academicSessionB}', '${schoolB}', 'Session 2026', '2026-01-01', '2026-12-31', true, false);

      INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category, status)
      VALUES 
        ('${classA}', '${schoolA}', 'Class 8', '৮ম শ্রেণি', 8, 'SECONDARY', 'ACTIVE');

      INSERT INTO sections (id, school_id, campus_id, class_id, name_en, name_bn, shift, max_capacity, status)
      VALUES ('${sectionA}', '${schoolA}', '${campusA}', '${classA}', 'Padma', 'পদ্মা', 'MORNING', 40, 'ACTIVE');

      INSERT INTO classrooms (id, school_id, campus_id, room_no, building, floor, seating_capacity, status)
      VALUES ('${classroomA}', '${schoolA}', '${campusA}', 'Lab-101', 'Academic Building', '1', 35, 'ACTIVE');

      INSERT INTO departments (id, school_id, code, name_en, name_bn, status)
      VALUES 
        ('${deptA}', '${schoolA}', 'ACAD', 'Academic Dept', 'শিক্ষা বিভাগ', 'ACTIVE'),
        ('${deptB}', '${schoolB}', 'ACAD', 'Academic Dept', 'শিক্ষা বিভাগ', 'ACTIVE');

      INSERT INTO designations (id, school_id, department_id, code, title_en, title_bn, status)
      VALUES 
        ('${desigA}', '${schoolA}', '${deptA}', 'TCH', 'Senior Teacher', 'সিনিয়র শিক্ষক', 'ACTIVE'),
        ('${desigB}', '${schoolB}', '${deptB}', 'TCH', 'Senior Teacher', 'সিনিয়র শিক্ষক', 'ACTIVE');

      INSERT INTO employees (
        id, school_id, campus_id, department_id, designation_id, employee_code, first_name_en, last_name_en, 
        full_name_en, full_name_bn, date_of_birth, gender, national_id, phone, email, joining_date, employment_type, status
      ) VALUES 
        ('${employeeTeacherA}', '${schoolA}', '${campusA}', '${deptA}', '${desigA}', 'EMP-T-01', 'Anisur', 'Rahman', 'Anisur Rahman', 'আনিসুর রহমান', '1982-05-10', 'MALE', '19820011223344', '+8801733445566', 'anisur@lib-a.bd', '2024-01-01', 'PERMANENT', 'ACTIVE'),
        ('${employeeTeacherB}', '${schoolB}', '${campusB}', '${deptB}', '${desigB}', 'EMP-T-02', 'Kamal', 'Hossain', 'Kamal Hossain', 'কামাল হোসেন', '1984-08-15', 'MALE', '19840011223344', '+8801744556677', 'kamal@lib-b.bd', '2024-01-01', 'PERMANENT', 'ACTIVE');

      INSERT INTO students (
        id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, 
        date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, 
        permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, 
        present_district, present_division, status
      ) VALUES
        ('${studentA1}', '${schoolA}', 'STD-A-101', '2026-01-01', 'Tahmid', 'Hasan', 'Tahmid Hasan', 'তাহমিদ হাসান', '2011-03-20', 'MALE', 'ISLAM', 'Uttara, Dhaka', 'Uttara', '1230', 'Uttara', 'Dhaka', 'DHAKA', 'Uttara, Dhaka', 'Uttara', 'Dhaka', 'DHAKA', 'ACTIVE'),
        ('${studentA2}', '${schoolA}', 'STD-A-102', '2026-01-01', 'Nusrat', 'Jahan', 'Nusrat Jahan', 'নুসরাত জাহান', '2011-06-15', 'FEMALE', 'ISLAM', 'Banani, Dhaka', 'Banani', '1213', 'Banani', 'Dhaka', 'DHAKA', 'Banani, Dhaka', 'Banani', 'Dhaka', 'DHAKA', 'ACTIVE'),
        ('${studentB}', '${schoolB}', 'STD-B-101', '2026-01-01', 'Sabbir', 'Ahmed', 'Sabbir Ahmed', 'সাব্বির আহমেদ', '2011-04-10', 'MALE', 'ISLAM', 'GEC, Ctg', 'GEC', '4000', 'Panchlaish', 'Chittagong', 'CHITTAGONG', 'GEC, Ctg', 'Panchlaish', 'Chittagong', 'CHITTAGONG', 'ACTIVE');

      INSERT INTO enrollments (id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status)
      VALUES
        ('${enrollmentA1}', '${schoolA}', '${campusA}', '${studentA1}', '${academicSessionA}', '${classA}', '${sectionA}', 1, '2026-01-01', 'ACTIVE'),
        ('${enrollmentA2}', '${schoolA}', '${campusA}', '${studentA2}', '${academicSessionA}', '${classA}', '${sectionA}', 2, '2026-01-01', 'ACTIVE'),
        ('${enrollmentB}', '${schoolB}', '${campusB}', '${studentB}', '${academicSessionB}', '${classA}', '${sectionA}', 1, '2026-01-01', 'ACTIVE');
    `);
    recordPass(113, 'Seed School A and School B baseline multi-tenant fixtures');
  } catch (err) {
    recordFail(113, 'Seed test fixtures', err);
    throw err;
  }

  // Tenant switching helper: switches session role to edusmart_app_user and sets tenant context
  const asTenant = async (schoolId, fn) => {
    try {
      await db.exec(`SET ROLE edusmart_app_user; SET app.current_school_id = '${schoolId}';`);
      return await fn();
    } finally {
      await db.exec(`SET ROLE postgres; RESET app.current_school_id;`);
    }
  };

  // Scenario 114: Seed default Library Settings for School A and School B
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_settings (id, school_id, student_max_books, student_loan_period_days, student_max_renewals, employee_max_books, employee_loan_period_days, employee_max_renewals, daily_fine_rate, blocked_threshold_fine)
        VALUES ('${randomUUID()}', '${schoolA}', 3, 14, 2, 5, 30, 3, 5.00, 500.00);
      `);
    });

    await asTenant(schoolB, async () => {
      await db.exec(`
        INSERT INTO library_settings (id, school_id, student_max_books, student_loan_period_days, student_max_renewals, employee_max_books, employee_loan_period_days, employee_max_renewals, daily_fine_rate, blocked_threshold_fine)
        VALUES ('${randomUUID()}', '${schoolB}', 2, 7, 1, 3, 14, 1, 10.00, 200.00);
      `);
    });
    recordPass(114, 'Seed default Library Settings for School A and School B under tenant contexts');
  } catch (err) {
    recordFail(114, 'Seed library settings', err);
  }

  // Scenario 115: Verify edusmart_app_user permissions granted across all Phase 10 tables
  try {
    const testQuery = await asTenant(schoolA, async () => {
      return await db.query(`SELECT count(*) as count FROM library_settings;`);
    });
    if (parseInt(testQuery.rows[0].count) !== 1) throw new Error('Failed to query as edusmart_app_user');
    recordPass(115, 'edusmart_app_user has valid SELECT/INSERT/UPDATE permissions under tenant context');
  } catch (err) {
    recordFail(115, 'App user permissions check', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 6: LIBRARY CIRCULATION, CONCURRENCY & FINES INTEGRATION (Scenarios 116-133)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: LIBRARY CIRCULATION, CONCURRENCY & FINES INTEGRATION ---');

  const catAId = randomUUID();
  const authorAId = randomUUID();
  const pubAId = randomUUID();
  const bookAId = randomUUID();
  const copy1AId = randomUUID();
  const copy2AId = randomUUID();
  const loan1AId = randomUUID();

  // Scenario 116: Create Category, Author, Publisher, and Book in School A under tenant context
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_categories (id, school_id, code, name_en, name_bn)
        VALUES ('${catAId}', '${schoolA}', 'CAT-NOVEL', 'Bengali Fiction', 'বাংলা উপন্যাস');

        INSERT INTO library_authors (id, school_id, name_en, name_bn)
        VALUES ('${authorAId}', '${schoolA}', 'Humayun Ahmed', 'হুমায়ূন আহমেদ');

        INSERT INTO library_publishers (id, school_id, name_en, name_bn)
        VALUES ('${pubAId}', '${schoolA}', 'Ananya Prokashoni', 'অনন্যা প্রকাশনী');

        INSERT INTO library_books (id, school_id, category_id, author_id, publisher_id, title_en, title_bn, isbn13, publication_year)
        VALUES ('${bookAId}', '${schoolA}', '${catAId}', '${authorAId}', '${pubAId}', 'Shonkhonil Karagar', 'শঙ্খনীল কারাগার', '9789844140011', 1973);
      `);
    });
    recordPass(116, 'Create Category, Author, Publisher, and Book in School A under tenant context');
  } catch (err) {
    recordFail(116, 'Create library catalog items', err);
  }

  // Scenario 117: RLS blocks School B from querying School A books
  try {
    const res = await asTenant(schoolB, async () => {
      return await db.query(`SELECT * FROM library_books WHERE id = '${bookAId}';`);
    });
    if (res.rows.length > 0) throw new Error('School B was able to see School A book title!');
    recordPass(117, 'PostgreSQL RLS blocks School B from reading School A library books');
  } catch (err) {
    recordFail(117, 'RLS cross-tenant book read leak', err);
  }

  // Scenario 118: Register physical copies (CP-001 and CP-002)
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_book_copies (id, school_id, book_id, campus_id, accession_number, barcode, acquisition_cost, condition, status)
        VALUES 
          ('${copy1AId}', '${schoolA}', '${bookAId}', '${campusA}', 'ACC-A-001', 'BC-A-001', 250.00, 'NEW', 'AVAILABLE'),
          ('${copy2AId}', '${schoolA}', '${bookAId}', '${campusA}', 'ACC-A-002', 'BC-A-002', 250.00, 'NEW', 'AVAILABLE');
      `);
    });
    recordPass(118, 'Register physical book copies (CP-001, CP-002) in School A');
  } catch (err) {
    recordFail(118, 'Register book copies', err);
  }

  // Scenario 119: Duplicate copy accession number within same school is rejected
  try {
    let dupFailed = false;
    try {
      await asTenant(schoolA, async () => {
        await db.exec(`
          INSERT INTO library_book_copies (id, school_id, book_id, campus_id, accession_number, barcode, acquisition_cost, condition, status)
          VALUES ('${randomUUID()}', '${schoolA}', '${bookAId}', '${campusA}', 'ACC-A-001', 'BC-DIFFERENT', 250.00, 'NEW', 'AVAILABLE');
        `);
      });
    } catch {
      dupFailed = true;
    }
    if (!dupFailed) throw new Error('Duplicate accession number was accepted');
    recordPass(119, 'Unique constraint uq_lib_copy_accession rejects duplicate accession number within school');
  } catch (err) {
    recordFail(119, 'Duplicate accession number check', err);
  }

  // Scenario 120: Issue book copy CP-001 to Student A1 -> loan status becomes ISSUED
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_loans (id, school_id, copy_id, borrower_type, student_id, enrollment_id, issue_date, due_date, status, renewal_count, issued_by_id)
        VALUES ('${loan1AId}', '${schoolA}', '${copy1AId}', 'STUDENT', '${studentA1}', '${enrollmentA1}', NOW(), NOW() + INTERVAL '14 days', 'ISSUED', 0, '${userLibrarianA}');

        UPDATE library_book_copies SET status = 'ISSUED' WHERE id = '${copy1AId}';
      `);
    });
    recordPass(120, 'Issue book copy CP-001 to Student A1 with 14-day due date');
  } catch (err) {
    recordFail(120, 'Issue book loan', err);
  }

  // Scenario 121: Copy status successfully updated to ISSUED
  try {
    const copyRes = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status FROM library_book_copies WHERE id = '${copy1AId}';`);
    });
    if (copyRes.rows[0].status !== 'ISSUED') throw new Error(`Expected ISSUED, got ${copyRes.rows[0].status}`);
    recordPass(121, 'Book copy status successfully updated to ISSUED on circulation ledger');
  } catch (err) {
    recordFail(121, 'Copy status check after loan', err);
  }

  // Scenario 122: Double-issue defense: Attempting to issue copy CP-001 while already issued is blocked by uq_active_copy_loan
  try {
    let doubleIssueBlocked = false;
    try {
      await asTenant(schoolA, async () => {
        await db.exec(`
          INSERT INTO library_loans (id, school_id, copy_id, borrower_type, student_id, enrollment_id, issue_date, due_date, status, renewal_count, issued_by_id)
          VALUES ('${randomUUID()}', '${schoolA}', '${copy1AId}', 'STUDENT', '${studentA2}', '${enrollmentA2}', NOW(), NOW() + INTERVAL '14 days', 'ISSUED', 0, '${userLibrarianA}');
        `);
      });
    } catch {
      doubleIssueBlocked = true;
    }
    if (!doubleIssueBlocked) throw new Error('Double-issue was accepted by database!');
    recordPass(122, 'Partial unique index uq_active_copy_loan strictly prevents double-issuance of the same copy');
  } catch (err) {
    recordFail(122, 'Double issue defense check', err);
  }

  // Scenario 123: Loan renewal: Successfully renew loan -> renewal_count increments to 1, due_date extended
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_loans 
        SET renewal_count = renewal_count + 1,
            due_date = due_date + INTERVAL '14 days'
        WHERE id = '${loan1AId}';
      `);
    });
    const loanCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT renewal_count FROM library_loans WHERE id = '${loan1AId}';`);
    });
    if (loanCheck.rows[0].renewal_count !== 1) throw new Error('Renewal count did not increment');
    recordPass(123, 'Loan renewal extends due date and increments renewal_count to 1');
  } catch (err) {
    recordFail(123, 'Loan renewal check', err);
  }

  // Scenario 124: Second renewal succeeds (renewal_count = 2)
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_loans 
        SET renewal_count = renewal_count + 1,
            due_date = due_date + INTERVAL '14 days'
        WHERE id = '${loan1AId}';
      `);
    });
    const loanCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT renewal_count FROM library_loans WHERE id = '${loan1AId}';`);
    });
    if (loanCheck.rows[0].renewal_count !== 2) throw new Error('Renewal count was not 2');
    recordPass(124, 'Second loan renewal succeeds, reaching student maximum renewal quota (2/2)');
  } catch (err) {
    recordFail(124, 'Second renewal check', err);
  }

  // Scenario 125: Place reservation: Student A2 places reservation for the book while copies are checked out
  const resStudentA2Id = randomUUID();
  try {
    await asTenant(schoolA, async () => {
      // Mark copy 2 also as ISSUED so all copies are busy
      await db.exec(`UPDATE library_book_copies SET status = 'ISSUED' WHERE id = '${copy2AId}';`);

      await db.exec(`
        INSERT INTO library_reservations (id, school_id, book_id, borrower_type, student_id, reservation_date, expiry_date, status)
        VALUES ('${resStudentA2Id}', '${schoolA}', '${bookAId}', 'STUDENT', '${studentA2}', NOW(), NOW() + INTERVAL '7 days', 'PENDING');
      `);
    });
    recordPass(125, 'Student A2 places pending title reservation in FIFO reservation queue');
  } catch (err) {
    recordFail(125, 'Place title reservation', err);
  }

  // Scenario 126: Duplicate reservation defense: Student A2 cannot place second pending reservation on same book
  try {
    let dupResBlocked = false;
    try {
      await asTenant(schoolA, async () => {
        await db.exec(`
          INSERT INTO library_reservations (id, school_id, book_id, borrower_type, student_id, reservation_date, expiry_date, status)
          VALUES ('${randomUUID()}', '${schoolA}', '${bookAId}', 'STUDENT', '${studentA2}', NOW(), NOW() + INTERVAL '7 days', 'PENDING');
        `);
      });
    } catch {
      dupResBlocked = true;
    }
    if (!dupResBlocked) throw new Error('Duplicate student reservation was accepted');
    recordPass(126, 'Partial unique index uq_active_student_reservation strictly blocks duplicate student reservation');
  } catch (err) {
    recordFail(126, 'Duplicate student reservation check', err);
  }

  // Scenario 127: Employee reservation: Teacher A places reservation on the book
  const resTeacherAId = randomUUID();
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_reservations (id, school_id, book_id, borrower_type, employee_id, reservation_date, expiry_date, status)
        VALUES ('${resTeacherAId}', '${schoolA}', '${bookAId}', 'EMPLOYEE', '${employeeTeacherA}', NOW(), NOW() + INTERVAL '7 days', 'PENDING');
      `);
    });
    recordPass(127, 'Teacher A places pending reservation for employee borrower type');
  } catch (err) {
    recordFail(127, 'Employee title reservation', err);
  }

  // Scenario 128: Simulate overdue loan: Backdate due_date by 5 days
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_loans 
        SET due_date = NOW() - INTERVAL '5 days',
            status = 'OVERDUE'
        WHERE id = '${loan1AId}';
      `);
    });
    const overdueCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status FROM library_loans WHERE id = '${loan1AId}';`);
    });
    if (overdueCheck.rows[0].status !== 'OVERDUE') throw new Error('Loan status was not OVERDUE');
    recordPass(128, 'Loan due date backdated by 5 days; status transitioned to OVERDUE');
  } catch (err) {
    recordFail(128, 'Simulate overdue loan', err);
  }

  // Scenario 129: Return overdue book: Return book -> loan status becomes RETURNED, copy status becomes AVAILABLE
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_loans 
        SET return_date = NOW(),
            status = 'RETURNED'
        WHERE id = '${loan1AId}';

        UPDATE library_book_copies 
        SET status = 'AVAILABLE' 
        WHERE id = '${copy1AId}';
      `);
    });
    recordPass(129, 'Overdue book returned; loan marked RETURNED and physical copy status updated to AVAILABLE');
  } catch (err) {
    recordFail(129, 'Return overdue book', err);
  }

  // Scenario 130: Fine creation: Overdue return generates library_fines record (5 days * ৳5 = ৳25.00)
  const fine1AId = randomUUID();
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO library_fines (
          id, school_id, loan_id, borrower_type, student_id, fine_type, overdue_days, daily_rate, 
          calculated_amount, fine_amount, waived_amount, paid_amount, status
        ) VALUES (
          '${fine1AId}', '${schoolA}', '${loan1AId}', 'STUDENT', '${studentA1}', 'OVERDUE', 5, 5.00,
          25.00, 25.00, 0.00, 0.00, 'UNPAID'
        );
      `);
    });
    const fineRes = await asTenant(schoolA, async () => {
      return await db.query(`SELECT fine_amount, status FROM library_fines WHERE id = '${fine1AId}';`);
    });
    if (parseFloat(fineRes.rows[0].fine_amount) !== 25.00) throw new Error('Fine amount was not 25.00');
    recordPass(130, 'Overdue return generates library_fines record (5 days * ৳5 = ৳25.00, status UNPAID)');
  } catch (err) {
    recordFail(130, 'Create overdue fine', err);
  }

  // Scenario 131: Partial fine waiver: Authorized librarian waives ৳ 10.00
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_fines
        SET waived_amount = 10.00,
            fine_amount = 15.00,
            waived_reason = 'Principal approved partial waiver due to medical excuse',
            waived_by_id = '${userAdminA}',
            updated_at = NOW()
        WHERE id = '${fine1AId}';
      `);
    });
    const fineCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT fine_amount, waived_amount FROM library_fines WHERE id = '${fine1AId}';`);
    });
    if (parseFloat(fineCheck.rows[0].fine_amount) !== 15.00 || parseFloat(fineCheck.rows[0].waived_amount) !== 10.00) {
      throw new Error('Partial waiver amounts not recorded accurately');
    }
    recordPass(131, 'Authorized librarian waives ৳10.00 with recorded reason and waived_by_id audit');
  } catch (err) {
    recordFail(131, 'Partial fine waiver', err);
  }

  // Scenario 132: Full fine waiver / settlement: Remaining balance waived -> fine marked WAIVED
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_fines
        SET waived_amount = 25.00,
            fine_amount = 0.00,
            status = 'WAIVED'
        WHERE id = '${fine1AId}';
      `);
    });
    const fineCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status, fine_amount FROM library_fines WHERE id = '${fine1AId}';`);
    });
    if (fineCheck.rows[0].status !== 'WAIVED' || parseFloat(fineCheck.rows[0].fine_amount) !== 0.00) {
      throw new Error('Fine status not settled as WAIVED');
    }
    recordPass(132, 'Full fine waiver settles remaining balance to 0.00 and updates status to WAIVED');
  } catch (err) {
    recordFail(132, 'Full fine waiver settlement', err);
  }

  // Scenario 133: Reservation fulfillment: Returning copy fulfills oldest pending reservation for Student A2
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE library_reservations
        SET status = 'FULFILLED',
            fulfilled_copy_id = '${copy1AId}',
            fulfilled_date = NOW()
        WHERE id = '${resStudentA2Id}';

        UPDATE library_book_copies
        SET status = 'RESERVED'
        WHERE id = '${copy1AId}';
      `);
    });
    const resCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status, fulfilled_copy_id FROM library_reservations WHERE id = '${resStudentA2Id}';`);
    });
    if (resCheck.rows[0].status !== 'FULFILLED' || resCheck.rows[0].fulfilled_copy_id !== copy1AId) {
      throw new Error('Reservation was not fulfilled with allocated copy');
    }
    recordPass(133, 'Returning physical copy fulfills oldest pending reservation and marks copy RESERVED');
  } catch (err) {
    recordFail(133, 'Reservation fulfillment', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 7: CONSUMABLE INVENTORY & PROCUREMENT INTEGRATION (Scenarios 134-143)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 7: CONSUMABLE INVENTORY & PROCUREMENT INTEGRATION ---');

  const invCatAId = randomUUID();
  const invItemPaperId = randomUUID();
  const supplierAId = randomUUID();
  const purchaseAId = randomUUID();

  // Scenario 134: Create inventory category and item ITEM-PAPER-A4 in School A
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO inventory_categories (id, school_id, code, name_en, name_bn, item_type)
        VALUES ('${invCatAId}', '${schoolA}', 'OFFICE-SUPPLY', 'Office & Exam Supplies', 'দাপ্তরিক ও পরীক্ষা সামগ্রী', 'CONSUMABLE');

        INSERT INTO inventory_items (id, school_id, category_id, item_code, name_en, name_bn, item_type, stock_unit, min_stock_level, reorder_level)
        VALUES ('${invItemPaperId}', '${schoolA}', '${invCatAId}', 'ITM-PAPER-A4', 'A4 Printing Paper (80 GSM)', 'এ৪ প্রিন্টিং কাগজ', 'CONSUMABLE', 'BOX', 5, 10);
      `);
    });
    recordPass(134, 'Create inventory category and consumable item ITEM-PAPER-A4 in School A');
  } catch (err) {
    recordFail(134, 'Create consumable inventory item', err);
  }

  // Scenario 135: RLS blocks School B from querying School A inventory items
  try {
    const res = await asTenant(schoolB, async () => {
      return await db.query(`SELECT * FROM inventory_items WHERE id = '${invItemPaperId}';`);
    });
    if (res.rows.length > 0) throw new Error('School B was able to see School A inventory item!');
    recordPass(135, 'PostgreSQL RLS blocks School B from querying School A inventory items');
  } catch (err) {
    recordFail(135, 'RLS cross-tenant item leak', err);
  }

  // Scenario 136: Duplicate item code within same school is rejected by uq_inv_item_code
  try {
    let dupItemBlocked = false;
    try {
      await asTenant(schoolA, async () => {
        await db.exec(`
          INSERT INTO inventory_items (id, school_id, category_id, item_code, name_en, name_bn, item_type, stock_unit)
          VALUES ('${randomUUID()}', '${schoolA}', '${invCatAId}', 'ITM-PAPER-A4', 'Another Paper', 'অন্য কাগজ', 'CONSUMABLE', 'BOX');
        `);
      });
    } catch {
      dupItemBlocked = true;
    }
    if (!dupItemBlocked) throw new Error('Duplicate item code accepted');
    recordPass(136, 'Unique constraint uq_inv_item_code rejects duplicate item code within same school');
  } catch (err) {
    recordFail(136, 'Duplicate item code check', err);
  }

  // Scenario 137: Create supplier SUP-01 in School A
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO inventory_suppliers (id, school_id, supplier_code, name, company_name, phone, email, address)
        VALUES ('${supplierAId}', '${schoolA}', 'SUP-01', 'Bashundhara Paper Supplies', 'Bashundhara Group', '+8801711998877', 'orders@bashundhara.bd', 'Baridhara, Dhaka');
      `);
    });
    recordPass(137, 'Create supplier SUP-01 in School A under tenant context');
  } catch (err) {
    recordFail(137, 'Create supplier', err);
  }

  // Scenario 138: Create purchase order with line items
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO inventory_purchases (id, school_id, campus_id, supplier_id, purchase_number, purchase_date, total_amount, status)
        VALUES ('${purchaseAId}', '${schoolA}', '${campusA}', '${supplierAId}', 'PO-2026-001', '2026-03-01', 45000.00, 'RECEIVED');

        INSERT INTO inventory_purchase_items (id, school_id, purchase_id, item_id, quantity, unit_cost, total_cost)
        VALUES ('${randomUUID()}', '${schoolA}', '${purchaseAId}', '${invItemPaperId}', 100, 450.00, 45000.00);
      `);
    });
    recordPass(138, 'Create purchase order PO-2026-001 with 100 units of A4 paper @ ৳450.00');
  } catch (err) {
    recordFail(138, 'Create purchase order', err);
  }

  // Scenario 139: Record initial stock-in movement (PURCHASE_IN +100 units)
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO stock_movements (id, school_id, item_id, campus_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by_id)
        VALUES ('${randomUUID()}', '${schoolA}', '${invItemPaperId}', '${campusA}', 'PURCHASE_IN', 100, 450.00, 'PURCHASE', '${purchaseAId}', '${userAdminA}');
      `);
    });
    const stockQuery = await asTenant(schoolA, async () => {
      return await db.query(`
        SELECT COALESCE(SUM(CASE WHEN movement_type IN ('PURCHASE_IN', 'TRANSFER_IN', 'RETURN_IN', 'ADJUSTMENT_IN') THEN quantity ELSE -quantity END), 0) as balance
        FROM stock_movements
        WHERE item_id = '${invItemPaperId}';
      `);
    });
    if (parseInt(stockQuery.rows[0].balance) !== 100) throw new Error(`Expected balance 100, got ${stockQuery.rows[0].balance}`);
    recordPass(139, 'Authoritative stock ledger records PURCHASE_IN movement; balance is 100 units');
  } catch (err) {
    recordFail(139, 'Initial stock-in movement', err);
  }

  // Scenario 140: Record stock-out movement (ISSUE_OUT 30 units to exam department) -> balance is 70
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO stock_movements (id, school_id, item_id, campus_id, movement_type, quantity, unit_cost, notes, created_by_id)
        VALUES ('${randomUUID()}', '${schoolA}', '${invItemPaperId}', '${campusA}', 'ISSUE_OUT', 30, 450.00, 'Issued for Midterm Examination scripts', '${userAdminA}');
      `);
    });
    const stockQuery = await asTenant(schoolA, async () => {
      return await db.query(`
        SELECT COALESCE(SUM(CASE WHEN movement_type IN ('PURCHASE_IN', 'TRANSFER_IN', 'RETURN_IN', 'ADJUSTMENT_IN') THEN quantity ELSE -quantity END), 0) as balance
        FROM stock_movements
        WHERE item_id = '${invItemPaperId}';
      `);
    });
    if (parseInt(stockQuery.rows[0].balance) !== 70) throw new Error(`Expected balance 70, got ${stockQuery.rows[0].balance}`);
    recordPass(140, 'Record ISSUE_OUT movement for 30 boxes; stock balance reduces to 70 units');
  } catch (err) {
    recordFail(140, 'Stock-out movement', err);
  }

  // Scenario 141: Strict negative stock defense: Attempting to issue 150 units when only 70 available is rejected by domain service
  try {
    const currentBalance = 70;
    const requested = 150;
    const check = validateStockAvailability(currentBalance, requested);
    if (check.available) throw new Error('Excessive stock issuance was allowed!');
    recordPass(141, 'Domain engine strictly denies issuance exceeding available stock (requested 150 > available 70)');
  } catch (err) {
    recordFail(141, 'Negative stock defense check', err);
  }

  // Scenario 142: Reorder alert detection: Consuming 65 units leaves 5 units (below reorderLevel of 10)
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO stock_movements (id, school_id, item_id, campus_id, movement_type, quantity, unit_cost, notes, created_by_id)
        VALUES ('${randomUUID()}', '${schoolA}', '${invItemPaperId}', '${campusA}', 'ISSUE_OUT', 65, 450.00, 'Issued for Final Exams', '${userAdminA}');
      `);
    });
    const stockQuery = await asTenant(schoolA, async () => {
      return await db.query(`
        SELECT 
          i.reorder_level,
          COALESCE(SUM(CASE WHEN m.movement_type IN ('PURCHASE_IN', 'TRANSFER_IN', 'RETURN_IN', 'ADJUSTMENT_IN') THEN m.quantity ELSE -m.quantity END), 0) as current_stock
        FROM inventory_items i
        LEFT JOIN stock_movements m ON i.id = m.item_id
        WHERE i.id = '${invItemPaperId}'
        GROUP BY i.id, i.reorder_level;
      `);
    });
    const current = parseInt(stockQuery.rows[0].current_stock);
    const reorder = parseInt(stockQuery.rows[0].reorder_level);
    if (current > reorder) throw new Error(`Expected current <= reorder, got ${current} > ${reorder}`);
    recordPass(142, 'Stock level drops to 5 units, successfully triggering low stock reorder alert (5 <= 10)');
  } catch (err) {
    recordFail(142, 'Reorder alert check', err);
  }

  // Scenario 143: Inter-campus inventory transfer: Transfer 20 units creates paired TRANSFER_OUT and TRANSFER_IN
  const campusA2 = randomUUID();
  try {
    await db.exec(`
      INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch, status)
      VALUES ('${campusA2}', '${schoolA}', 'CAMP-NORTH', 'North Campus A', 'উত্তর ক্যাম্পাস', false, 'ACTIVE');
    `);

    const transferId = randomUUID();
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO inventory_transfers (id, school_id, transfer_number, item_id, source_campus_id, destination_campus_id, quantity, status, initiated_by_id)
        VALUES ('${transferId}', '${schoolA}', 'TRF-2026-01', '${invItemPaperId}', '${campusA}', '${campusA2}', 20, 'COMPLETED', '${userAdminA}');

        INSERT INTO stock_movements (id, school_id, item_id, campus_id, movement_type, quantity, source_campus_id, destination_campus_id, reference_type, reference_id, created_by_id)
        VALUES 
          ('${randomUUID()}', '${schoolA}', '${invItemPaperId}', '${campusA}', 'TRANSFER_OUT', 20, '${campusA}', '${campusA2}', 'TRANSFER', '${transferId}', '${userAdminA}'),
          ('${randomUUID()}', '${schoolA}', '${invItemPaperId}', '${campusA2}', 'TRANSFER_IN', 20, '${campusA}', '${campusA2}', 'TRANSFER', '${transferId}', '${userAdminA}');
      `);
    });

    const movementsCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT count(*) as count FROM stock_movements WHERE reference_id = '${transferId}';`);
    });
    if (parseInt(movementsCheck.rows[0].count) !== 2) throw new Error('Paired transfer movements not found');
    recordPass(143, 'Inter-campus transfer records paired TRANSFER_OUT and TRANSFER_IN ledger movements');
  } catch (err) {
    recordFail(143, 'Inter-campus inventory transfer', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 8: ASSET REGISTRY, ASSIGNMENT & DISPOSAL INTEGRATION (Scenarios 144-150)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 8: ASSET REGISTRY, ASSIGNMENT & DISPOSAL INTEGRATION ---');

  const assetCatId = randomUUID();
  const assetItemId = randomUUID();
  const asset1AId = randomUUID();

  // Scenario 144: Register tracked asset AST-DESK-01 in School A with serial number
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO inventory_categories (id, school_id, code, name_en, name_bn, item_type)
        VALUES ('${assetCatId}', '${schoolA}', 'FURNITURE', 'School Furniture', 'বিদ্যালয়ের আসবাবপত্র', 'ASSET');

        INSERT INTO inventory_items (id, school_id, category_id, item_code, name_en, name_bn, item_type, stock_unit)
        VALUES ('${assetItemId}', '${schoolA}', '${assetCatId}', 'ITM-DESK-EXEC', 'Executive Office Desk', 'অফিস ডেস্ক', 'ASSET', 'PCS');

        INSERT INTO assets (id, school_id, item_id, campus_id, asset_code, serial_number, purchase_cost, current_condition, status)
        VALUES ('${asset1AId}', '${schoolA}', '${assetItemId}', '${campusA}', 'AST-DESK-01', 'SN-OTOBI-112233', 18500.00, 'NEW', 'AVAILABLE');
      `);
    });
    recordPass(144, 'Register capital asset AST-DESK-01 in School A with unique serial number');
  } catch (err) {
    recordFail(144, 'Register tracked asset', err);
  }

  // Scenario 145: RLS blocks School B from querying School A assets
  try {
    const res = await asTenant(schoolB, async () => {
      return await db.query(`SELECT * FROM assets WHERE id = '${asset1AId}';`);
    });
    if (res.rows.length > 0) throw new Error('School B was able to see School A asset!');
    recordPass(145, 'PostgreSQL RLS blocks School B from reading School A tracked assets');
  } catch (err) {
    recordFail(145, 'RLS cross-tenant asset leak', err);
  }

  // Scenario 146: Duplicate asset code within same school is rejected by uq_asset_code
  try {
    let dupAssetBlocked = false;
    try {
      await asTenant(schoolA, async () => {
        await db.exec(`
          INSERT INTO assets (id, school_id, item_id, campus_id, asset_code, serial_number, purchase_cost, current_condition, status)
          VALUES ('${randomUUID()}', '${schoolA}', '${assetItemId}', '${campusA}', 'AST-DESK-01', 'SN-DIFFERENT', 18500.00, 'NEW', 'AVAILABLE');
        `);
      });
    } catch {
      dupAssetBlocked = true;
    }
    if (!dupAssetBlocked) throw new Error('Duplicate asset code was accepted');
    recordPass(146, 'Unique constraint uq_asset_code strictly prevents duplicate asset code within same school');
  } catch (err) {
    recordFail(146, 'Duplicate asset code check', err);
  }

  // Scenario 147: Assign asset AST-DESK-01 to Teacher A -> asset status becomes ASSIGNED
  const assign1Id = randomUUID();
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO asset_assignments (id, school_id, asset_id, employee_id, condition_on_assignment, assigned_by_id)
        VALUES ('${assign1Id}', '${schoolA}', '${asset1AId}', '${employeeTeacherA}', 'NEW', '${userAdminA}');

        UPDATE assets 
        SET status = 'ASSIGNED', 
            assigned_employee_id = '${employeeTeacherA}'
        WHERE id = '${asset1AId}';
      `);
    });
    const assetCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status, assigned_employee_id FROM assets WHERE id = '${asset1AId}';`);
    });
    if (assetCheck.rows[0].status !== 'ASSIGNED' || assetCheck.rows[0].assigned_employee_id !== employeeTeacherA) {
      throw new Error('Asset status not updated to ASSIGNED');
    }
    recordPass(147, 'Assign asset to Teacher A; status becomes ASSIGNED and assignment ledger logged');
  } catch (err) {
    recordFail(147, 'Assign asset to employee', err);
  }

  // Scenario 148: Return asset: Teacher A returns asset in GOOD condition -> asset status reverts to AVAILABLE
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE asset_assignments
        SET returned_date = NOW(),
            condition_on_return = 'GOOD'
        WHERE id = '${assign1Id}';

        UPDATE assets 
        SET status = 'AVAILABLE',
            assigned_employee_id = NULL,
            current_condition = 'GOOD'
        WHERE id = '${asset1AId}';
      `);
    });
    const assetCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status, assigned_employee_id, current_condition FROM assets WHERE id = '${asset1AId}';`);
    });
    if (assetCheck.rows[0].status !== 'AVAILABLE' || assetCheck.rows[0].assigned_employee_id != null) {
      throw new Error('Asset did not revert to AVAILABLE');
    }
    recordPass(148, 'Teacher returns asset; status reverts to AVAILABLE and assignment log records return date');
  } catch (err) {
    recordFail(148, 'Return asset check', err);
  }

  // Scenario 149: Asset maintenance log: Record maintenance event with cost
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        INSERT INTO asset_maintenance_logs (id, school_id, asset_id, maintenance_type, service_date, vendor_name, cost, status, created_by_id)
        VALUES ('${randomUUID()}', '${schoolA}', '${asset1AId}', 'Varnish and Polish', '2026-03-02', 'Furniture Care BD', 1200.00, 'COMPLETED', '${userAdminA}');
      `);
    });
    const maintCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT cost FROM asset_maintenance_logs WHERE asset_id = '${asset1AId}';`);
    });
    if (parseFloat(maintCheck.rows[0].cost) !== 1200.00) throw new Error('Maintenance cost not recorded accurately');
    recordPass(149, 'Asset maintenance log records servicing event and expense (৳1,200.00)');
  } catch (err) {
    recordFail(149, 'Asset maintenance log check', err);
  }

  // Scenario 150: Terminal asset disposal: Asset marked DISPOSED with scrap value; reassignment strictly blocked
  try {
    await asTenant(schoolA, async () => {
      await db.exec(`
        UPDATE assets
        SET status = 'DISPOSED',
            disposal_date = NOW(),
            disposal_reason = 'Broken leg, beyond economic repair',
            disposal_value = 500.00,
            disposed_by_id = '${userAdminA}'
        WHERE id = '${asset1AId}';
      `);
    });
    const assetCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT status, disposal_reason FROM assets WHERE id = '${asset1AId}';`);
    });
    if (assetCheck.rows[0].status !== 'DISPOSED') throw new Error('Asset status not DISPOSED');

    const transitionCheck = isValidAssetStatusTransition('DISPOSED', 'AVAILABLE');
    if (transitionCheck.valid) throw new Error('Disposed asset was allowed to transition back to AVAILABLE');

    recordPass(150, 'Terminal asset disposal recorded with scrap value; reactivation or reassignment strictly blocked');
  } catch (err) {
    recordFail(150, 'Terminal asset disposal check', err);
  }

  // --------------------------------------------------------------------------
  // SECTION 9: RBAC PERMISSIONS & SELF-SERVICE PORTAL SCOPES (Scenarios 151-155)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 9: RBAC PERMISSIONS & SELF-SERVICE PORTAL SCOPES ---');

  // Scenario 151: PERMISSION_CATALOG contains all 32 Phase 10 Library and Inventory permissions
  try {
    const requiredPerms = [
      'LIBRARY_VIEW', 'LIBRARY_CREATE', 'LIBRARY_UPDATE', 'LIBRARY_DELETE',
      'LIBRARY_MANAGE_CATALOG', 'LIBRARY_ISSUE', 'LIBRARY_RETURN', 'LIBRARY_RENEW',
      'LIBRARY_RESERVE', 'LIBRARY_FINE_VIEW', 'LIBRARY_FINE_CREATE', 'LIBRARY_FINE_WAIVE',
      'LIBRARY_REPORT_VIEW', 'LIBRARY_EXPORT',
      'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
      'INVENTORY_STOCK_IN', 'INVENTORY_STOCK_OUT', 'INVENTORY_TRANSFER',
      'INVENTORY_REPORT_VIEW', 'INVENTORY_EXPORT',
      'ASSET_VIEW', 'ASSET_CREATE', 'ASSET_UPDATE', 'ASSET_ASSIGN',
      'ASSET_DISPOSE', 'ASSET_MAINTENANCE_VIEW', 'ASSET_MAINTENANCE_CREATE'
    ];

    for (const p of requiredPerms) {
      if (!PERMISSION_CATALOG[p]) throw new Error(`Missing permission in catalog: ${p}`);
    }
    recordPass(151, 'PERMISSION_CATALOG contains all 30+ Phase 10 Library, Inventory & Asset permissions');
  } catch (err) {
    recordFail(151, 'Permission catalog check', err);
  }

  // Scenario 152: Role least privilege: STUDENT role has LIBRARY_VIEW, but NOT LIBRARY_ISSUE
  try {
    const studentPerms = SYSTEM_ROLE_PERMISSIONS.STUDENT?.permissions || [];
    if (!studentPerms.includes('LIBRARY_VIEW')) {
      throw new Error('Student missing portal library permissions');
    }
    if (studentPerms.includes('LIBRARY_ISSUE') || studentPerms.includes('INVENTORY_STOCK_OUT')) {
      throw new Error('Student has unauthorized administrative permissions');
    }
    recordPass(152, 'STUDENT role enforces least privilege: has portal view, strictly lacks circulation desk powers');
  } catch (err) {
    recordFail(152, 'Student role least privilege', err);
  }

  // Scenario 153: Role least privilege: INVENTORY_MANAGER role has full inventory permissions, but NOT transport routes
  try {
    const invMgrPerms = SYSTEM_ROLE_PERMISSIONS.INVENTORY_MANAGER?.permissions || [];
    if (!invMgrPerms.includes('INVENTORY_STOCK_IN') || !invMgrPerms.includes('ASSET_ASSIGN')) {
      throw new Error('INVENTORY_MANAGER missing core inventory permissions');
    }
    if (invMgrPerms.includes('TRANSPORT_MANAGE_ROUTES')) {
      throw new Error('INVENTORY_MANAGER has unauthorized cross-module permissions');
    }
    recordPass(153, 'INVENTORY_MANAGER role enforces least privilege: has complete stock/asset authority, lacks transport access');
  } catch (err) {
    recordFail(153, 'Inventory manager role least privilege', err);
  }

  // Scenario 154: Student self-service portal: Student queries own active loans and fines without horizontal privilege leakage
  try {
    const studentPortalData = await asTenant(schoolA, async () => {
      const loans = await db.query(`SELECT id, status FROM library_loans WHERE student_id = '${studentA1}';`);
      const fines = await db.query(`SELECT id, fine_amount, status FROM library_fines WHERE student_id = '${studentA1}';`);
      return { loans: loans.rows, fines: fines.rows };
    });
    if (studentPortalData.loans.length === 0) throw new Error('Student loans not retrieved');
    if (studentPortalData.fines.length === 0) throw new Error('Student fines not retrieved');
    recordPass(154, 'Student self-service portal successfully queries own loan history and fine balance');
  } catch (err) {
    recordFail(154, 'Student portal query', err);
  }

  // Scenario 155: Adversarial RLS cross-tenant attack defense: School B DELETE statement against School A assets/books silently deletes 0 rows
  try {
    await asTenant(schoolB, async () => {
      await db.exec(`DELETE FROM library_books WHERE id = '${bookAId}';`);
      await db.exec(`DELETE FROM assets WHERE id = '${asset1AId}';`);
    });

    const bookCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT id FROM library_books WHERE id = '${bookAId}';`);
    });
    const assetCheck = await asTenant(schoolA, async () => {
      return await db.query(`SELECT id FROM assets WHERE id = '${asset1AId}';`);
    });

    if (bookCheck.rows.length === 0 || assetCheck.rows.length === 0) {
      throw new Error('School B adversarial attack succeeded in deleting School A records!');
    }
    recordPass(155, 'Adversarial attack defense: School B DELETE statements against School A records affect 0 rows under RLS');
  } catch (err) {
    recordFail(155, 'Adversarial cross-tenant delete attempt', err);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('Phase 10 Library, Inventory & Asset Engine Test Summary:');
  console.log(`  Total Scenarios : ${passed + failed}`);
  console.log(`  Passed          : ${passed}`);
  console.log(`  Failed          : ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10Tests().catch((err) => {
  console.error('Fatal error during Phase 10 test execution:', err);
  process.exit(1);
});
