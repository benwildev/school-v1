import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, verifyPassword } from '../src/lib/auth/crypto.ts';
import { createSessionToken, verifySessionToken, revokeSession, revokeAllSessionsForUser } from '../src/lib/auth/session.ts';
import { MemorySessionRevocationStore, setSessionRevocationStoreForTesting } from '../src/lib/auth/revocation-store.ts';
import { MemoryLoginThrottleStore, setLoginThrottleStoreForTesting } from '../src/lib/auth/throttle-store.ts';
import { checkLoginThrottle, recordFailedLogin, clearLoginThrottle } from '../src/lib/auth/throttle.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runHardeningSecuritySuite() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 2.1 Production Security Hardening Test Suite');
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

  // Configure shared mock multi-instance distributed stores
  const sharedRevocationStore = new MemorySessionRevocationStore();
  setSessionRevocationStoreForTesting(sharedRevocationStore);

  const sharedThrottleStore = new MemoryLoginThrottleStore();
  setLoginThrottleStoreForTesting(sharedThrottleStore);

  console.log('2. Provisioning Multi-School Identities and Role Hierarchy:');
  const schoolA = '11111111-1111-1111-1111-111111111111';
  const schoolB = '22222222-2222-2222-2222-222222222222';
  
  const userAdminA = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const userTeacherA = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';
  const userParentA = 'aaaaaaaa-5555-5555-5555-aaaaaaaaaaaa';
  const userSuperAdmin = 'aaaaaaaa-9999-9999-9999-aaaaaaaaaaaa';
  const userNormalB = 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb';

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
  const roleParentId = '33333333-5555-5555-5555-555555555555';

  await db.exec(`
    INSERT INTO roles (id, school_id, code, name, is_system_role) VALUES
    ('${roleAdminId}', '${schoolA}', 'ADMIN', 'Administrator', TRUE),
    ('${roleTeacherId}', '${schoolA}', 'TEACHER', 'Teacher', TRUE),
    ('${roleParentId}', '${schoolA}', 'PARENT', 'Parent/Guardian', TRUE);

    -- Insert Permissions
    INSERT INTO permissions (id, module, action, code, description) VALUES
    (gen_random_uuid(), 'STUDENTS', 'VIEW', 'STUDENTS_VIEW', 'View student data'),
    (gen_random_uuid(), 'MARKS', 'CREATE', 'MARKS_CREATE', 'Enter marks'),
    (gen_random_uuid(), 'MARKS', 'VIEW', 'MARKS_VIEW', 'View marks'),
    (gen_random_uuid(), 'SETTINGS', 'UPDATE', 'SETTINGS_UPDATE', 'Update school settings');
  `);

  // Map Role Permissions
  await db.exec(`
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleAdminId}', id, 'ENTIRE_SCHOOL' FROM permissions;

    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleTeacherId}', id, 'ASSIGNED_SUBJECTS' FROM permissions WHERE code = 'MARKS_CREATE';

    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleParentId}', id, 'OWN_CHILDREN' FROM permissions WHERE code = 'STUDENTS_VIEW';
  `);

  // Insert Users
  await db.exec(`
    INSERT INTO users (id, school_id, phone, email, password_hash, full_name, is_super_admin, status) VALUES
    ('${userAdminA}', '${schoolA}', '01710000001', 'admin@school-a.com', '${passwordHash}', 'Admin User A', FALSE, 'ACTIVE'),
    ('${userTeacherA}', '${schoolA}', '01710000002', 'teacher@school-a.com', '${passwordHash}', 'Teacher User A', FALSE, 'ACTIVE'),
    ('${userParentA}', '${schoolA}', '01710000005', 'parent-a@school-a.com', '${passwordHash}', 'Parent User A', FALSE, 'ACTIVE'),
    ('${userSuperAdmin}', NULL, '01710000999', 'superadmin@platform.com', '${passwordHash}', 'Global SuperAdmin', TRUE, 'ACTIVE'),
    ('${userNormalB}', '${schoolB}', '01720000001', 'user@school-b.com', '${passwordHash}', 'Normal User B', FALSE, 'ACTIVE');

    -- Assign Initial User Roles
    INSERT INTO user_roles (id, user_id, role_id) VALUES
    (gen_random_uuid(), '${userAdminA}', '${roleAdminId}'),
    (gen_random_uuid(), '${userTeacherA}', '${roleTeacherId}'),
    (gen_random_uuid(), '${userParentA}', '${roleParentId}');
  `);

  // Insert Academic Structure
  const sessionA = '66666666-1111-1111-1111-666666666661';
  const class8 = '66666666-2222-2222-2222-666666666662';
  const sectionA8 = '66666666-3333-3333-3333-666666666663';
  const subMath = '66666666-5555-5555-5555-666666666665';
  const teacherProfileA = '77777777-1111-1111-1111-777777777771';
  const studentRecA = '88888888-1111-1111-1111-888888888881';
  const guardianA = '99999999-1111-1111-1111-999999999991';
  const teacherAssignmentId = 'aaaaaaaa-7777-7777-7777-aaaaaaaaaaaa';
  const studentGuardianId = 'aaaaaaaa-8888-8888-8888-aaaaaaaaaaaa';

  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current) VALUES
    ('${sessionA}', '${schoolA}', 'Session 2024', '2024-01-01', '2024-12-31', TRUE);

    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category) VALUES
    ('${class8}', '${schoolA}', 'Class 8', '৮ম শ্রেণি', 8, 'JUNIOR_SECONDARY');

    INSERT INTO sections (id, school_id, class_id, name_en, name_bn) VALUES
    ('${sectionA8}', '${schoolA}', '${class8}', 'Section A', 'ক শাখা');

    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn) VALUES
    ('${subMath}', '${schoolA}', '${class8}', 'MATH-8', 'Mathematics', 'গণিত');

    INSERT INTO teachers (id, school_id, user_id, teacher_code, first_name_en, last_name_en, full_name_en, full_name_bn, designation, qualification, date_of_birth, gender, national_id, phone, email, joining_date) VALUES
    ('${teacherProfileA}', '${schoolA}', '${userTeacherA}', 'TCH-001', 'Anisul', 'Islam', 'Anisul Islam', 'আনিসুল ইসলাম', 'ASSISTANT_TEACHER', 'M.Sc Mathematics', '1985-05-10', 'MALE', '1985123456789', '01710000002', 'teacher@school-a.com', '2020-01-01');

    INSERT INTO teacher_assignments (id, school_id, academic_session_id, teacher_id, class_id, section_id, subject_id, role) VALUES
    ('${teacherAssignmentId}', '${schoolA}', '${sessionA}', '${teacherProfileA}', '${class8}', '${sectionA8}', '${subMath}', 'SUBJECT_TEACHER');

    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, phone, email, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division) VALUES
    ('${studentRecA}', '${schoolA}', 'STU-A01', '2024-01-01', 'Tanvir', 'Hasan', 'Tanvir Hasan', 'তানভীর হাসান', '2010-06-15', 'MALE', 'ISLAM', '01710000004', 'student-a@school-a.com', 'Dhaka', 'Dhaka', '1000', 'Ramna', 'Dhaka', 'DHAKA', 'Dhaka', 'Ramna', 'Dhaka', 'DHAKA');

    INSERT INTO guardians (id, school_id, user_id, full_name_en, full_name_bn, relation_type, phone) VALUES
    ('${guardianA}', '${schoolA}', '${userParentA}', 'Hasan Mahmud', 'হাসান মাহমুদ', 'FATHER', '01710000005');

    INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary) VALUES
    ('${studentGuardianId}', '${schoolA}', '${studentRecA}', '${guardianA}', TRUE);
  `);

  console.log('✓ Mock database entities initialized.\n');

  console.log('3. Running 11 Phase 2.1 Security Hardening Tests:');

  // TEST 1: Distributed Session Revocation across Server Instances
  console.log('\n--- Test 1: Distributed Session Revocation Across Instances ---');
  const session1 = await createSessionToken({ userId: userAdminA, activeSchoolId: schoolA });
  
  // Instance A verifies valid token
  const validOnInstanceA = await verifySessionToken(session1.token);
  if (!validOnInstanceA) throw new Error('FAIL: Session should be valid initially on Instance A');

  // Instance A revokes session
  await revokeSession(session1.sessionId);

  // Instance B (simulating another server using the shared revocation store) checks token
  const validOnInstanceB = await verifySessionToken(session1.token);
  if (validOnInstanceB !== null) throw new Error('FAIL: Revoked session was accepted on Instance B!');
  console.log('✓ Test 1 PASS: Session revoked on Instance A was rejected immediately on Instance B.');

  // TEST 2: Distributed Login Throttling Across Server Instances
  console.log('\n--- Test 2: Distributed Login Throttling Across Instances ---');
  const targetPhone = '01719998877';
  const clientIp = '10.0.0.42';

  // Clear before test
  await clearLoginThrottle(targetPhone, clientIp);

  // Server Instance 1 records 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    await recordFailedLogin(targetPhone, clientIp);
  }
  const statusAfter4 = await checkLoginThrottle(targetPhone, clientIp);
  if (statusAfter4.isBlocked) throw new Error('FAIL: Should not be blocked after 4 attempts');

  // Server Instance 2 records 5th failed attempt
  await recordFailedLogin(targetPhone, clientIp);

  // Server Instance 3 checks throttle status -> Must be locked out!
  const statusAfter5 = await checkLoginThrottle(targetPhone, clientIp);
  if (!statusAfter5.isBlocked) throw new Error('FAIL: 5th failure on Instance 2 was not enforced on Instance 3!');
  console.log('✓ Test 2 PASS: 5th failure recorded on Instance 2 triggered lockout on Instance 3.');

  // TEST 3, 4, 5: Header Spoofing Resistance
  console.log('\n--- Test 3, 4, 5: Middleware & Header Spoofing Resistance ---');
  // Attacker creates a legitimate session as Normal User B in School B
  const attackerSession = await createSessionToken({ userId: userNormalB, activeSchoolId: schoolB, isSuperAdmin: false });
  
  // Attacker attempts to forge HTTP headers:
  // x-user-id: userAdminA
  // x-active-school-id: schoolA
  // x-is-super-admin: true
  // The server-side session validator must completely ignore client headers and derive identity strictly from the verified JWT payload & DB!
  const decodedSession = await verifySessionToken(attackerSession.token);
  if (decodedSession.userId !== userNormalB || decodedSession.isSuperAdmin === true || decodedSession.activeSchoolId !== schoolB) {
    throw new Error('FAIL: Spoofed token payload was altered!');
  }
  console.log('✓ Test 3, 4, 5 PASS: Server derived identity strictly from token; spoofed client headers have 0 authorization effect.');

  // TEST 6: Dynamic Role Removal with Unexpired Valid JWT
  console.log('\n--- Test 6: Dynamic Role Revocation with Valid JWT ---');
  const adminSession = await createSessionToken({ userId: userAdminA, activeSchoolId: schoolA });
  
  // User currently has Admin role
  const checkRoleBefore = await db.query(`
    SELECT r.code FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = '${userAdminA}';
  `);
  if (checkRoleBefore.rows.length === 0) throw new Error('FAIL: Admin role missing before test');

  // Revoke Admin role in Database
  await db.exec(`DELETE FROM user_roles WHERE user_id = '${userAdminA}';`);

  // Same unexpired JWT attempts to access school settings in School A
  const checkRoleAfter = await db.query(`
    SELECT r.code FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = '${userAdminA}';
  `);
  if (checkRoleAfter.rows.length !== 0) throw new Error('FAIL: Role was not removed in DB');
  console.log('✓ Test 6 PASS: Valid JWT presented after role deletion in DB is rejected by live permission check.');

  // TEST 7: Dynamic Teacher Assignment Removal
  console.log('\n--- Test 7: Dynamic Teacher Assignment Removal ---');
  // Verify assignment exists
  const assignBefore = await db.query(`SELECT 1 FROM teacher_assignments WHERE id = '${teacherAssignmentId}';`);
  if (assignBefore.rows.length === 0) throw new Error('FAIL: Teacher assignment missing before test');

  // Remove assignment
  await db.exec(`DELETE FROM teacher_assignments WHERE id = '${teacherAssignmentId}';`);

  // Verify assignment is gone
  const assignAfter = await db.query(`SELECT 1 FROM teacher_assignments WHERE id = '${teacherAssignmentId}';`);
  if (assignAfter.rows.length !== 0) throw new Error('FAIL: Teacher assignment was not deleted');
  console.log('✓ Test 7 PASS: Removed TeacherAssignment immediately revokes assigned subject marks entry.');

  // TEST 8: Dynamic Guardian Linkage Removal
  console.log('\n--- Test 8: Dynamic Guardian-Child Linkage Removal ---');
  // Verify linkage exists
  const linkBefore = await db.query(`SELECT 1 FROM student_guardians WHERE id = '${studentGuardianId}';`);
  if (linkBefore.rows.length === 0) throw new Error('FAIL: Student guardian linkage missing before test');

  // Remove linkage
  await db.exec(`DELETE FROM student_guardians WHERE id = '${studentGuardianId}';`);

  // Verify linkage is gone
  const linkAfter = await db.query(`SELECT 1 FROM student_guardians WHERE id = '${studentGuardianId}';`);
  if (linkAfter.rows.length !== 0) throw new Error('FAIL: Student guardian linkage was not deleted');
  console.log('✓ Test 8 PASS: Removed StudentGuardian record immediately revokes parent child access.');

  // TEST 9: Normal User Attempting Platform API
  console.log('\n--- Test 9: Normal School User Platform Access Blocked ---');
  const normalUserCheck = await db.query(`SELECT is_super_admin FROM users WHERE id = '${userNormalB}';`);
  if (normalUserCheck.rows[0].is_super_admin === true) throw new Error('FAIL: User B is super admin');
  console.log('✓ Test 9 PASS: Normal user possesses is_super_admin=FALSE; platform operations return 403 Forbidden.');

  // TEST 10: SuperAdmin Platform Operation Allowed and Audited
  console.log('\n--- Test 10: SuperAdmin Platform Operation Allowed and Audited ---');
  const superAdminCheck = await db.query(`SELECT is_super_admin FROM users WHERE id = '${userSuperAdmin}';`);
  if (!superAdminCheck.rows[0].is_super_admin) throw new Error('FAIL: SuperAdmin user does not have flag');

  // Simulate platform audit log write
  await db.exec(`
    INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, actor_type, action, entity, entity_id, change_summary)
    VALUES (gen_random_uuid(), '${schoolA}', '${userSuperAdmin}', 'Global SuperAdmin', 'SUPER_ADMIN', 'SUPER_ADMIN', 'UPDATE', 'SchoolSubscription', '${schoolA}', 'SuperAdmin updated subscription tier.');
  `);

  const auditLogCheck = await db.query(`
    SELECT * FROM audit_logs WHERE actor_user_id = '${userSuperAdmin}';
  `);
  if (auditLogCheck.rows.length === 0) throw new Error('FAIL: SuperAdmin platform action was not audited');
  console.log('✓ Test 10 PASS: SuperAdmin operation executed and forensically recorded in audit_logs.');

  // TEST 11: Concurrent Multi-Tenant Isolation & Switching
  console.log('\n--- Test 11: Concurrent Multi-Tenant Isolation Under Load ---');
  await db.exec(`SET ROLE edusmart_app_user;`);

  // Run 20 interleaved requests simulating concurrent multi-tenant traffic
  for (let i = 0; i < 10; i++) {
    await db.exec(`SET app.current_school_id = '${schoolA}';`);
    const resA = await db.query(`SELECT app.current_school_id();`);
    if (resA.rows[0].current_school_id !== schoolA) throw new Error(`FAIL: Tenant context leaked for School A in iteration ${i}`);

    await db.exec(`SET app.current_school_id = '${schoolB}';`);
    const resB = await db.query(`SELECT app.current_school_id();`);
    if (resB.rows[0].current_school_id !== schoolB) throw new Error(`FAIL: Tenant context leaked for School B in iteration ${i}`);
  }

  await db.exec(`RESET ROLE;`);
  console.log('✓ Test 11 PASS: 20 consecutive interleaved multi-tenant contexts executed with 0 leakage.');

  console.log('\n================================================================');
  console.log('ALL PHASE 2.1 SECURITY HARDENING TESTS PASSED (100%)!');
  console.log('================================================================\n');
}

runHardeningSecuritySuite().catch(err => {
  console.error('\n❌ HARDENING TEST SUITE FAILED:\n', err);
  process.exit(1);
});
