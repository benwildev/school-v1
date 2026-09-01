-- ============================================================================
-- Migration 0009: Check Constraints & Immutability/Synchronization Triggers
-- ============================================================================

-- 1. PostgreSQL Check Constraints for Mathematical & Domain Consistency
ALTER TABLE payments
  ADD CONSTRAINT chk_payment_total_amount_positive CHECK (total_amount > 0),
  ADD CONSTRAINT chk_payment_allocated_amount_non_negative CHECK (allocated_amount >= 0),
  ADD CONSTRAINT chk_payment_advance_credit_non_negative CHECK (advance_credit_amount >= 0),
  ADD CONSTRAINT chk_payment_equation_balance CHECK (total_amount = allocated_amount + advance_credit_amount);

ALTER TABLE payment_allocations
  ADD CONSTRAINT chk_payment_allocation_amount_positive CHECK (amount > 0);

ALTER TABLE student_fees
  ADD CONSTRAINT chk_fee_period_dates CHECK (period_start_date <= period_end_date),
  ADD CONSTRAINT chk_fee_base_amount_non_negative CHECK (base_amount >= 0),
  ADD CONSTRAINT chk_fee_discount_amount_non_negative CHECK (discount_amount >= 0),
  ADD CONSTRAINT chk_fee_fine_amount_non_negative CHECK (fine_amount >= 0),
  ADD CONSTRAINT chk_fee_net_amount_non_negative CHECK (net_amount >= 0),
  ADD CONSTRAINT chk_fee_paid_amount_non_negative CHECK (paid_amount >= 0),
  ADD CONSTRAINT chk_fee_due_amount_non_negative CHECK (due_amount >= 0),
  ADD CONSTRAINT chk_fee_net_formula CHECK (net_amount = (base_amount + fine_amount - discount_amount)),
  ADD CONSTRAINT chk_fee_due_formula CHECK (due_amount = (net_amount - paid_amount));

ALTER TABLE student_discounts
  ADD CONSTRAINT chk_discount_value_positive CHECK (discount_value > 0);

ALTER TABLE grade_rules
  ADD CONSTRAINT chk_grade_rule_percentage_bounds 
    CHECK (min_percentage >= 0 AND max_percentage <= 100 AND min_percentage <= max_percentage);

ALTER TABLE marks
  ADD CONSTRAINT chk_marks_non_negative 
    CHECK (theory_obtained >= 0 AND mcq_obtained >= 0 AND practical_obtained >= 0 AND viva_obtained >= 0 AND ca_obtained >= 0 AND total_obtained >= 0);

ALTER TABLE student_credit_transactions
  ADD CONSTRAINT chk_credit_tx_amount_positive CHECK (amount > 0);

ALTER TABLE refunds
  ADD CONSTRAINT chk_refund_amount_positive CHECK (amount > 0);

-- 2. Grade Rule Overlap Trigger (Ensures 100% DB-level check across all PG engines)
CREATE OR REPLACE FUNCTION app.check_grade_rule_overlap() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM grade_rules
    WHERE grading_scale_id = NEW.grading_scale_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND numrange(min_percentage, max_percentage, '[]') && numrange(NEW.min_percentage, NEW.max_percentage, '[]')
  ) THEN
    RAISE EXCEPTION 'Grade rule percentage range [% - %] overlaps with an existing rule in grading scale %.', NEW.min_percentage, NEW.max_percentage, NEW.grading_scale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_grade_rule_overlap ON grade_rules;
CREATE TRIGGER trg_check_grade_rule_overlap
BEFORE INSERT OR UPDATE ON grade_rules
FOR EACH ROW EXECUTE FUNCTION app.check_grade_rule_overlap();

-- 3. Immutability Trigger for Student Credit Transactions
CREATE OR REPLACE FUNCTION app.prevent_credit_transaction_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'student_credit_transactions table is strictly append-only. UPDATE and DELETE operations are prohibited at database level. Use an ADJUSTMENT or TRANSFER transaction.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_credit_transactions ON student_credit_transactions;
CREATE TRIGGER trg_immutable_credit_transactions
BEFORE UPDATE OR DELETE ON student_credit_transactions
FOR EACH ROW EXECUTE FUNCTION app.prevent_credit_transaction_mutation();

-- 4. Double-Entry Credit Account Cached Balance Synchronization Trigger
CREATE OR REPLACE FUNCTION app.sync_student_credit_cached_balance() RETURNS TRIGGER AS $$
DECLARE
  v_new_balance DECIMAL(12, 2);
BEGIN
  -- Lock the account row for update
  PERFORM 1 FROM student_credit_accounts WHERE id = NEW.account_id FOR UPDATE;

  -- Calculate true ledger sum
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('CREDIT', 'TRANSFER_IN') THEN amount
      WHEN transaction_type IN ('DEBIT', 'REFUND', 'TRANSFER_OUT') THEN -amount
      WHEN transaction_type = 'ADJUSTMENT' THEN amount
      ELSE 0
    END
  ), 0.00)
  INTO v_new_balance
  FROM student_credit_transactions
  WHERE account_id = NEW.account_id;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Transaction rejected: would cause student credit balance to become negative (% BDT).', v_new_balance;
  END IF;

  -- Update cached balance
  UPDATE student_credit_accounts
  SET cached_balance = v_new_balance, updated_at = NOW()
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_credit_balance ON student_credit_transactions;
CREATE TRIGGER trg_sync_student_credit_balance
AFTER INSERT ON student_credit_transactions
FOR EACH ROW EXECUTE FUNCTION app.sync_student_credit_cached_balance();

-- 5. Invoice Balance Synchronization on Payment Allocation
CREATE OR REPLACE FUNCTION app.sync_invoice_paid_amount() RETURNS TRIGGER AS $$
DECLARE
  v_total_paid DECIMAL(12, 2);
  v_net DECIMAL(12, 2);
BEGIN
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_total_paid
  FROM payment_allocations
  WHERE student_fee_id = COALESCE(NEW.student_fee_id, OLD.student_fee_id);

  SELECT net_amount INTO v_net 
  FROM student_fees 
  WHERE id = COALESCE(NEW.student_fee_id, OLD.student_fee_id);

  UPDATE student_fees
  SET 
    paid_amount = v_total_paid,
    due_amount = v_net - v_total_paid,
    status = CASE 
      WHEN v_total_paid >= v_net THEN 'PAID'::"InvoiceStatus"
      WHEN v_total_paid > 0 THEN 'PARTIALLY_PAID'::"InvoiceStatus"
      ELSE 'UNPAID'::"InvoiceStatus"
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.student_fee_id, OLD.student_fee_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_paid_amount ON payment_allocations;
CREATE TRIGGER trg_sync_invoice_paid_amount
AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION app.sync_invoice_paid_amount();
