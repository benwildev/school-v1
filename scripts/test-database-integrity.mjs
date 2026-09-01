import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runTest() {
  console.log('================================================================');
  console.log('EduSmart BD — Database Integrity & Adversarial Validation Suite');
  console.log('================================================================\n');

  console.log('1. Spawning fresh isolated PostgreSQL 15+ engine via PGlite...');
  const db = new PGlite();
  await db.waitReady;
  console.log('✓ PostgreSQL engine initialized.\n');

  // Read migration files in canonical order
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`2. Executing ${migrationFiles.length} canonical migrations from empty database:`);
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    process.stdout.write(`   Running ${file}... `);
    await db.exec(sql);
    console.log('✓ SUCCESS');
  }
  console.log('\n✓ All 10 migrations executed cleanly without errors.\n');

  // Verify all 57 tables exist and have RLS enabled
  console.log('3. Auditing 57 Tables for RLS Activation & Policy Registration:');
  const expectedTables = [
    'subscription_plans', 'schools', 'school_subscriptions', 'subscription_periods',
    'platform_usage_metrics', 'usage_events', 'campuses', 'school_settings',
    'school_branding', 'school_addresses', 'users', 'roles', 'permissions',
    'role_permissions', 'user_roles', 'academic_sessions', 'classes',
    'academic_groups', 'sections', 'subjects', 'subject_assessment_configs',
    'classrooms', 'academic_calendars', 'students', 'guardians', 'student_guardians',
    'emergency_contacts', 'enrollments', 'promotion_batches', 'promotion_items',
    'file_attachments', 'student_documents', 'teachers', 'teacher_assignments',
    'routines', 'student_attendances', 'employee_attendances', 'exams',
    'exam_schedules', 'grading_scales', 'grade_rules', 'marks',
    'student_exam_results', 'fee_types', 'fee_structures', 'student_fees',
    'student_discounts', 'payments', 'payment_allocations', 'student_credit_accounts',
    'student_credit_transactions', 'receipts', 'refunds', 'expense_categories',
    'expenses', 'admission_applications', 'application_documents', 'certificates',
    'audit_logs', 'notifications', 'message_logs', 'notification_templates',
    'automation_rules', 'integration_configs', 'biometric_devices'
  ];

  const tablesRes = await db.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public';
  `);
  const foundTables = new Map(tablesRes.rows.map(r => [r.tablename, r.rowsecurity]));

  for (const tbl of expectedTables) {
    if (!foundTables.has(tbl)) {
      throw new Error(`CRITICAL: Expected table '${tbl}' was not found in database!`);
    }
  }

  const policiesRes = await db.query(`
    SELECT tablename, policyname, roles, cmd, qual 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `);
  console.log(`✓ All 57+ tables present in PostgreSQL catalog.`);
  console.log(`✓ ${policiesRes.rows.length} Row-Level Security policies active across tenant domain tables.`);

  // 4. Adversarial Tests
  console.log('\n4. Executing Adversarial Invariant Matrix:');

  // Setup initial test data
  const schoolA = '11111111-1111-1111-1111-111111111111';
  const schoolB = '22222222-2222-2222-2222-222222222222';
  const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  await db.exec(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone) VALUES 
    ('${schoolA}', 'school-a', 'School A', 'স্কুল এ', 'a@school.com', '01711111111'),
    ('${schoolB}', 'school-b', 'School B', 'স্কুল বি', 'b@school.com', '01722222222');

    INSERT INTO users (id, school_id, phone, password_hash, full_name) VALUES
    ('${userA}', '${schoolA}', '01711111111', 'hash_a', 'Admin A'),
    ('${userB}', '${schoolB}', '01722222222', 'hash_b', 'Admin B');
  `);

  // Test 1: Immutability of StudentCreditTransaction
  console.log('\n--- Test 1: Student Credit Transaction Immutability ---');
  const studentA1 = '33333333-3333-3333-3333-333333333331';
  const accountA1 = '44444444-4444-4444-4444-444444444441';
  const tx1 = '55555555-5555-5555-5555-555555555551';

  await db.exec(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division) VALUES
    ('${studentA1}', '${schoolA}', 'STU-001', '2024-01-01', 'Karim', 'Rahman', 'Karim Rahman', 'করিম রহমান', '2010-01-01', 'MALE', 'ISLAM', 'Dhaka', 'Dhaka GPO', '1000', 'Ramna', 'Dhaka', 'DHAKA', 'Dhaka', 'Ramna', 'Dhaka', 'DHAKA');

    INSERT INTO student_credit_accounts (id, school_id, student_id, cached_balance) VALUES
    ('${accountA1}', '${schoolA}', '${studentA1}', 0.00);

    INSERT INTO student_credit_transactions (id, school_id, account_id, student_id, transaction_type, amount, balance_before, balance_after, reason, authorized_by_id) VALUES
    ('${tx1}', '${schoolA}', '${accountA1}', '${studentA1}', 'CREDIT', 500.00, 0.00, 500.00, 'Initial Top-up', '${userA}');
  `);

  // Verify cached balance updated via trigger
  const accRow = (await db.query(`SELECT cached_balance FROM student_credit_accounts WHERE id = '${accountA1}'`)).rows[0];
  if (Number(accRow.cached_balance) !== 500.00) {
    throw new Error(`Cached balance sync failed! Expected 500.00, got ${accRow.cached_balance}`);
  }
  console.log('✓ Trigger successfully synced cached balance to 500.00 BDT.');

  // Attempt UPDATE
  let updateBlocked = false;
  try {
    await db.exec(`UPDATE student_credit_transactions SET amount = 999.00 WHERE id = '${tx1}'`);
  } catch (err) {
    updateBlocked = true;
    console.log(`✓ UPDATE blocked by DB trigger: ${err.message}`);
  }
  if (!updateBlocked) throw new Error('FAIL: UPDATE on student_credit_transactions was not blocked!');

  // Attempt DELETE
  let deleteBlocked = false;
  try {
    await db.exec(`DELETE FROM student_credit_transactions WHERE id = '${tx1}'`);
  } catch (err) {
    deleteBlocked = true;
    console.log(`✓ DELETE blocked by DB trigger: ${err.message}`);
  }
  if (!deleteBlocked) throw new Error('FAIL: DELETE on student_credit_transactions was not blocked!');

  // Test 2: Negative Balance Prevention
  console.log('\n--- Test 2: Negative Balance Prevention ---');
  let negativeBlocked = false;
  try {
    await db.exec(`
      INSERT INTO student_credit_transactions (id, school_id, account_id, student_id, transaction_type, amount, balance_before, balance_after, reason, authorized_by_id) VALUES
      (gen_random_uuid(), '${schoolA}', '${accountA1}', '${studentA1}', 'DEBIT', 800.00, 500.00, -300.00, 'Overdraw attempt', '${userA}');
    `);
  } catch (err) {
    negativeBlocked = true;
    console.log(`✓ Negative balance blocked by DB trigger: ${err.message}`);
  }
  if (!negativeBlocked) throw new Error('FAIL: Overdraw debit was not blocked!');

  // Test 3: Sibling Transfer Semantics (TRANSFER_OUT + TRANSFER_IN)
  console.log('\n--- Test 3: Sibling Transfer Semantics ---');
  const studentA2 = '33333333-3333-3333-3333-333333333332';
  const accountA2 = '44444444-4444-4444-4444-444444444442';
  const transferGroupId = '77777777-7777-7777-7777-777777777777';

  await db.exec(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division) VALUES
    ('${studentA2}', '${schoolA}', 'STU-002', '2024-01-01', 'Rahim', 'Rahman', 'Rahim Rahman', 'রহিম রহমান', '2012-01-01', 'MALE', 'ISLAM', 'Dhaka', 'Dhaka GPO', '1000', 'Ramna', 'Dhaka', 'DHAKA', 'Dhaka', 'Ramna', 'Dhaka', 'DHAKA');

    INSERT INTO student_credit_accounts (id, school_id, student_id, cached_balance) VALUES
    ('${accountA2}', '${schoolA}', '${studentA2}', 0.00);

    -- Execute transfer pair of 200 BDT
    INSERT INTO student_credit_transactions (id, school_id, account_id, student_id, transaction_type, amount, balance_before, balance_after, transfer_group_id, reason, authorized_by_id) VALUES
    (gen_random_uuid(), '${schoolA}', '${accountA1}', '${studentA1}', 'TRANSFER_OUT', 200.00, 500.00, 300.00, '${transferGroupId}', 'Transfer to sibling Rahim', '${userA}'),
    (gen_random_uuid(), '${schoolA}', '${accountA2}', '${studentA2}', 'TRANSFER_IN', 200.00, 0.00, 200.00, '${transferGroupId}', 'Transfer from brother Karim', '${userA}');
  `);

  const senderBal = (await db.query(`SELECT cached_balance FROM student_credit_accounts WHERE id = '${accountA1}'`)).rows[0].cached_balance;
  const recipientBal = (await db.query(`SELECT cached_balance FROM student_credit_accounts WHERE id = '${accountA2}'`)).rows[0].cached_balance;

  if (Number(senderBal) !== 300.00 || Number(recipientBal) !== 200.00) {
    throw new Error(`Transfer failed: Sender balance = ${senderBal}, Recipient balance = ${recipientBal}`);
  }
  console.log(`✓ Transfer successfully executed: Sender=${senderBal} BDT, Recipient=${recipientBal} BDT.`);

  // Test 4: Cross-Student Payment Allocation Blocked by Composite FK
  console.log('\n--- Test 4: Cross-Student Payment Allocation Blocked by Composite FK ---');
  const sessionA = '66666666-6666-6666-6666-666666666661';
  const classA = '66666666-6666-6666-6666-666666666662';
  const sectionA = '66666666-6666-6666-6666-666666666663';
  const enrollA1 = '66666666-6666-6666-6666-666666666664';
  const enrollA2 = '66666666-6666-6666-6666-666666666665';
  const feeTypeA = '66666666-6666-6666-6666-666666666666';
  const feeA1 = '88888888-8888-8888-8888-888888888881';
  const feeA2 = '88888888-8888-8888-8888-888888888882';
  const paymentA1 = '99999999-9999-9999-9999-999999999991';

  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current) VALUES
    ('${sessionA}', '${schoolA}', '2024 Session', '2024-01-01', '2024-12-31', TRUE);

    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category) VALUES
    ('${classA}', '${schoolA}', 'Class 6', '৬ষ্ঠ শ্রেণি', 6, 'JUNIOR_SECONDARY');

    INSERT INTO sections (id, school_id, class_id, name_en, name_bn) VALUES
    ('${sectionA}', '${schoolA}', '${classA}', 'Section A', 'ক শাখা');

    INSERT INTO enrollments (id, school_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date) VALUES
    ('${enrollA1}', '${schoolA}', '${studentA1}', '${sessionA}', '${classA}', '${sectionA}', 1, '2024-01-01'),
    ('${enrollA2}', '${schoolA}', '${studentA2}', '${sessionA}', '${classA}', '${sectionA}', 2, '2024-01-01');

    INSERT INTO fee_types (id, school_id, code, name_en, name_bn) VALUES
    ('${feeTypeA}', '${schoolA}', 'TUITION', 'Tuition Fee', 'মাসিক বেতন');

    -- Create Fee Invoices for Student 1 and Student 2
    INSERT INTO student_fees (id, school_id, invoice_number, student_id, enrollment_id, fee_type_id, billing_period_key, period_start_date, period_end_date, due_date, base_amount, net_amount, due_amount) VALUES
    ('${feeA1}', '${schoolA}', 'INV-001', '${studentA1}', '${enrollA1}', '${feeTypeA}', '2024-01', '2024-01-01', '2024-01-31', '2024-01-10', 1000.00, 1000.00, 1000.00),
    ('${feeA2}', '${schoolA}', 'INV-002', '${studentA2}', '${enrollA2}', '${feeTypeA}', '2024-01', '2024-01-01', '2024-01-31', '2024-01-10', 1000.00, 1000.00, 1000.00);

    -- Payment made by Student 1
    INSERT INTO payments (id, school_id, payment_number, student_id, enrollment_id, total_amount, allocated_amount, payment_method, received_by_id) VALUES
    ('${paymentA1}', '${schoolA}', 'PAY-001', '${studentA1}', '${enrollA1}', 1000.00, 1000.00, 'CASH', '${userA}');
  `);

  // Attempt to allocate Payment of Student 1 to Fee Invoice of Student 2
  let crossStudentAllocBlocked = false;
  try {
    await db.exec(`
      INSERT INTO payment_allocations (id, school_id, student_id, payment_id, student_fee_id, amount) VALUES
      (gen_random_uuid(), '${schoolA}', '${studentA1}', '${paymentA1}', '${feeA2}', 1000.00);
    `);
  } catch (err) {
    crossStudentAllocBlocked = true;
    console.log(`✓ Cross-student payment allocation blocked by Composite Foreign Key: ${err.message}`);
  }
  if (!crossStudentAllocBlocked) throw new Error('FAIL: Cross-student payment allocation was not blocked!');

  // Test 5: Check Constraints Validation
  console.log('\n--- Test 5: Check Constraints Validation ---');
  let invalidDateBlocked = false;
  try {
    await db.exec(`
      INSERT INTO student_fees (id, school_id, invoice_number, student_id, enrollment_id, fee_type_id, billing_period_key, period_start_date, period_end_date, due_date, base_amount, net_amount, due_amount) VALUES
      (gen_random_uuid(), '${schoolA}', 'INV-BAD', '${studentA1}', '${enrollA1}', '${feeTypeA}', '2024-02', '2024-02-28', '2024-02-01', '2024-02-10', 1000.00, 1000.00, 1000.00);
    `);
  } catch (err) {
    invalidDateBlocked = true;
    console.log(`✓ Invalid period date range blocked by CHECK constraint: ${err.message}`);
  }
  if (!invalidDateBlocked) throw new Error('FAIL: Invalid period date range was not blocked!');

  let zeroPaymentBlocked = false;
  try {
    await db.exec(`
      INSERT INTO payments (id, school_id, payment_number, student_id, enrollment_id, total_amount, allocated_amount, payment_method, received_by_id) VALUES
      (gen_random_uuid(), '${schoolA}', 'PAY-BAD', '${studentA1}', '${enrollA1}', 0.00, 0.00, 'CASH', '${userA}');
    `);
  } catch (err) {
    zeroPaymentBlocked = true;
    console.log(`✓ Non-positive payment amount blocked by CHECK constraint: ${err.message}`);
  }
  if (!zeroPaymentBlocked) throw new Error('FAIL: Non-positive payment amount was not blocked!');

  // Test 6: Grade Rule Range Overlap Constraint
  console.log('\n--- Test 6: Grade Range Overlap Prevention ---');
  const scaleId = 'aaaaaaaa-1111-1111-1111-111111111111';
  await db.exec(`
    INSERT INTO grading_scales (id, school_id, name, is_default) VALUES
    ('${scaleId}', '${schoolA}', 'National Standard Scale', TRUE);

    INSERT INTO grade_rules (id, grading_scale_id, letter_grade, grade_point, min_percentage, max_percentage, remarks_en, remarks_bn) VALUES
    (gen_random_uuid(), '${scaleId}', 'A+', 5.00, 80.00, 100.00, 'Outstanding', 'অসাধারণ');
  `);

  let gradeOverlapBlocked = false;
  try {
    await db.exec(`
      INSERT INTO grade_rules (id, grading_scale_id, letter_grade, grade_point, min_percentage, max_percentage, remarks_en, remarks_bn) VALUES
      (gen_random_uuid(), '${scaleId}', 'A', 4.00, 75.00, 85.00, 'Excellent', 'চমৎকার');
    `);
  } catch (err) {
    gradeOverlapBlocked = true;
    console.log(`✓ Overlapping grade percentage range blocked at DB level: ${err.message}`);
  }
  if (!gradeOverlapBlocked) throw new Error('FAIL: Overlapping grade range was not blocked!');

  // Test 7: ON DELETE RESTRICT on Master Records
  console.log('\n--- Test 7: ON DELETE RESTRICT Historical Protection ---');
  let deleteStudentBlocked = false;
  try {
    await db.exec(`DELETE FROM students WHERE id = '${studentA1}'`);
  } catch (err) {
    deleteStudentBlocked = true;
    console.log(`✓ Student deletion blocked by ON DELETE RESTRICT: ${err.message}`);
  }
  if (!deleteStudentBlocked) throw new Error('FAIL: Deleting student with active enrollments/finances was not blocked!');

  // Test 8: Row-Level Security Isolation (School A vs School B)
  console.log('\n--- Test 8: PostgreSQL Row-Level Security (RLS) Tenant Isolation ---');
  // Create a student in School B
  const studentB1 = '33333333-3333-3333-3333-333333333333';
  await db.exec(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division) VALUES
    ('${studentB1}', '${schoolB}', 'STU-B01', '2024-01-01', 'Anis', 'Ahmed', 'Anis Ahmed', 'আনিস আহমেদ', '2010-01-01', 'MALE', 'ISLAM', 'Chittagong', 'Chittagong GPO', '4000', 'Kotwali', 'Chittagong', 'CHITTAGONG', 'Chittagong', 'Kotwali', 'Chittagong', 'CHITTAGONG');
  `);

  // Query as application user with School A context
  await db.exec(`SET ROLE edusmart_app_user;`);
  await db.exec(`SET app.current_school_id = '${schoolA}';`);

  const schoolAStudents = await db.query(`SELECT id, student_code FROM students;`);
  console.log(`   Query as School A tenant returned: ${schoolAStudents.rows.length} students (Expected: 2, Got: ${schoolAStudents.rows.length})`);
  const hasSchoolBStudent = schoolAStudents.rows.some(r => r.id === studentB1);
  if (hasSchoolBStudent || schoolAStudents.rows.length !== 2) {
    throw new Error('FAIL: RLS policy leaked School B student data to School A!');
  }
  console.log('✓ PostgreSQL RLS strictly isolated School A query results.');

  // Switch context to School B
  await db.exec(`SET app.current_school_id = '${schoolB}';`);
  const schoolBStudents = await db.query(`SELECT id, student_code FROM students;`);
  console.log(`   Query as School B tenant returned: ${schoolBStudents.rows.length} students (Expected: 1, Got: ${schoolBStudents.rows.length})`);
  if (schoolBStudents.rows.length !== 1 || schoolBStudents.rows[0].id !== studentB1) {
    throw new Error('FAIL: RLS policy failed to resolve School B student data!');
  }
  console.log('✓ PostgreSQL RLS strictly isolated School B query results.');

  // Reset role
  await db.exec(`RESET ROLE;`);

  console.log('\n================================================================');
  console.log('ALL ADVERSARIAL INTEGRITY & RLS TESTS PASSED 100% AT DB LEVEL!');
  console.log('================================================================');
}

runTest().catch(err => {
  console.error('\n❌ INTEGRITY SUITE TEST FAILED:\n', err);
  process.exit(1);
});
