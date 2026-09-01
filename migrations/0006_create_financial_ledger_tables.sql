-- ============================================================================
-- Migration 0006: Financial Ledger, Credit Wallet & Payments
-- ============================================================================

CREATE TABLE fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150) NOT NULL,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT TRUE,
  is_refundable BOOLEAN NOT NULL DEFAULT FALSE,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_type_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_fee_type_school_code UNIQUE (school_id, code)
);

CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
  due_day_of_month INT NOT NULL DEFAULT 10,
  late_fine_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_structure_id_school UNIQUE (id, school_id)
);

CREATE TABLE student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
  billing_period_type "BillingPeriodType" NOT NULL DEFAULT 'MONTHLY',
  billing_period_key VARCHAR(50) NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  base_amount DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  fine_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  net_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(12, 2) NOT NULL,
  status "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  void_reason TEXT,
  voided_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_fee_id_school_student UNIQUE (id, school_id, student_id),
  CONSTRAINT uq_student_fee_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_student_fee_invoice UNIQUE (school_id, invoice_number),
  CONSTRAINT uq_student_fee_period UNIQUE (school_id, enrollment_id, fee_type_id, billing_period_key)
);

CREATE TABLE student_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  fee_type_id UUID REFERENCES fee_types(id) ON DELETE RESTRICT,
  discount_category "DiscountCategory" NOT NULL,
  discount_type "DiscountCalculationType" NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL,
  frequency "DiscountFrequency" NOT NULL DEFAULT 'RECURRING_MONTHLY',
  start_date DATE NOT NULL,
  end_date DATE,
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status "DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
  authorized_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  payment_number VARCHAR(50) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  total_amount DECIMAL(12, 2) NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  advance_credit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  payment_method "PaymentMethod" NOT NULL,
  gateway_provider "PaymentGatewayProvider",
  transaction_id VARCHAR(100),
  bank_name VARCHAR(100),
  bank_branch VARCHAR(100),
  cheque_number VARCHAR(50),
  cheque_date DATE,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
  notes TEXT,
  received_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_id_school_student UNIQUE (id, school_id, student_id),
  CONSTRAINT uq_payment_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_payment_number UNIQUE (school_id, payment_number)
);

CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_allocation UNIQUE (payment_id, student_fee_id)
);

CREATE TABLE student_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  cached_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_credit_account_id_school_student UNIQUE (id, school_id, student_id),
  CONSTRAINT uq_credit_account_id_school UNIQUE (id, school_id)
);

CREATE TABLE student_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES student_credit_accounts(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  transaction_type "CreditTxType" NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  balance_before DECIMAL(12, 2) NOT NULL,
  balance_after DECIMAL(12, 2) NOT NULL,
  reference_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  reference_fee_id UUID REFERENCES student_fees(id) ON DELETE SET NULL,
  reference_refund_id UUID,
  transfer_group_id UUID,
  reason VARCHAR(255) NOT NULL,
  authorized_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(50) NOT NULL,
  payment_id UUID UNIQUE NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  printed_count INT NOT NULL DEFAULT 1,
  CONSTRAINT uq_receipt_number UNIQUE (school_id, receipt_number)
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  refund_number VARCHAR(50) NOT NULL,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  refund_method "PaymentMethod" NOT NULL,
  transaction_ref VARCHAR(100),
  status "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
  approved_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_refund_number UNIQUE (school_id, refund_number)
);

-- Add reference refund FK now that refunds table exists
ALTER TABLE student_credit_transactions
  ADD CONSTRAINT fk_credit_tx_refund
  FOREIGN KEY (reference_refund_id) REFERENCES refunds(id) ON DELETE SET NULL;

CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_expense_cat_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_expense_cat_school_code UNIQUE (school_id, code)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  expense_number VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method "PaymentMethod" NOT NULL,
  receipt_voucher_url TEXT,
  paid_to VARCHAR(150),
  approved_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_expense_number UNIQUE (school_id, expense_number)
);
