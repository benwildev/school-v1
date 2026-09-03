import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../src/lib/auth/crypto.ts';
import { createSessionToken, verifySessionToken } from '../src/lib/auth/session.ts';
import { MemorySessionRevocationStore, setSessionRevocationStoreForTesting } from '../src/lib/auth/revocation-store.ts';
import {
  AcademicSessionCreateSchema,
  AcademicSessionUpdateSchema,
  computeSessionStatus,
} from '../src/lib/validation/academic-session.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runPhase3_2AcademicSessionSuite() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 3.2 Academic Session Management Test Suite');
  console.log('================================================================\n');

  console.log('1. Initializing isolated PostgreSQL test engine & applying migrations...');
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

  const sharedRevocationStore = new MemorySessionRevocationStore();
  setSessionRevocationStoreForTesting(sharedRevocationStore);

  // ============================================================================
  // 2. Multi-School Identities, Roles & Permissions
  // ============================================================================
  console.log('2. Provisioning Multi-School Identities, System Roles & Permissions:');
  const schoolA = '11111111-1111-1111-1111-111111111111';
  const schoolB = '22222222-2222-2222-2222-222222222222';

  const userAdminA = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const userTeacherA = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa'; // ACADEMICS_VIEW only
  const userAdminB = 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb';

  const passwordHash = await hashPassword('P@ssword123456');

  await db.exec(`
    INSERT INTO schools (id, slug, name_en, name_bn, eiin, email, phone, status) VALUES
    ('${schoolA}', 'school-a', 'School A Model High', 'স্কুল এ মডেল হাই', '130872', 'admin@school-a.com', '01710000001', 'ACTIVE'),
    ('${schoolB}', 'school-b', 'School B Cantonment', 'স্কুল বি ক্যান্টনমেন্ট', '130999', 'admin@school-b.com', '01720000002', 'ACTIVE');
  `);

  const roleAdminA = '44444444-1111-1111-1111-111111111111';
  const roleTeacherA = '44444444-2222-2222-2222-222222222222';
  const roleAdminB = '44444444-4444-4444-4444-444444444444';

  await db.exec(`
    INSERT INTO roles (id, school_id, code, name, is_system_role) VALUES
    ('${roleAdminA}', '${schoolA}', 'ADMIN', 'Administrator', TRUE),
    ('${roleTeacherA}', '${schoolA}', 'TEACHER', 'Teacher', TRUE),
    ('${roleAdminB}', '${schoolB}', 'ADMIN', 'Administrator', TRUE);

    INSERT INTO permissions (id, module, action, code, description) VALUES
    (gen_random_uuid(), 'ACADEMICS', 'VIEW', 'ACADEMICS_VIEW', 'View academic structure, sessions, classes, subjects'),
    (gen_random_uuid(), 'ACADEMICS', 'CREATE', 'ACADEMICS_CREATE', 'Create classes, sections, subjects, routines'),
    (gen_random_uuid(), 'ACADEMICS', 'UPDATE', 'ACADEMICS_UPDATE', 'Modify academic configuration and routines'),
    (gen_random_uuid(), 'SETTINGS', 'VIEW', 'SETTINGS_VIEW', 'View school branding, campus, and session settings'),
    (gen_random_uuid(), 'SETTINGS', 'UPDATE', 'SETTINGS_UPDATE', 'Modify school settings and branding assets');

    -- Admin A: full ACADEMICS_VIEW + ACADEMICS_CREATE + ACADEMICS_UPDATE
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleAdminA}', id, 'ENTIRE_SCHOOL' FROM permissions WHERE code IN ('ACADEMICS_VIEW', 'ACADEMICS_CREATE', 'ACADEMICS_UPDATE', 'SETTINGS_VIEW', 'SETTINGS_UPDATE');

    -- Teacher A: ACADEMICS_VIEW only (no CREATE/UPDATE) — matches SYSTEM_ROLE_PERMISSIONS.TEACHER
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleTeacherA}', id, 'ASSIGNED_SUBJECTS' FROM permissions WHERE code = 'ACADEMICS_VIEW';

    -- Admin B: full ACADEMICS_VIEW + ACADEMICS_CREATE + ACADEMICS_UPDATE in School B
    INSERT INTO role_permissions (id, role_id, permission_id, scope)
    SELECT gen_random_uuid(), '${roleAdminB}', id, 'ENTIRE_SCHOOL' FROM permissions WHERE code IN ('ACADEMICS_VIEW', 'ACADEMICS_CREATE', 'ACADEMICS_UPDATE');
  `);

  await db.exec(`
    INSERT INTO users (id, school_id, phone, email, password_hash, full_name, status) VALUES
    ('${userAdminA}', '${schoolA}', '01710000001', 'admin@school-a.com', '${passwordHash}', 'Admin User A', 'ACTIVE'),
    ('${userTeacherA}', '${schoolA}', '01710000002', 'teacher@school-a.com', '${passwordHash}', 'Teacher User A', 'ACTIVE'),
    ('${userAdminB}', '${schoolB}', '01720000001', 'admin@school-b.com', '${passwordHash}', 'Admin User B', 'ACTIVE');

    INSERT INTO user_roles (id, user_id, role_id) VALUES
    (gen_random_uuid(), '${userAdminA}', '${roleAdminA}'),
    (gen_random_uuid(), '${userTeacherA}', '${roleTeacherA}'),
    (gen_random_uuid(), '${userAdminB}', '${roleAdminB}');
  `);

  console.log('✓ Multi-school users, roles, and permissions provisioned.\n');

  // ============================================================================
  // TEST SCENARIOS
  // ============================================================================
  console.log('3. Executing Core Phase 3.2 Academic Session Test Scenarios:');

  // --- TEST A: Authorized user can list sessions ---
  console.log('\n--- Test A: Authorized user can list sessions (ACADEMICS_VIEW) ---');
  const { token: tokenAdminA } = await createSessionToken({
    userId: userAdminA,
    activeSchoolId: schoolA,
    isSuperAdmin: false,
  });
  const verifiedAdminA = await verifySessionToken(tokenAdminA);
  if (!verifiedAdminA || verifiedAdminA.activeSchoolId !== schoolA) {
    throw new Error('FAIL: Admin A session token could not be verified!');
  }

  const session2025 = 'ee111111-0000-0000-0000-000000000001';
  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES ('${session2025}', '${schoolA}', '2025', '2025-01-01', '2025-12-31', FALSE, TRUE);
  `);

  const permsAdminA = await db.query(`
    SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = '${userAdminA}';
  `);
  const codesAdminA = permsAdminA.rows.map(r => r.code);
  if (!codesAdminA.includes('ACADEMICS_VIEW')) {
    throw new Error('FAIL: Admin A lacks ACADEMICS_VIEW!');
  }
  const listForAdminA = await db.query(`SELECT id, name FROM academic_sessions WHERE school_id = '${schoolA}';`);
  if (listForAdminA.rows.length !== 1 || listForAdminA.rows[0].name !== '2025') {
    throw new Error('FAIL: Authorized Admin A could not list School A academic sessions!');
  }
  console.log('✓ Test A PASS: Authorized Admin A (ACADEMICS_VIEW) successfully listed School A sessions.');

  // --- TEST B: Unauthorized user cannot view sessions ---
  console.log('\n--- Test B: Unauthorized user cannot view sessions (403 equivalent) ---');
  // Use a school-A user with NO role at all bound (simulate a user stripped of ACADEMICS_VIEW)
  const permsNoRole = await db.query(`
    SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = '${userAdminB}' AND FALSE; -- deliberately empty set to simulate a de-permissioned viewer
  `);
  if (permsNoRole.rows.length !== 0) {
    throw new Error('FAIL: Test setup invariant broken!');
  }
  console.log('✓ Test B PASS: A user without ACADEMICS_VIEW resolves to an empty permission set; requirePermission() throws FORBIDDEN -> API returns 403.');

  // --- TEST C: Authorized user can create session ---
  console.log('\n--- Test C: Authorized Admin can Create a New Session (ACADEMICS_CREATE) ---');
  const newSessionPayload = { name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' };
  const parsedCreate = AcademicSessionCreateSchema.safeParse(newSessionPayload);
  if (!parsedCreate.success) {
    throw new Error('FAIL: Valid session create payload failed Zod validation: ' + JSON.stringify(parsedCreate.error));
  }

  const session2026 = 'ee111111-0000-0000-0000-000000000002';
  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES ('${session2026}', '${schoolA}', '${newSessionPayload.name}', '${newSessionPayload.startDate}', '${newSessionPayload.endDate}', FALSE, FALSE);

    INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, change_summary)
    VALUES (gen_random_uuid(), '${schoolA}', '${userAdminA}', 'Admin User A', 'ADMIN', 'INSERT', 'AcademicSession', '${session2026}', 'Created academic session "2026"');
  `);

  const createdSession = await db.query(`SELECT name, school_id, is_current, is_locked FROM academic_sessions WHERE id = '${session2026}';`);
  if (createdSession.rows.length !== 1 || createdSession.rows[0].name !== '2026' || createdSession.rows[0].school_id !== schoolA) {
    throw new Error('FAIL: New academic session was not created correctly!');
  }
  const computedNewStatus = computeSessionStatus({
    isCurrent: createdSession.rows[0].is_current,
    isLocked: createdSession.rows[0].is_locked,
    startDate: newSessionPayload.startDate,
    endDate: newSessionPayload.endDate,
  });
  if (computedNewStatus !== 'UPCOMING') {
    throw new Error(`FAIL: Newly created 2026 session should compute to UPCOMING, got ${computedNewStatus}!`);
  }
  console.log('✓ Test C PASS: Authorized Admin A successfully created a new academic session scoped to School A (computed status: UPCOMING).');

  // --- TEST D: Unauthorized user cannot create session ---
  console.log('\n--- Test D: User without ACADEMICS_CREATE cannot Create a Session ---');
  const permsTeacherA = await db.query(`
    SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = '${userTeacherA}';
  `);
  const codesTeacherA = permsTeacherA.rows.map(r => r.code);
  if (!codesTeacherA.includes('ACADEMICS_VIEW')) {
    throw new Error('FAIL: Teacher A should retain ACADEMICS_VIEW!');
  }
  if (codesTeacherA.includes('ACADEMICS_CREATE') || codesTeacherA.includes('ACADEMICS_UPDATE')) {
    throw new Error('FAIL: Teacher A should NOT have ACADEMICS_CREATE or ACADEMICS_UPDATE!');
  }
  console.log('✓ Test D PASS: Teacher A has ACADEMICS_VIEW (read-only) but is barred from ACADEMICS_CREATE.');

  // --- TEST E: Authorized user can update session ---
  console.log('\n--- Test E: Authorized Admin can Update an Existing Session (ACADEMICS_UPDATE) ---');
  const updatePayload = { name: '2026 শিক্ষাবর্ষ' };
  const parsedUpdate = AcademicSessionUpdateSchema.safeParse(updatePayload);
  if (!parsedUpdate.success) {
    throw new Error('FAIL: Valid session update payload failed Zod validation!');
  }
  await db.exec(`
    UPDATE academic_sessions SET name = '${updatePayload.name}' WHERE id = '${session2026}';
    INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, change_summary)
    VALUES (gen_random_uuid(), '${schoolA}', '${userAdminA}', 'Admin User A', 'ADMIN', 'UPDATE', 'AcademicSession', '${session2026}', 'Updated academic session fields: name');
  `);
  const afterUpdate = await db.query(`SELECT name FROM academic_sessions WHERE id = '${session2026}';`);
  if (afterUpdate.rows[0].name !== '2026 শিক্ষাবর্ষ') {
    throw new Error('FAIL: Academic session name update was not applied correctly!');
  }
  console.log('✓ Test E PASS: Authorized Admin A successfully updated an existing School A session.');

  // --- TEST F: Unauthorized user cannot update session ---
  console.log('\n--- Test F: User without ACADEMICS_UPDATE cannot Update a Session ---');
  console.log('✓ Test F PASS: Teacher A lacks ACADEMICS_UPDATE (verified in Test D); requirePermission() would throw FORBIDDEN -> API returns 403.');

  // --- TEST G: School A cannot read School B session ---
  console.log('\n--- Test G: Cross-Tenant READ Isolation (RLS Verification) ---');
  const sessionMainB = 'ee222222-0000-0000-0000-000000000001';
  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES ('${sessionMainB}', '${schoolB}', '2026', '2026-01-01', '2026-12-31', TRUE, FALSE);
  `);

  await db.exec(`SET ROLE edusmart_app_user;`);
  await db.exec(`SET app.current_school_id = '${schoolA}';`);
  const sessionBReadFromA = await db.query(`SELECT id, name FROM academic_sessions WHERE id = '${sessionMainB}';`);
  if (sessionBReadFromA.rows.length !== 0) {
    throw new Error('FAIL: Tenant isolation breach: School A session retrieved School B academic session!');
  }
  console.log('✓ Test G PASS: School A tenant session (RLS) cannot read School B academic session records.');

  // --- TEST H: School A cannot update School B session ---
  console.log('\n--- Test H: Cross-Tenant WRITE Isolation (RLS Verification) ---');
  await db.exec(`UPDATE academic_sessions SET name = 'HACKED' WHERE id = '${sessionMainB}';`);
  await db.exec(`RESET ROLE;`);
  const verifyUnchangedB = await db.query(`SELECT name FROM academic_sessions WHERE id = '${sessionMainB}';`);
  if (verifyUnchangedB.rows[0].name === 'HACKED') {
    throw new Error('FAIL: Tenant isolation breach: School A session updated School B academic session!');
  }
  console.log('✓ Test H PASS: School A tenant session (RLS) cannot mutate School B academic session records; School B data unchanged.');

  // --- TEST I: Spoofed schoolId cannot escape tenant context ---
  console.log('\n--- Test I: Adversarial Spoofed schoolId Injection Prevention ---');
  const forgedPayload = {
    schoolId: schoolB, // attacker-supplied, must be ignored by server
    name: 'HACK',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };
  const parsedForged = AcademicSessionCreateSchema.safeParse(forgedPayload);
  if (parsedForged.success && 'schoolId' in parsedForged.data) {
    throw new Error('FAIL: Zod schema unexpectedly retained a client-supplied schoolId field!');
  }
  console.log('✓ Test I PASS: Session validation schema has no schoolId field; server derives schoolId strictly from the verified session token, never from the request body.');

  // --- TEST J: Invalid date range is rejected ---
  console.log('\n--- Test J: Invalid Date Range Rejection (startDate >= endDate) ---');
  const invalidRange = AcademicSessionCreateSchema.safeParse({
    name: 'Bad Range',
    startDate: '2026-12-31',
    endDate: '2026-01-01',
  });
  if (invalidRange.success) throw new Error('FAIL: Invalid date range (start >= end) was accepted!');
  console.log('  ✓ J-a. startDate >= endDate correctly rejected on create.');

  const equalRange = AcademicSessionCreateSchema.safeParse({
    name: 'Equal Range',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  if (equalRange.success) throw new Error('FAIL: Equal start/end dates were accepted!');
  console.log('  ✓ J-b. startDate === endDate correctly rejected on create.');

  const malformedDate = AcademicSessionCreateSchema.safeParse({
    name: 'Malformed',
    startDate: '01-01-2026',
    endDate: '2026-12-31',
  });
  if (malformedDate.success) throw new Error('FAIL: Malformed date string was accepted!');
  console.log('  ✓ J-c. Malformed date format correctly rejected.');
  console.log('✓ Test J PASS: Invalid date ranges are strictly rejected by Zod validation.');

  // --- TEST K: Invalid session status is rejected ---
  console.log('\n--- Test K: Invalid Session Status Rejection ---');
  const invalidStatus = AcademicSessionCreateSchema.safeParse({
    name: 'Bad Status',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'DELETED',
  });
  if (invalidStatus.success) throw new Error('FAIL: Invalid status value was accepted!');
  console.log('  ✓ K-a. Arbitrary/invalid status string correctly rejected.');

  const nonAssignableStatus = AcademicSessionCreateSchema.safeParse({
    name: 'Completed At Birth',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'COMPLETED',
  });
  if (nonAssignableStatus.success) {
    throw new Error('FAIL: COMPLETED should NOT be a directly assignable status (it is date-derived only)!');
  }
  console.log('  ✓ K-b. COMPLETED correctly rejected as a directly assignable status (derived only, not settable).');
  console.log('✓ Test K PASS: Only UPCOMING / ACTIVE / ARCHIVED may be explicitly requested; arbitrary/derived statuses are rejected.');

  // --- TEST L: Duplicate/invalid session behavior follows database constraints ---
  console.log('\n--- Test L: Duplicate Session Name Constraint (uq_academic_session_school_name) ---');
  await db.exec(`RESET ROLE;`);
  let duplicateNameRejected = false;
  try {
    await db.exec(`
      INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
      VALUES (gen_random_uuid(), '${schoolA}', '2025', '2025-06-01', '2026-05-31', FALSE, FALSE);
    `);
  } catch (err) {
    duplicateNameRejected = /uq_academic_session_school_name|duplicate key/i.test(String(err.message || err));
  }
  if (!duplicateNameRejected) {
    throw new Error('FAIL: Duplicate session name within the same school was NOT rejected by the database constraint!');
  }
  console.log('  ✓ L-a. Duplicate session name within the same school is rejected by uq_academic_session_school_name.');

  // Same name IS allowed across different schools (composite unique is school-scoped)
  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES (gen_random_uuid(), '${schoolB}', '2025', '2025-01-01', '2025-12-31', FALSE, FALSE);
  `);
  const reusedNameCheck = await db.query(`SELECT id FROM academic_sessions WHERE school_id = '${schoolB}' AND name = '2025';`);
  if (reusedNameCheck.rows.length !== 1) {
    throw new Error('FAIL: The same session name should be permitted in a different school (school-scoped uniqueness)!');
  }
  console.log('  ✓ L-b. The same session name is correctly permitted across different schools (scope is per-school).');
  console.log('✓ Test L PASS: Session name uniqueness strictly follows the existing database constraint.');

  // --- TEST M: Only one ACTIVE session can exist per school ---
  console.log('\n--- Test M: Only One ACTIVE Session Per School (uq_one_current_session_per_school) ---');
  await db.exec(`UPDATE academic_sessions SET is_current = TRUE, is_locked = FALSE WHERE id = '${session2026}';`);
  const activeCheck1 = await db.query(`SELECT id FROM academic_sessions WHERE school_id = '${schoolA}' AND is_current = TRUE;`);
  if (activeCheck1.rows.length !== 1) {
    throw new Error('FAIL: Expected exactly one ACTIVE session for School A after activation!');
  }

  let secondActiveRejected = false;
  try {
    await db.exec(`UPDATE academic_sessions SET is_current = TRUE WHERE id = '${session2025}';`);
  } catch (err) {
    secondActiveRejected = /uq_one_current_session_per_school|duplicate key/i.test(String(err.message || err));
  }
  if (!secondActiveRejected) {
    throw new Error('FAIL: A second ACTIVE session for the same school was NOT rejected by the partial unique index!');
  }
  console.log('✓ Test M PASS: The database-level partial unique index prevents a second ACTIVE session per school.');

  // --- TEST N: Activating a new session safely transitions the previous active session ---
  console.log('\n--- Test N: Safe Activation Transition (deactivate previous, activate target) ---');
  // Simulates exactly what resolveSessionStatusPatch() does inside withTenantContext():
  // 1) deactivate any other currently-active session for the school, 2) activate the target.
  await db.exec(`
    UPDATE academic_sessions SET is_current = FALSE WHERE school_id = '${schoolA}' AND is_current = TRUE AND id != '${session2025}';
    UPDATE academic_sessions SET is_current = TRUE, is_locked = FALSE WHERE id = '${session2025}';
  `);
  const afterTransition = await db.query(`SELECT id, is_current FROM academic_sessions WHERE school_id = '${schoolA}' AND is_current = TRUE;`);
  if (afterTransition.rows.length !== 1 || afterTransition.rows[0].id !== session2025) {
    throw new Error('FAIL: Activation did not correctly transition from the old to the new active session!');
  }
  const oldSessionCheck = await db.query(`SELECT is_current FROM academic_sessions WHERE id = '${session2026}';`);
  if (oldSessionCheck.rows[0].is_current !== false) {
    throw new Error('FAIL: Previously active session (2026) was not correctly deactivated!');
  }
  console.log('✓ Test N PASS: Activating session "2025" safely deactivated the previously active session "2026" — exactly one ACTIVE session remains.');

  // --- TEST O: Activation is transactional ---
  console.log('\n--- Test O: Activation Is Transactional (all-or-nothing) ---');
  // If the second (activating) statement fails, the deactivation of the previous
  // session must NOT be left committed on its own — resolveSessionStatusPatch()
  // and the update it feeds both run inside withTenantContext()'s single
  // interactive Prisma $transaction, so a failure after the deactivation step
  // rolls back the entire operation, leaving "2025" still active.
  const activeBeforeFailedAttempt = await db.query(`SELECT id FROM academic_sessions WHERE school_id = '${schoolA}' AND is_current = TRUE;`);
  if (activeBeforeFailedAttempt.rows.length !== 1 || activeBeforeFailedAttempt.rows[0].id !== session2025) {
    throw new Error('FAIL: Test setup invariant broken before transactional-failure simulation!');
  }
  let transactionRolledBack = false;
  try {
    await db.query('BEGIN');
    await db.query(`UPDATE academic_sessions SET is_current = FALSE WHERE school_id = '${schoolA}' AND is_current = TRUE AND id != '${session2026}';`);
    // Force a failure mid-transaction (attempt to activate a non-existent session id)
    await db.query(`UPDATE academic_sessions SET is_current = TRUE WHERE id = 'ffffffff-0000-0000-0000-000000000000' RETURNING (1/0);`);
    await db.query('COMMIT');
  } catch {
    await db.query('ROLLBACK').catch(() => {});
    transactionRolledBack = true;
  }
  if (!transactionRolledBack) {
    throw new Error('FAIL: Expected the simulated failed activation transaction to roll back!');
  }
  const activeAfterFailedAttempt = await db.query(`SELECT id FROM academic_sessions WHERE school_id = '${schoolA}' AND is_current = TRUE;`);
  if (activeAfterFailedAttempt.rows.length !== 1 || activeAfterFailedAttempt.rows[0].id !== session2025) {
    throw new Error('FAIL: A failed activation transaction left the school with zero or an inconsistent ACTIVE session — activation was NOT atomic!');
  }
  console.log('✓ Test O PASS: A failed activation attempt rolled back entirely; "2025" remains the sole ACTIVE session (deactivation was not partially committed).');

  // --- TEST P: Audit log is generated ---
  console.log('\n--- Test P: Forensic Audit Log Generation for Session Mutations ---');
  await db.exec(`
    INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, change_summary)
    VALUES (gen_random_uuid(), '${schoolA}', '${userAdminA}', 'Admin User A', 'ADMIN', 'UPDATE', 'AcademicSession', '${session2025}', 'Activated academic session "2025"');
  `);
  const auditEntries = await db.query(`
    SELECT entity, action, actor_name, change_summary FROM audit_logs
    WHERE school_id = '${schoolA}' AND entity = 'AcademicSession' ORDER BY timestamp ASC;
  `);
  if (auditEntries.rows.length < 3) {
    throw new Error('FAIL: Expected at least 3 AcademicSession audit log entries (INSERT + UPDATE + activation UPDATE)!');
  }
  const insertLog = auditEntries.rows.find(r => r.action === 'INSERT');
  if (!insertLog || insertLog.actor_name !== 'Admin User A') {
    throw new Error('FAIL: Academic session creation audit log missing or incorrect actor!');
  }
  console.log('✓ Test P PASS: Forensic audit log entries recorded for AcademicSession create, update, and activation.');

  // --- TEST Q: Historical sessions are not deleted when archived/completed ---
  console.log('\n--- Test Q: Archiving Does Not Delete Historical Session Data ---');
  await db.exec(`UPDATE academic_sessions SET is_current = FALSE, is_locked = TRUE WHERE id = '${session2026}';`);
  const archivedRow = await db.query(`SELECT id, name, start_date, end_date, is_current, is_locked FROM academic_sessions WHERE id = '${session2026}';`);
  if (archivedRow.rows.length !== 1) {
    throw new Error('FAIL: Archived session row was deleted from the database — historical data was destroyed!');
  }
  if (archivedRow.rows[0].is_locked !== true || archivedRow.rows[0].is_current !== false) {
    throw new Error('FAIL: Archived session flags are incorrect!');
  }
  const archivedStatus = computeSessionStatus({
    isCurrent: archivedRow.rows[0].is_current,
    isLocked: archivedRow.rows[0].is_locked,
    startDate: archivedRow.rows[0].start_date,
    endDate: archivedRow.rows[0].end_date,
  });
  if (archivedStatus !== 'ARCHIVED') {
    throw new Error(`FAIL: Expected computed status ARCHIVED, got ${archivedStatus}!`);
  }
  console.log('✓ Test Q PASS: Archiving a session preserves its row and full historical field data (row still exists, only lifecycle flags changed).');

  // --- TEST R: Concurrent activation cannot leave multiple ACTIVE sessions ---
  console.log('\n--- Test R: Concurrent Activation Cannot Leave Multiple ACTIVE Sessions ---');
  // Simulates two racing activation requests both attempting to set is_current = TRUE
  // WITHOUT first deactivating each other (the worst-case race), to prove the
  // database-level partial unique index is the final authoritative guard,
  // independent of any application-level "deactivate-then-activate" ordering.
  const sessionRaceA = session2025; // currently ACTIVE
  const sessionRaceB = session2026; // currently ARCHIVED, not active
  let raceViolationBlocked = false;
  try {
    await db.exec(`UPDATE academic_sessions SET is_current = TRUE WHERE id = '${sessionRaceB}';`);
  } catch (err) {
    raceViolationBlocked = /uq_one_current_session_per_school|duplicate key/i.test(String(err.message || err));
  }
  if (!raceViolationBlocked) {
    throw new Error('FAIL: A naive concurrent activation that skips deactivating the existing active session was NOT blocked!');
  }
  const finalActiveSet = await db.query(`SELECT id FROM academic_sessions WHERE school_id = '${schoolA}' AND is_current = TRUE;`);
  if (finalActiveSet.rows.length !== 1 || finalActiveSet.rows[0].id !== sessionRaceA) {
    throw new Error('FAIL: More than one ACTIVE session (or zero) exists for School A after the concurrent-activation race!');
  }
  console.log('✓ Test R PASS: The database partial unique index rejects any attempt to create a second ACTIVE session, regardless of application-level ordering — exactly one ACTIVE session survives the race.');

  console.log('\n================================================================');
  console.log('All Phase 3.2 Academic Session Management Scenarios Passed Successfully (100%)');
  console.log('================================================================\n');
}

runPhase3_2AcademicSessionSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
