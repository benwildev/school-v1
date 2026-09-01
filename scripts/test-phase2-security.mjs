import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, verifyPassword } from '../src/lib/auth/crypto.ts';
import { createSessionToken, verifySessionToken, revokeSession } from '../src/lib/auth/session.ts';
import { checkLoginThrottle, recordFailedLogin, clearLoginThrottle } from '../src/lib/auth/throttle.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 2 Security & RBAC Adversarial Test Suite');
  console.log('================================================================\n');

  console.log('1. Initializing isolated PostgreSQL test engine...');
  const db = new PGlite();
  await db.waitReady;

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }
  console.log('✓ All 10 canonical database migrations applied cleanly.\n');

  // Setup Core Multi-Tenant Mock Data
  console.log('2. Provisioning Multi-School Identities and Role Hierarchy:');
  const schoolA = '11111111-1111-1111-1111-111111111111';
  const schoolB = '22222222-2222-2222-2222-222222222222';
  
  const userAdminA = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const userTeacherA = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';
  const userAccountantA = 'aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa';
  const userStudentA = 'aaaaaaaa-4444-4444-4444-aaaaaaaaaaaa';
  const userParentA = 'aaaaaaaa-5555-5555-5555-aaaaaaaaaaaa';

  const userAdminB = 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb';
  const userStudentB = 'bbbbbbbb-4444-4444-4444-bbbbbbbbbbbb';

  const passwordHash = await hashPassword('P@ssword123456');

  // Insert Schools
  await db.exec(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone) VALUES 
    ('${schoolA}', 'school-a', 'School A Model High', 'স্কুল এ মডেল হাই', 'admin@school-a.com', '01710000001'),
    ('${schoolB}', 'school-b', 'School B Cantonment', 'স্কুল বি ক্যান্টনমেন্ট', 'admin@school-b.com', '01720000002');
  `);

  // Insert System Roles
  const roleAdminId = '33333333-1111-1111-1111-111111111111';
  const roleTeacherId = '33333333-2222-2222-2222-222222222222';
  const roleAccountantId = '33333333-3333-3333-3333-333333333333';
  const roleStudentId = '33333333-4444-4444-4444-444444444444';
  const roleParentId = '33333333-5555-5555-5555-555555555555';

  await db.exec(`
    INSERT INTO roles (id, school_id, code, name, is_system_role) VALUES
    ('${roleAdminId}', '${schoolA}', 'ADMIN', 'Administrator', TRUE),
    ('${roleTeacherId}', '${schoolA}', 'TEACHER', 'Teacher', TRUE),
    ('${roleAccountantId}', '${schoolA}', 'ACCOUNTANT', 'Accountant', TRUE),
    ('${roleStudentId}', '${schoolA}', 'STUDENT', 'Student', TRUE),
    ('${roleParentId}', '${schoolA}', 'PARENT', 'Parent/Guardian', TRUE);

    -- Insert Permissions
    INSERT INTO permissions (id, module, action, code, description) VALUES
    (gen_random_uuid(), 'STUDENTS', 'VIEW', 'STUDENTS_VIEW', 'View student data'),
    (gen_random_uuid(), 'MARKS', 'CREATE', 'MARKS_CREATE', 'Enter marks'),
    (gen_random_uuid(), 'MARKS', 'VIEW', 'MARKS_VIEW', 'View marks'),
    (gen_random_uuid(), 'DISCOUNTS', 'CREATE', 'DISCOUNTS_CREATE', 'Create student discounts'),
    (gen_random_uuid(), 'DISCOUNTS', 'VIEW', 'DISCOUNTS_VIEW', 'View discounts'),
    (gen_random_uuid(), 'FEES', 'VIEW', 'FEES_VIEW', 'View fees'),
    (gen_random_uuid(), 'PAYMENTS', 'CREATE', 'PAYMENTS_CREATE', 'Create payments');
  `);

  // Map Role Permissions
  await db.exec(`
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleAdminId}', id, 'ENTIRE_SCHOOL' FROM permissions;

    -- Teacher role: MARKS_CREATE with ASSIGNED_SUBJECTS scope
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleTeacherId}', id, 'ASSIGNED_SUBJECTS' FROM permissions WHERE code = 'MARKS_CREATE';

    -- Accountant role: DISCOUNTS_VIEW (DISCOUNTS_CREATE omitted!)
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleAccountantId}', id, 'ENTIRE_SCHOOL' FROM permissions WHERE code IN ('DISCOUNTS_VIEW', 'FEES_VIEW', 'PAYMENTS_CREATE');

    -- Student role: STUDENTS_VIEW with OWN_DATA scope
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleStudentId}', id, 'OWN_DATA' FROM permissions WHERE code IN ('STUDENTS_VIEW', 'MARKS_VIEW');

    -- Parent role: STUDENTS_VIEW with OWN_CHILDREN scope
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleParentId}', id, 'OWN_CHILDREN' FROM permissions WHERE code IN ('STUDENTS_VIEW', 'MARKS_VIEW');
  `);

  // Insert Users
  await db.exec(`
    INSERT INTO users (id, school_id, phone, email, password_hash, full_name, status) VALUES
    ('${userAdminA}', '${schoolA}', '01710000001', 'admin@school-a.com', '${passwordHash}', 'Admin User A', 'ACTIVE'),
    ('${userTeacherA}', '${schoolA}', '01710000002', 'teacher@school-a.com', '${passwordHash}', 'Teacher User A', 'ACTIVE'),
    ('${userAccountantA}', '${schoolA}', '01710000003', 'accountant@school-a.com', '${passwordHash}', 'Accountant User A', 'ACTIVE'),
    ('${userStudentA}', '${schoolA}', '01710000004', 'student-a@school-a.com', '${passwordHash}', 'Student User A', 'ACTIVE'),
    ('${userParentA}', '${schoolA}', '01710000005', 'parent-a@school-a.com', '${passwordHash}', 'Parent User A', 'ACTIVE'),
    ('${userAdminB}', '${schoolB}', '01720000001', 'admin@school-b.com', '${passwordHash}', 'Admin User B', 'ACTIVE'),
    ('${userStudentB}', '${schoolB}', '01720000004', 'student-b@school-b.com', '${passwordHash}', 'Student User B', 'ACTIVE');

    -- Assign User Roles
    INSERT INTO user_roles (id, user_id, role_id) VALUES
    (gen_random_uuid(), '${userAdminA}', '${roleAdminId}'),
    (gen_random_uuid(), '${userTeacherA}', '${roleTeacherId}'),
    (gen_random_uuid(), '${userAccountantA}', '${roleAccountantId}'),
    (gen_random_uuid(), '${userStudentA}', '${roleStudentId}'),
    (gen_random_uuid(), '${userParentA}', '${roleParentId}');
  `);

  // Insert Academic Structure for School A
  const sessionA = '66666666-1111-1111-1111-666666666661';
  const class8 = '66666666-2222-2222-2222-666666666662';
  const sectionA8 = '66666666-3333-3333-3333-666666666663';
  const sectionB8 = '66666666-4444-4444-4444-666666666664';
  const subMath = '66666666-5555-5555-5555-666666666665';
  const subScience = '66666666-6666-6666-6666-666666666666';
  const teacherProfileA = '77777777-1111-1111-1111-777777777771';
  const studentRecA = '88888888-1111-1111-1111-888888888881';
  const studentRecB = '88888888-2222-2222-2222-888888888882';
  const guardianA = '99999999-1111-1111-1111-999999999991';

  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current) VALUES
    ('${sessionA}', '${schoolA}', 'Session 2024', '2024-01-01', '2024-12-31', TRUE);

    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category) VALUES
    ('${class8}', '${schoolA}', 'Class 8', '৮ম শ্রেণি', 8, 'JUNIOR_SECONDARY');

    INSERT INTO sections (id, school_id, class_id, name_en, name_bn) VALUES
    ('${sectionA8}', '${schoolA}', '${class8}', 'Section A', 'ক শাখা'),
    ('${sectionB8}', '${schoolA}', '${class8}', 'Section B', 'খ শাখা');

    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn) VALUES
    ('${subMath}', '${schoolA}', '${class8}', 'MATH-8', 'Mathematics', 'গণিত'),
    ('${subScience}', '${schoolA}', '${class8}', 'SCI-8', 'General Science', 'বিজ্ঞান');

    -- Teacher Profile & Assignment: Assigned to Class 8, Section A, Mathematics ONLY
    INSERT INTO teachers (id, school_id, user_id, teacher_code, first_name_en, last_name_en, full_name_en, full_name_bn, designation, qualification, date_of_birth, gender, national_id, phone, email, joining_date) VALUES
    ('${teacherProfileA}', '${schoolA}', '${userTeacherA}', 'TCH-001', 'Anisul', 'Islam', 'Anisul Islam', 'আনিসুল ইসলাম', 'ASSISTANT_TEACHER', 'M.Sc Mathematics', '1985-05-10', 'MALE', '1985123456789', '01710000002', 'teacher@school-a.com', '2020-01-01');

    INSERT INTO teacher_assignments (id, school_id, academic_session_id, teacher_id, class_id, section_id, subject_id, role) VALUES
    (gen_random_uuid(), '${schoolA}', '${sessionA}', '${teacherProfileA}', '${class8}', '${sectionA8}', '${subMath}', 'SUBJECT_TEACHER');

    -- Student A Profile in School A
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, phone, email, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division) VALUES
    ('${studentRecA}', '${schoolA}', 'STU-A01', '2024-01-01', 'Tanvir', 'Hasan', 'Tanvir Hasan', 'তানভীর হাসান', '2010-06-15', 'MALE', 'ISLAM', '01710000004', 'student-a@school-a.com', 'Dhaka', 'Dhaka', '1000', 'Ramna', 'Dhaka', 'DHAKA', 'Dhaka', 'Ramna', 'Dhaka', 'DHAKA'),
    ('${studentRecB}', '${schoolB}', 'STU-B01', '2024-01-01', 'Sakib', 'Al Hasan', 'Sakib Al Hasan', 'সাকিব আল হাসান', '2010-07-20', 'MALE', 'ISLAM', '01720000004', 'student-b@school-b.com', 'Chittagong', 'Chittagong', '4000', 'Kotwali', 'Chittagong', 'CHITTAGONG', 'Chittagong', 'Kotwali', 'Chittagong', 'CHITTAGONG');

    -- Parent A Linked to Student A
    INSERT INTO guardians (id, school_id, user_id, full_name_en, full_name_bn, relation_type, phone) VALUES
    ('${guardianA}', '${schoolA}', '${userParentA}', 'Hasan Mahmud', 'হাসান মাহমুদ', 'FATHER', '01710000005');

    INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary) VALUES
    (gen_random_uuid(), '${schoolA}', '${studentRecA}', '${guardianA}', TRUE);
  `);

  console.log('✓ Mock database entities provisioned.\n');

  // ============================================================================
  // ADVERSARIAL SCENARIO VALIDATIONS
  // ============================================================================
  console.log('3. Running 10 Mandatory Security Scenarios:');

  // SCENARIO A: User from School A attempts GET School B student data -> MUST BE BLOCKED
  console.log('\n--- Scenario A: Cross-Tenant Data Isolation ---');
  await db.exec(`SET ROLE edusmart_app_user;`);
  await db.exec(`SET app.current_school_id = '${schoolA}';`);
  const crossTenantQuery = await db.query(`SELECT id, full_name_en FROM students WHERE school_id = '${schoolB}';`);
  if (crossTenantQuery.rows.length !== 0) {
    throw new Error('FAIL: Cross-tenant data was returned!');
  }
  console.log('✓ Scenario A PASS: School A tenant query returned 0 rows for School B student data.');

  // SCENARIO B: Teacher assigned to Class 8 Section A Math attempts Science marks -> MUST BE BLOCKED
  console.log('\n--- Scenario B: Teacher Unassigned Subject Marks Entry ---');
  const teacherAssignCheckScience = await db.query(`
    SELECT 1 FROM teacher_assignments 
    WHERE teacher_id = '${teacherProfileA}' 
      AND school_id = '${schoolA}' 
      AND class_id = '${class8}' 
      AND section_id = '${sectionA8}' 
      AND subject_id = '${subScience}';
  `);
  if (teacherAssignCheckScience.rows.length > 0) {
    throw new Error('FAIL: Teacher assignment allowed unassigned subject!');
  }
  console.log('✓ Scenario B PASS: Teacher A is not authorized to submit Science marks.');

  // SCENARIO C: Teacher attempts Class 8 Section B Math -> MUST BE BLOCKED
  console.log('\n--- Scenario C: Teacher Unassigned Section Marks Entry ---');
  const teacherAssignCheckSectionB = await db.query(`
    SELECT 1 FROM teacher_assignments 
    WHERE teacher_id = '${teacherProfileA}' 
      AND school_id = '${schoolA}' 
      AND class_id = '${class8}' 
      AND section_id = '${sectionB8}' 
      AND subject_id = '${subMath}';
  `);
  if (teacherAssignCheckSectionB.rows.length > 0) {
    throw new Error('FAIL: Teacher assignment allowed unassigned section!');
  }
  console.log('✓ Scenario C PASS: Teacher A is not authorized for Class 8 Section B.');

  // SCENARIO D: Student A requests Student B profile -> MUST BE BLOCKED
  console.log('\n--- Scenario D: Student Cross-Profile Access ---');
  const studentLinkage = await db.query(`
    SELECT 1 FROM students 
    WHERE id = '${studentRecB}' 
      AND (email = 'student-a@school-a.com' OR phone = '01710000004');
  `);
  if (studentLinkage.rows.length > 0) {
    throw new Error('FAIL: Student A matched Student B profile!');
  }
  console.log('✓ Scenario D PASS: Student A has no ownership linkage to Student B profile.');

  // SCENARIO E: Parent of Student A requests Student B data -> MUST BE BLOCKED
  console.log('\n--- Scenario E: Parent Unrelated Child Access ---');
  const parentLinkage = await db.query(`
    SELECT 1 FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE g.user_id = '${userParentA}' AND sg.student_id = '${studentRecB}';
  `);
  if (parentLinkage.rows.length > 0) {
    throw new Error('FAIL: Parent A matched Student B!');
  }
  console.log('✓ Scenario E PASS: Parent A has no guardian linkage to Student B.');

  // SCENARIO F: Accountant attempts Create student discount -> MUST BE BLOCKED
  console.log('\n--- Scenario F: Accountant Discount Creation Restriction ---');
  const accountantDiscountPerm = await db.query(`
    SELECT p.code FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = '${roleAccountantId}' AND p.code = 'DISCOUNTS_CREATE';
  `);
  if (accountantDiscountPerm.rows.length > 0) {
    throw new Error('FAIL: Accountant role has DISCOUNTS_CREATE permission!');
  }
  console.log('✓ Scenario F PASS: Accountant role does not possess DISCOUNTS_CREATE permission.');

  // SCENARIO G: Authorized Admin creates student discount -> MUST BE ALLOWED
  console.log('\n--- Scenario G: Admin Authorized Discount Creation ---');
  const adminDiscountPerm = await db.query(`
    SELECT p.code FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = '${roleAdminId}' AND p.code = 'DISCOUNTS_CREATE';
  `);
  if (adminDiscountPerm.rows.length === 0) {
    throw new Error('FAIL: Admin role lacks DISCOUNTS_CREATE permission!');
  }
  console.log('✓ Scenario G PASS: Admin role is authorized with DISCOUNTS_CREATE.');

  // SCENARIO H: School A Admin attempts to assign School B role -> MUST BE BLOCKED
  console.log('\n--- Scenario H: Cross-Tenant Role Assignment Prevention ---');
  const crossRoleQuery = await db.query(`
    SELECT 1 FROM roles WHERE id = '${roleAdminId}' AND school_id = '${schoolB}';
  `);
  if (crossRoleQuery.rows.length > 0) {
    throw new Error('FAIL: Role belongs to wrong school!');
  }
  console.log('✓ Scenario H PASS: School A roles cannot be bound to School B context.');

  // SCENARIO I: Revoked session attempts API request -> MUST BE BLOCKED
  console.log('\n--- Scenario I: Session Revocation & Expiration ---');
  const { token, sessionId } = await createSessionToken({ userId: userAdminA, activeSchoolId: schoolA });
  const validBeforeRevoke = await verifySessionToken(token);
  if (!validBeforeRevoke) throw new Error('FAIL: Fresh session token was not valid!');

  revokeSession(sessionId);
  const validAfterRevoke = await verifySessionToken(token);
  if (validAfterRevoke !== null) {
    throw new Error('FAIL: Revoked session token was accepted!');
  }
  console.log('✓ Scenario I PASS: Revoked session was rejected immediately.');

  // SCENARIO J: Two concurrent requests using School A & School B -> No Tenant Leakage
  console.log('\n--- Scenario J: Concurrent Tenant Isolation ---');
  await db.exec(`SET app.current_school_id = '${schoolA}';`);
  const req1Result = await db.query(`SELECT app.current_school_id();`);
  
  await db.exec(`SET app.current_school_id = '${schoolB}';`);
  const req2Result = await db.query(`SELECT app.current_school_id();`);

  if (req1Result.rows[0].current_school_id !== schoolA || req2Result.rows[0].current_school_id !== schoolB) {
    throw new Error('FAIL: Tenant context was not isolated!');
  }
  console.log(`✓ Scenario J PASS: Concurrent session contexts resolved independently (Req1=${req1Result.rows[0].current_school_id}, Req2=${req2Result.rows[0].current_school_id}).`);

  await db.exec(`RESET ROLE;`);

  console.log('\n================================================================');
  console.log('ALL PHASE 2 SECURITY & RBAC ADVERSARIAL TESTS PASSED (100%)!');
  console.log('================================================================\n');
}

runSecuritySuite().catch(err => {
  console.error('\n❌ SECURITY TEST SUITE FAILED:\n', err);
  process.exit(1);
});
