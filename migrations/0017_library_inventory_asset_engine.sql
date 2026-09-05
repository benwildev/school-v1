-- ============================================================================
-- Migration 0017: Phase 10 — Library, Inventory & Asset Management Subsystem
-- Database Engine: PostgreSQL 15+ (Row-Level Security Enforced, Composite FKs)
-- Target Locale: Bangladesh (Asia/Dhaka), Currency: BDT (৳)
-- ============================================================================

-- 1. Extend PermissionModule Enum with LIBRARY and INVENTORY
DO $$ BEGIN
  ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'LIBRARY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'INVENTORY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create Phase 10 Domain Enums
DO $$ BEGIN
  CREATE TYPE "BookCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BookCopyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED', 'WITHDRAWN', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BorrowerType" AS ENUM ('STUDENT', 'EMPLOYEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LoanStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LibraryFineType" AS ENUM ('OVERDUE', 'LOST_BOOK', 'DAMAGE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LibraryFineStatus" AS ENUM ('UNPAID', 'PAID', 'WAIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryItemType" AS ENUM ('CONSUMABLE', 'ASSET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StockUnit" AS ENUM ('PCS', 'BOX', 'KG', 'LITER', 'SET', 'ROLL', 'PACKET', 'METER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ISSUE_OUT', 'RETURN_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'LOSS', 'DISPOSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseStatus" AS ENUM ('ORDERED', 'RECEIVED', 'PARTIAL', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'DAMAGED', 'DISPOSED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DOMAIN A: LIBRARY MANAGEMENT TABLES
-- ============================================================================

-- 3. Library Settings Table
CREATE TABLE IF NOT EXISTS library_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_max_books INT NOT NULL DEFAULT 3,
  student_loan_period_days INT NOT NULL DEFAULT 14,
  student_max_renewals INT NOT NULL DEFAULT 2,
  employee_max_books INT NOT NULL DEFAULT 10,
  employee_loan_period_days INT NOT NULL DEFAULT 30,
  employee_max_renewals INT NOT NULL DEFAULT 3,
  daily_fine_rate DECIMAL(12, 2) NOT NULL DEFAULT 5.00,
  lost_book_charge_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  damage_fine_flat DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  blocked_threshold_fine DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
  allow_student_reservations BOOLEAN NOT NULL DEFAULT true,
  allow_employee_reservations BOOLEAN NOT NULL DEFAULT true,
  reservation_validity_days INT NOT NULL DEFAULT 7,
  auto_bill_to_student_account BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_library_settings_school UNIQUE (school_id),
  CONSTRAINT uq_library_settings_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_lib_student_books CHECK (student_max_books > 0),
  CONSTRAINT chk_lib_emp_books CHECK (employee_max_books > 0),
  CONSTRAINT chk_lib_daily_fine CHECK (daily_fine_rate >= 0)
);

-- 4. Library Categories Table
CREATE TABLE IF NOT EXISTS library_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_category_code UNIQUE (school_id, code),
  CONSTRAINT uq_lib_category_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_lib_categories_school_status ON library_categories (school_id, status);

-- 5. Library Authors Table
CREATE TABLE IF NOT EXISTS library_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150),
  bio TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_author_name UNIQUE (school_id, name_en),
  CONSTRAINT uq_lib_author_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_lib_authors_school ON library_authors (school_id, status);

-- 6. Library Publishers Table
CREATE TABLE IF NOT EXISTS library_publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150),
  address TEXT,
  contact_phone VARCHAR(50),
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_publisher_name UNIQUE (school_id, name_en),
  CONSTRAINT uq_lib_publisher_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_lib_publishers_school ON library_publishers (school_id, status);

-- 7. Library Books (Bibliographic Titles) Table
CREATE TABLE IF NOT EXISTS library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES library_categories(id) ON DELETE RESTRICT,
  author_id UUID REFERENCES library_authors(id) ON DELETE SET NULL,
  publisher_id UUID REFERENCES library_publishers(id) ON DELETE SET NULL,
  title_en VARCHAR(255) NOT NULL,
  title_bn VARCHAR(255),
  subtitle VARCHAR(255),
  isbn10 VARCHAR(20),
  isbn13 VARCHAR(20),
  edition VARCHAR(50),
  publication_year INT,
  language VARCHAR(50) NOT NULL DEFAULT 'English',
  description TEXT,
  cover_url TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_book_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_lib_book_category_tenant FOREIGN KEY (category_id, school_id) REFERENCES library_categories(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lib_books_school ON library_books (school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_books_category ON library_books (school_id, category_id);
CREATE INDEX IF NOT EXISTS idx_lib_books_author ON library_books (school_id, author_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lib_book_isbn13 ON library_books (school_id, isbn13) WHERE isbn13 IS NOT NULL AND isbn13 <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_lib_book_isbn10 ON library_books (school_id, isbn10) WHERE isbn10 IS NOT NULL AND isbn10 <> '';

-- 8. Library Book Copies (Physical Items) Table
CREATE TABLE IF NOT EXISTS library_book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  accession_number VARCHAR(100) NOT NULL,
  barcode VARCHAR(100) NOT NULL,
  shelf_rack VARCHAR(100),
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acquisition_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  condition "BookCondition" NOT NULL DEFAULT 'NEW',
  status "BookCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_copy_accession UNIQUE (school_id, accession_number),
  CONSTRAINT uq_lib_copy_barcode UNIQUE (school_id, barcode),
  CONSTRAINT uq_lib_copy_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_lib_copy_book_tenant FOREIGN KEY (book_id, school_id) REFERENCES library_books(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_lib_copy_cost CHECK (acquisition_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lib_copies_book ON library_book_copies (school_id, book_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_status ON library_book_copies (school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_copies_campus ON library_book_copies (school_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_barcode ON library_book_copies (school_id, barcode);

-- 9. Library Loans Table (Circulation Transactions)
CREATE TABLE IF NOT EXISTS library_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE RESTRICT,
  borrower_type "BorrowerType" NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  issued_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  returned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  renewal_count INT NOT NULL DEFAULT 0,
  last_renewed_at TIMESTAMPTZ,
  status "LoanStatus" NOT NULL DEFAULT 'ISSUED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_loan_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_lib_loan_copy_tenant FOREIGN KEY (copy_id, school_id) REFERENCES library_book_copies(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_lib_loan_borrower CHECK (
    (borrower_type = 'STUDENT' AND student_id IS NOT NULL) OR
    (borrower_type = 'EMPLOYEE' AND employee_id IS NOT NULL)
  ),
  CONSTRAINT chk_lib_loan_renewals CHECK (renewal_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lib_loans_school_status ON library_loans (school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_loans_copy ON library_loans (school_id, copy_id);
CREATE INDEX IF NOT EXISTS idx_lib_loans_student ON library_loans (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lib_loans_employee ON library_loans (school_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_lib_loans_due_date ON library_loans (school_id, due_date);

-- Partial Unique Index: A single physical book copy CANNOT be actively loaned to two borrowers concurrently
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_copy_loan ON library_loans (copy_id) WHERE status IN ('ISSUED', 'OVERDUE');

-- 10. Library Reservations Table
CREATE TABLE IF NOT EXISTS library_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
  borrower_type "BorrowerType" NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  reservation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  fulfilled_date TIMESTAMPTZ,
  fulfilled_copy_id UUID REFERENCES library_book_copies(id) ON DELETE SET NULL,
  status "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_res_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_lib_res_book_tenant FOREIGN KEY (book_id, school_id) REFERENCES library_books(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_lib_res_borrower CHECK (
    (borrower_type = 'STUDENT' AND student_id IS NOT NULL) OR
    (borrower_type = 'EMPLOYEE' AND employee_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lib_res_book ON library_reservations (school_id, book_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_res_student ON library_reservations (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lib_res_employee ON library_reservations (school_id, employee_id);

-- Partial Unique Indexes: Prevent duplicate active reservations for the same borrower on the same book
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_student_reservation ON library_reservations (book_id, student_id) WHERE status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_employee_reservation ON library_reservations (book_id, employee_id) WHERE status = 'PENDING';

-- 11. Library Fines Table
CREATE TABLE IF NOT EXISTS library_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES library_loans(id) ON DELETE SET NULL,
  borrower_type "BorrowerType" NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  fine_type "LibraryFineType" NOT NULL DEFAULT 'OVERDUE',
  overdue_days INT NOT NULL DEFAULT 0,
  daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  calculated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  fine_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  waived_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status "LibraryFineStatus" NOT NULL DEFAULT 'UNPAID',
  student_fee_id UUID REFERENCES student_fees(id) ON DELETE SET NULL,
  assessed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  waived_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  waived_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lib_fine_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_lib_fine_amount CHECK (fine_amount >= 0),
  CONSTRAINT chk_lib_fine_waived CHECK (waived_amount >= 0),
  CONSTRAINT chk_lib_fine_paid CHECK (paid_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lib_fines_school_status ON library_fines (school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_fines_loan ON library_fines (school_id, loan_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_student ON library_fines (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_employee ON library_fines (school_id, employee_id);

-- ============================================================================
-- DOMAIN B: INVENTORY & ASSET MANAGEMENT TABLES
-- ============================================================================

-- 12. Inventory Categories Table
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  item_type "InventoryItemType" NOT NULL DEFAULT 'CONSUMABLE',
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_cat_code UNIQUE (school_id, code),
  CONSTRAINT uq_inv_cat_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_cat_school_status ON inventory_categories (school_id, status);

-- 13. Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE RESTRICT,
  item_code VARCHAR(50) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150),
  item_type "InventoryItemType" NOT NULL DEFAULT 'CONSUMABLE',
  stock_unit "StockUnit" NOT NULL DEFAULT 'PCS',
  min_stock_level INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_item_code UNIQUE (school_id, item_code),
  CONSTRAINT uq_inv_item_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_inv_item_cat_tenant FOREIGN KEY (category_id, school_id) REFERENCES inventory_categories(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_inv_min_stock CHECK (min_stock_level >= 0),
  CONSTRAINT chk_inv_reorder CHECK (reorder_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_items_school_status ON inventory_items (school_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_items_category ON inventory_items (school_id, category_id);

-- 14. Inventory Suppliers Table
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  supplier_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  company_name VARCHAR(150),
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_supplier_code UNIQUE (school_id, supplier_code),
  CONSTRAINT uq_inv_supplier_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_suppliers_school ON inventory_suppliers (school_id, status);

-- 15. Inventory Purchases Table
CREATE TABLE IF NOT EXISTS inventory_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,
  purchase_number VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(100),
  purchase_date DATE NOT NULL,
  received_date DATE,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status "PurchaseStatus" NOT NULL DEFAULT 'ORDERED',
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_purchase_num UNIQUE (school_id, purchase_number),
  CONSTRAINT uq_inv_purchase_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_inv_purchase_supplier_tenant FOREIGN KEY (supplier_id, school_id) REFERENCES inventory_suppliers(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_inv_purchase_amount CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_purchases_school ON inventory_purchases (school_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_purchases_supplier ON inventory_purchases (school_id, supplier_id);

-- 16. Inventory Purchase Items Table
CREATE TABLE IF NOT EXISTS inventory_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES inventory_purchases(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL,
  received_quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_purchase_item_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_inv_pi_purchase_tenant FOREIGN KEY (purchase_id, school_id) REFERENCES inventory_purchases(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_pi_item_tenant FOREIGN KEY (item_id, school_id) REFERENCES inventory_items(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_inv_pi_qty CHECK (quantity > 0),
  CONSTRAINT chk_inv_pi_cost CHECK (unit_cost >= 0 AND total_cost >= 0),
  CONSTRAINT chk_inv_pi_recv CHECK (received_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_pi_purchase ON inventory_purchase_items (school_id, purchase_id);
CREATE INDEX IF NOT EXISTS idx_inv_pi_item ON inventory_purchase_items (school_id, item_id);

-- 17. Stock Movements Table (Immutable Stock Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  movement_type "StockMovementType" NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  source_campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  destination_campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  recipient_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_stock_movement_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_stock_mov_item_tenant FOREIGN KEY (item_id, school_id) REFERENCES inventory_items(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_stock_mov_qty CHECK (quantity > 0),
  CONSTRAINT chk_stock_mov_costs CHECK (unit_cost >= 0 AND total_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_item_campus ON stock_movements (school_id, item_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type ON stock_movements (school_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_mov_date ON stock_movements (school_id, created_at);

-- 18. Inventory Transfers Table
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  transfer_number VARCHAR(50) NOT NULL,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  source_campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  destination_campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  initiated_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_transfer_num UNIQUE (school_id, transfer_number),
  CONSTRAINT uq_inv_transfer_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_inv_trans_item_tenant FOREIGN KEY (item_id, school_id) REFERENCES inventory_items(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_inv_trans_qty CHECK (quantity > 0),
  CONSTRAINT chk_inv_trans_different_campuses CHECK (source_campus_id <> destination_campus_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_trans_school ON inventory_transfers (school_id, item_id);

-- 19. Tracked Assets Table (Individual Capital Asset Registry)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  asset_code VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100),
  barcode VARCHAR(100),
  model_number VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  warranty_expiry DATE,
  current_condition "AssetCondition" NOT NULL DEFAULT 'NEW',
  status "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  location_classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  room_location VARCHAR(150),
  disposal_date DATE,
  disposal_reason TEXT,
  disposal_value DECIMAL(12, 2),
  disposed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asset_code UNIQUE (school_id, asset_code),
  CONSTRAINT uq_asset_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_asset_item_tenant FOREIGN KEY (item_id, school_id) REFERENCES inventory_items(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_asset_cost CHECK (purchase_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assets_school_status ON assets (school_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_item ON assets (school_id, item_id);
CREATE INDEX IF NOT EXISTS idx_assets_campus ON assets (school_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_assets_employee ON assets (school_id, assigned_employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_serial ON assets (school_id, serial_number) WHERE serial_number IS NOT NULL AND serial_number <> '';

-- 20. Asset Assignments Table (Assignment History Ledger)
CREATE TABLE IF NOT EXISTS asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  location_name VARCHAR(150),
  assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_date TIMESTAMPTZ,
  condition_on_assignment "AssetCondition" NOT NULL DEFAULT 'GOOD',
  condition_on_return "AssetCondition",
  assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asset_assign_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_asset_assign_asset_tenant FOREIGN KEY (asset_id, school_id) REFERENCES assets(id, school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_assign_asset ON asset_assignments (school_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assign_employee ON asset_assignments (school_id, employee_id);

-- 21. Asset Maintenance Logs Table
CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(100) NOT NULL,
  service_date DATE NOT NULL,
  vendor_name VARCHAR(150),
  issue_description TEXT,
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  next_service_date DATE,
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asset_maint_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_asset_maint_asset_tenant FOREIGN KEY (asset_id, school_id) REFERENCES assets(id, school_id) ON DELETE CASCADE,
  CONSTRAINT chk_asset_maint_cost CHECK (cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON asset_maintenance_logs (school_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_date ON asset_maintenance_logs (school_id, service_date);

-- ============================================================================
-- 22. Enable & Force Row-Level Security (RLS) on all 19 Phase 10 Tables
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  phase10_tables TEXT[] := ARRAY[
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
    'asset_maintenance_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY phase10_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation_policy ON %I
      FOR ALL
      USING (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::UUID)
      WITH CHECK (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::UUID);
    ', tbl);
  END LOOP;
END $$;

-- 23. Grant Permissions to Unprivileged edusmart_app_user
DO $$
BEGIN
  BEGIN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
