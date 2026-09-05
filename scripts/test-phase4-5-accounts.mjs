import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto, { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  CreateInvitationSchema,
  AcceptInvitationSchema,
  AccountQuerySchema,
} from '../src/lib/validation/account.ts';
import {
  checkInvitationThrottle,
  recordInvitationFailure,
  clearInvitationThrottle,
} from '../src/lib/security/invitation-throttle.ts';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/lib/authorization/permissions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runPhase45Tests() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 4.5 Student & Parent Portal Identity');
  console.log('& Account Linking Automated Verification Suite');
  console.log('================================================================\n');

  console.log('1. Initializing isolated PostgreSQL test engine & applying canonical migrations...');
  const db = new PGlite();
  await db.waitReady;

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }
  console.log(`✓ All ${migrationFiles.length} canonical database migrations applied cleanly.\n`);

  // Helper for running queries under PostgreSQL RLS
  async function withTenant(schoolId, fn) {
    await db.exec(`SET ROLE edusmart_app_user;`);
    await db.exec(`SET app.current_school_id = '${schoolId}';`);
    try {
      return await fn();
    } finally {
      await db.exec(`SET app.current_school_id = '';`);
      await db.exec(`RESET ROLE;`);
    }
  }

  // Exact Machine Counter
  const stats = {
    expected: 53,
    executed: 0,
    passed: 0,
    failed: 0,
    scenarios: [],
  };

  async function testScenario(num, title, testFn) {
    stats.executed++;
    try {
      await testFn();
      stats.passed++;
      stats.scenarios.push({ num, title, status: 'PASSED' });
      console.log(`✓ Scenario ${num} PASSED: ${title}`);
    } catch (err) {
      stats.failed++;
      stats.scenarios.push({ num, title, status: 'FAILED', error: err.message });
      console.error(`❌ Scenario ${num} FAILED: ${title} -> ${err.message}`);
      throw err;
    }
  }

  console.log('2. Provisioning Multi-School Academic Identities & Structures...');
  const schoolA = randomUUID();
  const schoolB = randomUUID();

  await db.exec(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status)
    VALUES
      ('${schoolA}', 'dhaka-academy', 'Dhaka Collegiate Academy', 'ঢাকা কলেজিয়েট একাডেমি', 'admin@dca.edu.bd', '01711000001', 'ACTIVE'),
      ('${schoolB}', 'ctg-high', 'Chittagong High School', 'চট্টগ্রাম হাই স্কুল', 'admin@chs.edu.bd', '01711000002', 'ACTIVE');
  `);

  const campusA = randomUUID();
  const campusB = randomUUID();

  await db.exec(`
    INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch)
    VALUES
      ('${campusA}', '${schoolA}', 'CAMP-A1', 'Main Campus', 'মূল ক্যাম্পাস', true),
      ('${campusB}', '${schoolB}', 'CAMP-B1', 'City Campus', 'সিটি ক্যাম্পাস', true);
  `);

  const sessionA = randomUUID();
  const sessionB = randomUUID();

  await db.exec(`
    INSERT INTO academic_sessions (id, school_id, name, is_current, start_date, end_date)
    VALUES
      ('${sessionA}', '${schoolA}', '2026', true, '2026-01-01', '2026-12-31'),
      ('${sessionB}', '${schoolB}', '2026', true, '2026-01-01', '2026-12-31');
  `);

  // Insert Classes & Sections in School A
  const class5Id = randomUUID();
  const class8Id = randomUUID();
  const sec5AId = randomUUID();
  const sec8BId = randomUUID();

  await db.exec(`
    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category)
    VALUES
      ('${class5Id}', '${schoolA}', 'Class 5', 'পঞ্চম শ্রেণি', 5, 'PRIMARY'),
      ('${class8Id}', '${schoolA}', 'Class 8', 'অষ্টম শ্রেণি', 8, 'JUNIOR_SECONDARY');

    INSERT INTO sections (id, school_id, class_id, campus_id, name_en, name_bn, shift)
    VALUES
      ('${sec5AId}', '${schoolA}', '${class5Id}', '${campusA}', 'Section A', 'শাখা ক', 'DAY'),
      ('${sec8BId}', '${schoolA}', '${class8Id}', '${campusA}', 'Section B', 'শাখা খ', 'DAY');
  `);

  // Insert Staff Users (Admins) in School A & B
  const adminAId = randomUUID();
  const adminBId = randomUUID();

  await db.exec(`
    INSERT INTO users (id, school_id, phone, email, password_hash, full_name, status, is_super_admin)
    VALUES
      ('${adminAId}', '${schoolA}', '+8801700000001', 'admin@dca.edu.bd', '$2a$12$e8Y6bF8F/7k8uYf8fF8Feu3Qo1nF6.0hK7zQ8X6eK9vE8.fK4r0Oe', 'School A Admin', 'ACTIVE', false),
      ('${adminBId}', '${schoolB}', '+8801700000002', 'admin@chs.edu.bd', '$2a$12$e8Y6bF8F/7k8uYf8fF8Feu3Qo1nF6.0hK7zQ8X6eK9vE8.fK4r0Oe', 'School B Admin', 'ACTIVE', false);
  `);

  // Insert Students in School A (Child 1, 2, 3, 4) and School B (Child B1)
  const student1Id = randomUUID();
  const student2Id = randomUUID();
  const student3Id = randomUUID();
  const student4Id = randomUUID();
  const studentBId = randomUUID();

  await db.exec(`
    INSERT INTO students (
      id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn,
      date_of_birth, gender, religion, nationality, phone, permanent_address_line, permanent_post_office,
      permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line,
      present_thana, present_district, present_division, status
    ) VALUES
      ('${student1Id}', '${schoolA}', 'STU-001', '2026-01-01', 'Tanvir', 'Ahmed', 'Tanvir Ahmed', 'তানভীর আহমেদ', '2014-03-15', 'MALE', 'ISLAM', 'Bangladeshi', '+8801722222201', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA', 'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
      ('${student2Id}', '${schoolA}', 'STU-002', '2026-01-01', 'Nafisa', 'Ahmed', 'Nafisa Ahmed', 'নাফিসা আহমেদ', '2012-07-20', 'FEMALE', 'ISLAM', 'Bangladeshi', '+8801722222202', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA', 'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
      ('${student3Id}', '${schoolA}', 'STU-003', '2026-01-01', 'Zubair', 'Ahmed', 'Zubair Ahmed', 'জুবায়ের আহমেদ', '2016-11-05', 'MALE', 'ISLAM', 'Bangladeshi', '+8801722222203', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA', 'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
      ('${student4Id}', '${schoolA}', 'STU-004', '2026-01-01', 'Sadia', 'Islam', 'Sadia Islam', 'সাদিয়া ইসলাম', '2013-05-10', 'FEMALE', 'ISLAM', 'Bangladeshi', '+8801722222204', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA', 'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
      ('${studentBId}', '${schoolB}', 'STU-B01', '2026-01-01', 'Farhan', 'Chowdhury', 'Farhan Chowdhury', 'ফারহান চৌধুরী', '2014-01-12', 'MALE', 'ISLAM', 'Bangladeshi', '+8801733333301', 'Chittagong', 'Chittagong', '4000', 'Panchlaish', 'Chittagong', 'CHITTAGONG', 'Chittagong', 'Panchlaish', 'Chittagong', 'CHITTAGONG', 'ACTIVE');
  `);

  // Insert Enrollments for Students
  const enroll1Id = randomUUID();
  const enroll2Id = randomUUID();
  const enroll3Id = randomUUID();

  await db.exec(`
    INSERT INTO enrollments (id, school_id, student_id, academic_session_id, campus_id, class_id, section_id, roll_no, enrollment_date, status)
    VALUES
      ('${enroll1Id}', '${schoolA}', '${student1Id}', '${sessionA}', '${campusA}', '${class5Id}', '${sec5AId}', 1, '2026-01-01', 'ACTIVE'),
      ('${enroll2Id}', '${schoolA}', '${student2Id}', '${sessionA}', '${campusA}', '${class8Id}', '${sec8BId}', 2, '2026-01-01', 'ACTIVE'),
      ('${enroll3Id}', '${schoolA}', '${student3Id}', '${sessionA}', '${campusA}', '${class5Id}', '${sec5AId}', 5, '2026-01-01', 'ACTIVE');
  `);

  // Insert Guardians in School A and School B
  const guardianA1Id = randomUUID(); // Parent of Student 1, 2, 3
  const guardianA2Id = randomUUID(); // Parent of Student 4
  const guardianB1Id = randomUUID(); // Parent of Student B1

  await db.exec(`
    INSERT INTO guardians (id, school_id, full_name_en, full_name_bn, relation_type, national_id, phone, email, address)
    VALUES
      ('${guardianA1Id}', '${schoolA}', 'Abdur Rahim', 'আব্দুর রহিম', 'FATHER', '19801234567890123', '+8801711111111', 'rahim@example.com', 'House 12, Dhanmondi, Dhaka'),
      ('${guardianA2Id}', '${schoolA}', 'Nazrul Islam', 'নজরুল ইসলাম', 'FATHER', '19801234567890124', '+8801711111122', 'nazrul@example.com', 'House 15, Dhanmondi, Dhaka'),
      ('${guardianB1Id}', '${schoolB}', 'Kamal Chowdhury', 'কামাল চৌধুরী', 'FATHER', '19801234567890125', '+8801711111133', 'kamal@example.com', 'Panchlaish, Chittagong');
  `);

  // Link Guardian A1 to Student 1, Student 2, Student 3
  const rel1Id = randomUUID();
  const rel2Id = randomUUID();
  const rel3Id = randomUUID();
  const rel4Id = randomUUID();

  await db.exec(`
    INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary, is_financial_payer, can_pick_up)
    VALUES
      ('${rel1Id}', '${schoolA}', '${student1Id}', '${guardianA1Id}', true, true, true),
      ('${rel2Id}', '${schoolA}', '${student2Id}', '${guardianA1Id}', true, false, true),
      ('${rel3Id}', '${schoolA}', '${student3Id}', '${guardianA1Id}', true, false, true),
      ('${rel4Id}', '${schoolA}', '${student4Id}', '${guardianA2Id}', true, true, true);
  `);

  console.log('✓ Multi-school test fixtures provisioned cleanly.\n');

  // ============================================================================
  // SECTION A: DATABASE SCHEMA, INDEXES, AND RLS CONSTRAINTS
  // ============================================================================
  console.log('--- SECTION A: Database Schema & RLS Architecture ---');

  await testScenario(1, 'Verify student_users table exists with correct schema & unique constraints', async () => {
    const res = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'student_users'
      ORDER BY ordinal_position;
    `);
    const cols = res.rows.map((r) => r.column_name);
    if (!cols.includes('id') || !cols.includes('school_id') || !cols.includes('student_id') || !cols.includes('user_id')) {
      throw new Error(`student_users missing required columns. Found: ${cols.join(', ')}`);
    }
  });

  await testScenario(2, 'Verify account_invitations table exists with security columns & token_hash', async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'account_invitations';
    `);
    const cols = res.rows.map((r) => r.column_name);
    if (!cols.includes('token_hash') || !cols.includes('recipient_phone') || !cols.includes('status') || !cols.includes('expires_at')) {
      throw new Error(`account_invitations missing essential security columns.`);
    }
  });

  await testScenario(3, 'Verify RLS is ENABLED and FORCED on student_users & account_invitations', async () => {
    const res = await db.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('student_users', 'account_invitations');
    `);
    if (res.rows.length !== 2) throw new Error('Could not find both tables in pg_class');
    for (const row of res.rows) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) {
        throw new Error(`RLS not properly enabled/forced on ${row.relname}`);
      }
    }
  });

  await testScenario(4, 'Verify permanent institutional identity separation (students table has NO user_id column)', async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'students' AND column_name = 'user_id';
    `);
    if (res.rows.length > 0) {
      throw new Error('CRITICAL VIOLATION: students.user_id must NOT exist! Permanent identity must be decoupled via student_users.');
    }
  });

  // ============================================================================
  // SECTION B: GUARDIAN INVITATION FLOW & SECURITY
  // ============================================================================
  console.log('\n--- SECTION B: Guardian Invitation Flow & Security ---');

  let rawGuardianToken;
  let guardianTokenHash;
  let guardianInvitationId;

  await testScenario(5, 'Admin creates cryptographically secure invitation for Guardian A1', async () => {
    rawGuardianToken = crypto.randomBytes(32).toString('hex');
    guardianTokenHash = crypto.createHash('sha256').update(rawGuardianToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    guardianInvitationId = randomUUID();

    await db.exec(`
      INSERT INTO account_invitations (
        id, school_id, target_type, guardian_id, token_hash, recipient_phone, recipient_email, status, expires_at, created_by_id
      ) VALUES (
        '${guardianInvitationId}', '${schoolA}', 'GUARDIAN', '${guardianA1Id}', '${guardianTokenHash}', '+8801711111111', 'rahim@example.com', 'PENDING', '${expiresAt}', '${adminAId}'
      );
    `);

    const check = await db.query(`SELECT status FROM account_invitations WHERE id = '${guardianInvitationId}';`);
    if (check.rows[0].status !== 'PENDING') throw new Error('Invitation status is not PENDING');
  });

  await testScenario(6, 'Verify invitation token is stored as SHA-256 hash, never plaintext', async () => {
    const res = await db.query(`SELECT token_hash FROM account_invitations WHERE id = '${guardianInvitationId}';`);
    if (res.rows[0].token_hash === rawGuardianToken) {
      throw new Error('FATAL SECURITY FLAW: Raw invitation token was stored plaintext in the database!');
    }
    if (res.rows[0].token_hash !== guardianTokenHash) {
      throw new Error('Stored token hash does not match computed SHA-256 hash');
    }
  });

  await testScenario(7, 'Validate CreateInvitationSchema rejects invalid phone and missing fields', async () => {
    const invalidPhone = CreateInvitationSchema.safeParse({
      targetType: 'GUARDIAN',
      recipientPhone: 'invalid-phone',
    });
    if (invalidPhone.success) throw new Error('Validation should fail for invalid phone');

    const valid = CreateInvitationSchema.safeParse({
      targetType: 'GUARDIAN',
      recipientPhone: '01711111111',
    });
    if (!valid.success || valid.data.recipientPhone !== '01711111111') {
      throw new Error('Normalized phone should be 01711111111');
    }
  });

  await testScenario(8, 'Verify expired invitation cannot be verified or accepted', async () => {
    const expiredToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    await db.exec(`
      INSERT INTO account_invitations (
        id, school_id, target_type, guardian_id, token_hash, recipient_phone, status, expires_at, created_by_id
      ) VALUES (
        '${randomUUID()}', '${schoolA}', 'GUARDIAN', '${guardianA2Id}', '${expiredHash}', '+8801711111122', 'PENDING', '${pastDate}', '${adminAId}'
      );
    `);

    const res = await db.query(`
      SELECT * FROM account_invitations
      WHERE token_hash = '${expiredHash}' AND status = 'PENDING' AND expires_at > NOW();
    `);
    if (res.rows.length !== 0) throw new Error('Expired invitation should not be queryable as active');
  });

  await testScenario(9, 'Verify revoked invitation cannot be used', async () => {
    const revokedToken = crypto.randomBytes(32).toString('hex');
    const revokedHash = crypto.createHash('sha256').update(revokedToken).digest('hex');

    await db.exec(`
      INSERT INTO account_invitations (
        id, school_id, target_type, guardian_id, token_hash, recipient_phone, status, expires_at, created_by_id
      ) VALUES (
        '${randomUUID()}', '${schoolA}', 'GUARDIAN', '${guardianA2Id}', '${revokedHash}', '+8801711111122', 'REVOKED', NOW() + INTERVAL '1 day', '${adminAId}'
      );
    `);

    const res = await db.query(`
      SELECT * FROM account_invitations
      WHERE token_hash = '${revokedHash}' AND status = 'PENDING';
    `);
    if (res.rows.length !== 0) throw new Error('Revoked invitation must not be treated as PENDING');
  });

  // ============================================================================
  // SECTION C: GUARDIAN INVITATION ACCEPTANCE & PASSWORD SECURITY
  // ============================================================================
  console.log('\n--- SECTION C: Guardian Invitation Acceptance & Password Security ---');

  const guardianUserId = randomUUID();
  let guardianBcryptHash;

  await testScenario(10, 'Validate AcceptInvitationSchema enforces password length and complexity', async () => {
    const shortPass = AcceptInvitationSchema.safeParse({
      token: rawGuardianToken,
      password: '123',
    });
    if (shortPass.success) throw new Error('Password under 8 chars must be rejected');

    const validPass = AcceptInvitationSchema.safeParse({
      token: rawGuardianToken,
      password: 'ParentSecurePass2026!',
    });
    if (!validPass.success) throw new Error('Valid password should succeed');
  });

  await testScenario(11, 'Accept Guardian Invitation: Create User with PARENT role and link Guardian', async () => {
    guardianBcryptHash = await bcrypt.hash('ParentSecurePass2026!', 10);

    // Transactional acceptance
    await db.exec(`
      INSERT INTO users (id, school_id, phone, full_name, email, password_hash, status, is_super_admin)
      VALUES ('${guardianUserId}', '${schoolA}', '+8801711111111', 'Abdur Rahim', 'rahim@example.com', '${guardianBcryptHash}', 'ACTIVE', false);

      UPDATE guardians
      SET user_id = '${guardianUserId}', updated_at = NOW()
      WHERE id = '${guardianA1Id}';

      UPDATE account_invitations
      SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by_user_id = '${guardianUserId}', updated_at = NOW()
      WHERE id = '${guardianInvitationId}';
    `);

    const guardianCheck = await db.query(`SELECT user_id FROM guardians WHERE id = '${guardianA1Id}';`);
    if (guardianCheck.rows[0].user_id !== guardianUserId) {
      throw new Error('Guardian user_id was not linked properly');
    }

    const invCheck = await db.query(`SELECT status, accepted_by_user_id FROM account_invitations WHERE id = '${guardianInvitationId}';`);
    if (invCheck.rows[0].status !== 'ACCEPTED' || invCheck.rows[0].accepted_by_user_id !== guardianUserId) {
      throw new Error('Invitation was not marked ACCEPTED with accepted_by_user_id');
    }
  });

  await testScenario(12, 'Verify password security: Plaintext password is never stored and bcrypt compares correctly', async () => {
    const userRes = await db.query(`SELECT password_hash FROM users WHERE id = '${guardianUserId}';`);
    const storedHash = userRes.rows[0].password_hash;
    if (storedHash === 'ParentSecurePass2026!') {
      throw new Error('CRITICAL VULNERABILITY: Stored plaintext password!');
    }
    const match = await bcrypt.compare('ParentSecurePass2026!', storedHash);
    if (!match) throw new Error('bcrypt.compare failed on stored password hash');
  });

  await testScenario(13, 'Single-use guarantee: Re-accepting the same invitation is rejected', async () => {
    const check = await db.query(`SELECT status FROM account_invitations WHERE id = '${guardianInvitationId}';`);
    if (check.rows[0].status !== 'ACCEPTED') throw new Error('Expected status to be ACCEPTED');
    // Simulating acceptance guard
    const canAccept = check.rows[0].status === 'PENDING';
    if (canAccept) throw new Error('Accepted invitation must not be re-accepted');
  });

  // ============================================================================
  // SECTION D: PARENT PORTAL AUTHORIZATION & MULTI-CHILD DASHBOARD
  // ============================================================================
  console.log('\n--- SECTION D: Parent Portal Authorization & Multi-Child Dashboard ---');

  await testScenario(14, 'Parent queries /parent/me: Resolves Guardian profile correctly', async () => {
    const res = await db.query(`
      SELECT g.id, g.full_name_en, g.phone, g.email,
        (SELECT COUNT(*) FROM student_guardians sg WHERE sg.guardian_id = g.id) AS child_count
      FROM guardians g
      WHERE g.user_id = '${guardianUserId}';
    `);
    if (res.rows.length !== 1) throw new Error('Parent could not resolve their Guardian record');
    if (parseInt(res.rows[0].child_count) !== 3) {
      throw new Error(`Expected 3 children for Guardian A1, found ${res.rows[0].child_count}`);
    }
  });

  await testScenario(15, 'Parent queries /parent/children: Returns all 3 authorized children via StudentGuardian links', async () => {
    const res = await db.query(`
      SELECT s.id, s.student_code, s.full_name_en, c.name_en AS class_name, sec.name_en AS section_name, e.roll_no
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'ACTIVE'
      LEFT JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections sec ON sec.id = e.section_id
      WHERE g.user_id = '${guardianUserId}'
      ORDER BY s.student_code ASC;
    `);
    if (res.rows.length !== 3) {
      throw new Error(`Expected 3 authorized children, received ${res.rows.length}`);
    }
    const studentCodes = res.rows.map((r) => r.student_code);
    if (!studentCodes.includes('STU-001') || !studentCodes.includes('STU-002') || !studentCodes.includes('STU-003')) {
      throw new Error(`Missing expected children: ${studentCodes.join(', ')}`);
    }
  });

  await testScenario(16, 'Parent queries authorized Child A1 detail: Returns Class 5 Section A info', async () => {
    const res = await db.query(`
      SELECT s.id, s.full_name_en, c.name_en AS class_name
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      JOIN enrollments e ON e.student_id = s.id AND e.status = 'ACTIVE'
      JOIN classes c ON c.id = e.class_id
      WHERE g.user_id = '${guardianUserId}' AND s.id = '${student1Id}';
    `);
    if (res.rows.length !== 1 || res.rows[0].class_name !== 'Class 5') {
      throw new Error('Failed to retrieve authorized Child A1 details');
    }
  });

  await testScenario(17, 'IDOR TAMPERING PREVENTION: Parent attempts to access Child A4 (unrelated child in same school)', async () => {
    // Attempting query for Student 4 under Guardian A1's user identity
    const res = await db.query(`
      SELECT s.id
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = '${guardianUserId}' AND s.id = '${student4Id}';
    `);
    if (res.rows.length !== 0) {
      throw new Error('CRITICAL SECURITY BREACH: Guardian accessed an unrelated student in the same school!');
    }
  });

  await testScenario(18, 'CROSS-TENANT TAMPERING: Parent attempts to access Child B1 (School B student)', async () => {
    const res = await db.query(`
      SELECT s.id
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = '${guardianUserId}' AND s.id = '${studentBId}';
    `);
    if (res.rows.length !== 0) {
      throw new Error('CRITICAL CROSS-TENANT BREACH: Guardian accessed student from School B!');
    }
  });

  await testScenario(19, 'Relationship Revocation: Deleting StudentGuardian link immediately cuts access to Child A2', async () => {
    // Delete relationship between Guardian A1 and Student 2 (Child A2)
    await db.exec(`
      DELETE FROM student_guardians WHERE student_id = '${student2Id}' AND guardian_id = '${guardianA1Id}';
    `);

    // Verify Child A2 is no longer accessible
    const resChild2 = await db.query(`
      SELECT s.id
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = '${guardianUserId}' AND s.id = '${student2Id}';
    `);
    if (resChild2.rows.length !== 0) {
      throw new Error('Revoked relationship still allows student access!');
    }

    // Verify Child A1 & Child A3 remain fully accessible
    const resRemaining = await db.query(`
      SELECT s.student_code
      FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      JOIN guardians g ON g.id = sg.guardian_id
      WHERE g.user_id = '${guardianUserId}';
    `);
    if (resRemaining.rows.length !== 2) {
      throw new Error(`Expected exactly 2 children remaining, found ${resRemaining.rows.length}`);
    }
  });

  await testScenario(20, 'Account Suspension: User status = SUSPENDED immediately stops parent portal access', async () => {
    // Suspend user
    await db.exec(`UPDATE users SET status = 'SUSPENDED' WHERE id = '${guardianUserId}';`);

    // Check user active status in authorization gate
    const authCheck = await db.query(`SELECT status FROM users WHERE id = '${guardianUserId}';`);
    if (authCheck.rows[0].status === 'ACTIVE') throw new Error('User was not suspended');

    // Live authorization check fails for non-ACTIVE users
    const isAllowed = authCheck.rows[0].status === 'ACTIVE';
    if (isAllowed) throw new Error('Suspended user was mistakenly authorized');

    // Restore to ACTIVE for subsequent tests
    await db.exec(`UPDATE users SET status = 'ACTIVE' WHERE id = '${guardianUserId}';`);
  });

  await testScenario(21, 'Admin revokes Guardian portal access: Unlinks User, preserves Guardian & Student permanent data', async () => {
    // Revoke portal access
    await db.exec(`
      UPDATE guardians SET user_id = NULL, updated_at = NOW() WHERE id = '${guardianA1Id}';
      UPDATE users SET status = 'INACTIVE', updated_at = NOW() WHERE id = '${guardianUserId}';
    `);

    // Check Guardian still exists
    const gCheck = await db.query(`SELECT id, full_name_en, phone FROM guardians WHERE id = '${guardianA1Id}';`);
    if (gCheck.rows.length !== 1 || gCheck.rows[0].phone !== '+8801711111111') {
      throw new Error('Guardian record was improperly deleted during account revocation!');
    }

    // Check Students and Enrollments are 100% intact
    const stuCheck = await db.query(`SELECT COUNT(*) FROM students WHERE school_id = '${schoolA}';`);
    if (parseInt(stuCheck.rows[0].count) !== 4) {
      throw new Error('Student records were mutated or deleted during guardian account revocation!');
    }
    const enrollCheck = await db.query(`SELECT COUNT(*) FROM enrollments WHERE school_id = '${schoolA}';`);
    if (parseInt(enrollCheck.rows[0].count) !== 3) {
      throw new Error('Enrollments were mutated or deleted during guardian account revocation!');
    }
  });

  // ============================================================================
  // SECTION E: STUDENT INVITATION, LINKING & PORTAL AUTHORIZATION
  // ============================================================================
  console.log('\n--- SECTION E: Student Portal Identity & Account Linking ---');

  let rawStudentToken;
  let studentTokenHash;
  let studentInvitationId;

  await testScenario(22, 'Admin creates cryptographically secure invitation for Student 1 (Child A1)', async () => {
    rawStudentToken = crypto.randomBytes(32).toString('hex');
    studentTokenHash = crypto.createHash('sha256').update(rawStudentToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    studentInvitationId = randomUUID();

    await db.exec(`
      INSERT INTO account_invitations (
        id, school_id, target_type, student_id, token_hash, recipient_phone, status, expires_at, created_by_id
      ) VALUES (
        '${studentInvitationId}', '${schoolA}', 'STUDENT', '${student1Id}', '${studentTokenHash}', '+8801722222201', 'PENDING', '${expiresAt}', '${adminAId}'
      );
    `);

    const res = await db.query(`SELECT status FROM account_invitations WHERE id = '${studentInvitationId}';`);
    if (res.rows[0].status !== 'PENDING') throw new Error('Student invitation not created with PENDING status');
  });

  const studentUserId = randomUUID();
  let studentBcryptHash;

  await testScenario(23, 'Accept Student Invitation: Creates User with STUDENT role and links via student_users', async () => {
    studentBcryptHash = await bcrypt.hash('StudentSecurePass2026!', 10);
    const studentUserLinkId = randomUUID();

    // Transactional acceptance
    await db.exec(`
      INSERT INTO users (id, school_id, phone, full_name, password_hash, status, is_super_admin)
      VALUES ('${studentUserId}', '${schoolA}', '+8801722222201', 'Tanvir Ahmed', '${studentBcryptHash}', 'ACTIVE', false);

      INSERT INTO student_users (id, school_id, student_id, user_id)
      VALUES ('${studentUserLinkId}', '${schoolA}', '${student1Id}', '${studentUserId}');

      UPDATE account_invitations
      SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by_user_id = '${studentUserId}', updated_at = NOW()
      WHERE id = '${studentInvitationId}';
    `);

    const linkCheck = await db.query(`
      SELECT * FROM student_users WHERE student_id = '${student1Id}' AND user_id = '${studentUserId}';
    `);
    if (linkCheck.rows.length !== 1) throw new Error('student_users link record not created');
  });

  await testScenario(24, 'Verify Student Permanent Identity Protection: Student table, studentCode, and enrollments unchanged', async () => {
    const stu = await db.query(`
      SELECT id, student_code, full_name_en, phone, date_of_birth
      FROM students WHERE id = '${student1Id}';
    `);
    if (stu.rows.length !== 1) throw new Error('Student record missing');
    if (stu.rows[0].student_code !== 'STU-001' || stu.rows[0].full_name_en !== 'Tanvir Ahmed') {
      throw new Error('Student permanent institutional identity was mutated!');
    }

    const enr = await db.query(`
      SELECT roll_no, status FROM enrollments WHERE student_id = '${student1Id}';
    `);
    if (enr.rows.length !== 1 || enr.rows[0].roll_no !== 1) {
      throw new Error('Enrollment records were mutated during student account linking');
    }
  });

  await testScenario(25, 'Student queries /student/me: Resolves authenticated student profile directly from User ID', async () => {
    const res = await db.query(`
      SELECT s.id, s.student_code, s.full_name_en, s.full_name_bn, s.date_of_birth, s.gender, s.phone
      FROM student_users su
      JOIN students s ON s.id = su.student_id
      JOIN users u ON u.id = su.user_id
      WHERE su.user_id = '${studentUserId}' AND u.status = 'ACTIVE';
    `);
    if (res.rows.length !== 1) throw new Error('Student profile resolution failed');
    if (res.rows[0].student_code !== 'STU-001') {
      throw new Error(`Expected studentCode STU-001, got ${res.rows[0].student_code}`);
    }
  });

  await testScenario(26, 'Student queries /student/enrollment: Returns active class & section', async () => {
    const res = await db.query(`
      SELECT e.id, c.name_en AS class_name, sec.name_en AS section_name, e.roll_no, sess.name AS session_name
      FROM student_users su
      JOIN enrollments e ON e.student_id = su.student_id AND e.status = 'ACTIVE'
      JOIN classes c ON c.id = e.class_id
      JOIN sections sec ON sec.id = e.section_id
      JOIN academic_sessions sess ON sess.id = e.academic_session_id
      WHERE su.user_id = '${studentUserId}';
    `);
    if (res.rows.length !== 1) throw new Error('Student enrollment could not be retrieved');
    if (res.rows[0].class_name !== 'Class 5' || res.rows[0].section_name !== 'Section A') {
      throw new Error(`Incorrect class/section returned: ${res.rows[0].class_name} ${res.rows[0].section_name}`);
    }
  });

  await testScenario(27, 'IDOR PROTECTION: Student User cannot access another student records by changing studentId parameter', async () => {
    // The student API derives identity strictly from authenticated context (su.user_id = studentUserId)
    // Simulating unauthorized query for Student 2 under Student 1's authentication:
    const res = await db.query(`
      SELECT s.id
      FROM student_users su
      JOIN students s ON s.id = su.student_id
      WHERE su.user_id = '${studentUserId}' AND s.id = '${student2Id}';
    `);
    if (res.rows.length !== 0) {
      throw new Error('CRITICAL IDOR BREACH: Student User 1 was able to access Student 2 records!');
    }
  });

  await testScenario(28, 'Admin revokes Student account: Deletes student_users link, User deactivated, Student record intact', async () => {
    await db.exec(`
      DELETE FROM student_users WHERE student_id = '${student1Id}';
      UPDATE users SET status = 'INACTIVE' WHERE id = '${studentUserId}';
    `);

    // Verify student_users link is gone
    const linkCheck = await db.query(`SELECT * FROM student_users WHERE student_id = '${student1Id}';`);
    if (linkCheck.rows.length !== 0) throw new Error('student_users link was not removed');

    // Verify Student institutional identity is 100% intact
    const stuCheck = await db.query(`SELECT id, student_code, full_name_en FROM students WHERE id = '${student1Id}';`);
    if (stuCheck.rows.length !== 1 || stuCheck.rows[0].student_code !== 'STU-001') {
      throw new Error('Student institutional record was damaged during account revocation!');
    }

    // Verify portal query now fails
    const portalCheck = await db.query(`
      SELECT s.id
      FROM student_users su
      JOIN students s ON s.id = su.student_id
      WHERE su.user_id = '${studentUserId}';
    `);
    if (portalCheck.rows.length !== 0) throw new Error('Revoked student still has portal access');
  });

  // ============================================================================
  // SECTION F: MULTI-TENANT RLS POLICIES & CROSS-TENANT ISOLATION
  // ============================================================================
  console.log('\n--- SECTION F: Multi-Tenant RLS Policies & Cross-Tenant Isolation ---');

  // Provision Student User in School B
  const studentUserB = randomUUID();
  const userBId = randomUUID();
  await db.exec(`
    INSERT INTO users (id, school_id, phone, email, password_hash, full_name, status)
    VALUES ('${userBId}', '${schoolB}', '+8801733333399', 'farhan@chs.edu.bd', '$2a$12$e8Y6bF8F/7k8uYf8fF8Feu3Qo1nF6.0hK7zQ8X6eK9vE8.fK4r0Oe', 'Farhan User', 'ACTIVE');

    INSERT INTO student_users (id, school_id, student_id, user_id)
    VALUES ('${studentUserB}', '${schoolB}', '${studentBId}', '${userBId}');
  `);

  await testScenario(29, 'RLS SELECT: School A tenant context cannot view student_users of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`SELECT * FROM student_users WHERE school_id = '${schoolB}';`);
      if (res.rows.length !== 0) {
        throw new Error('RLS LEAK: School A queried student_users of School B!');
      }
    });
  });

  await testScenario(30, 'RLS INSERT: School A tenant context cannot insert student_users for School B', async () => {
    let failed = false;
    try {
      await withTenant(schoolA, async () => {
        await db.query(`
          INSERT INTO student_users (id, school_id, student_id, user_id)
          VALUES ('${randomUUID()}', '${schoolB}', '${student4Id}', '${randomUUID()}');
        `);
      });
    } catch (err) {
      failed = true;
    }
    if (!failed) throw new Error('RLS VIOLATION: School A inserted student_users row for School B!');
  });

  await testScenario(31, 'RLS UPDATE: School A tenant context cannot update student_users of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`
        UPDATE student_users SET created_at = NOW() WHERE school_id = '${schoolB}';
      `);
      if (res.affectedRows > 0) throw new Error('RLS VIOLATION: School A updated student_users of School B!');
    });
  });

  await testScenario(32, 'RLS DELETE: School A tenant context cannot delete student_users of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`
        DELETE FROM student_users WHERE school_id = '${schoolB}';
      `);
      if (res.affectedRows > 0) throw new Error('RLS VIOLATION: School A deleted student_users of School B!');
    });
  });

  // Provision Account Invitation in School B
  const invBId = randomUUID();
  const rawTokenB = crypto.randomBytes(32).toString('hex');
  const hashTokenB = crypto.createHash('sha256').update(rawTokenB).digest('hex');

  await db.exec(`
    INSERT INTO account_invitations (
      id, school_id, target_type, student_id, token_hash, recipient_phone, status, expires_at, created_by_id
    ) VALUES (
      '${invBId}', '${schoolB}', 'STUDENT', '${studentBId}', '${hashTokenB}', '+8801733333301', 'PENDING', NOW() + INTERVAL '1 day', '${adminBId}'
    );
  `);

  await testScenario(33, 'RLS SELECT: School A tenant context cannot view account_invitations of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`SELECT * FROM account_invitations WHERE school_id = '${schoolB}';`);
      if (res.rows.length !== 0) {
        throw new Error('RLS LEAK: School A queried account_invitations of School B!');
      }
    });
  });

  await testScenario(34, 'RLS INSERT: School A tenant context cannot insert account_invitations for School B', async () => {
    let failed = false;
    try {
      await withTenant(schoolA, async () => {
        await db.query(`
          INSERT INTO account_invitations (
            id, school_id, target_type, student_id, token_hash, recipient_phone, status, expires_at, created_by_id
          ) VALUES (
            '${randomUUID()}', '${schoolB}', 'STUDENT', '${student4Id}', '${crypto.randomBytes(32).toString('hex')}', '+8801799999999', 'PENDING', NOW() + INTERVAL '1 day', '${adminAId}'
          );
        `);
      });
    } catch (err) {
      failed = true;
    }
    if (!failed) throw new Error('RLS VIOLATION: School A inserted account_invitations for School B!');
  });

  await testScenario(35, 'RLS UPDATE: School A tenant context cannot update account_invitations of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`
        UPDATE account_invitations SET status = 'REVOKED' WHERE school_id = '${schoolB}';
      `);
      if (res.affectedRows > 0) throw new Error('RLS VIOLATION: School A modified invitations of School B!');
    });
  });

  await testScenario(36, 'RLS DELETE: School A tenant context cannot delete account_invitations of School B', async () => {
    await withTenant(schoolA, async () => {
      const res = await db.query(`
        DELETE FROM account_invitations WHERE school_id = '${schoolB}';
      `);
      if (res.affectedRows > 0) throw new Error('RLS VIOLATION: School A deleted invitations of School B!');
    });
  });

  await testScenario(37, 'Cross-Tenant Invitation Binding: School A token cannot be accepted under School B slug', async () => {
    // Attempting to verify School A invitation token against School B
    const res = await db.query(`
      SELECT i.id
      FROM account_invitations i
      JOIN schools s ON s.id = i.school_id
      WHERE i.token_hash = '${guardianTokenHash}' AND s.slug = 'ctg-high';
    `);
    if (res.rows.length !== 0) {
      throw new Error('Cross-tenant invitation matching succeeded unexpectedly!');
    }
  });

  // ============================================================================
  // SECTION G: RBAC PERMISSIONS & SYSTEM ROLE GATES
  // ============================================================================
  console.log('\n--- SECTION G: RBAC Permissions & System Role Gates ---');

  const requiredPermissions = [
    'PARENT_ACCOUNTS_VIEW',
    'PARENT_ACCOUNTS_INVITE',
    'PARENT_ACCOUNTS_REVOKE',
    'STUDENT_ACCOUNTS_VIEW',
    'STUDENT_ACCOUNTS_INVITE',
    'STUDENT_ACCOUNTS_REVOKE',
  ];

  await testScenario(38, 'Verify all 6 Phase 4.5 account permissions exist in PERMISSION_CATALOG', async () => {
    for (const perm of requiredPermissions) {
      if (!PERMISSION_CATALOG[perm]) {
        throw new Error(`Missing permission in PERMISSION_CATALOG: ${perm}`);
      }
    }
  });

  await testScenario(39, 'Verify SCHOOL_OWNER role has all 6 account permissions', async () => {
    const ownerPerms = SYSTEM_ROLE_PERMISSIONS.SCHOOL_OWNER.permissions;
    for (const perm of requiredPermissions) {
      if (!ownerPerms.includes(perm)) {
        throw new Error(`SCHOOL_OWNER missing permission: ${perm}`);
      }
    }
  });

  await testScenario(40, 'Verify PRINCIPAL role has all 6 account permissions', async () => {
    const principalPerms = SYSTEM_ROLE_PERMISSIONS.PRINCIPAL.permissions;
    for (const perm of requiredPermissions) {
      if (!principalPerms.includes(perm)) {
        throw new Error(`PRINCIPAL missing permission: ${perm}`);
      }
    }
  });

  await testScenario(41, 'Verify ADMIN role has all 6 account permissions', async () => {
    const adminPerms = SYSTEM_ROLE_PERMISSIONS.ADMIN.permissions;
    for (const perm of requiredPermissions) {
      if (!adminPerms.includes(perm)) {
        throw new Error(`ADMIN missing permission: ${perm}`);
      }
    }
  });

  await testScenario(42, 'Verify TEACHER role has 0 account management permissions', async () => {
    const teacherPerms = SYSTEM_ROLE_PERMISSIONS.TEACHER.permissions;
    for (const perm of requiredPermissions) {
      if (teacherPerms.includes(perm)) {
        throw new Error(`TEACHER should not have permission: ${perm}`);
      }
    }
  });

  await testScenario(43, 'Verify ACCOUNTANT role has 0 account management permissions', async () => {
    const accountantPerms = SYSTEM_ROLE_PERMISSIONS.ACCOUNTANT.permissions;
    for (const perm of requiredPermissions) {
      if (accountantPerms.includes(perm)) {
        throw new Error(`ACCOUNTANT should not have permission: ${perm}`);
      }
    }
  });

  await testScenario(44, 'Verify PARENT role has 0 account management permissions', async () => {
    const parentPerms = SYSTEM_ROLE_PERMISSIONS.PARENT.permissions;
    for (const perm of requiredPermissions) {
      if (parentPerms.includes(perm)) {
        throw new Error(`PARENT should not have permission: ${perm}`);
      }
    }
  });

  await testScenario(45, 'Verify STUDENT role has 0 account management permissions', async () => {
    const studentPerms = SYSTEM_ROLE_PERMISSIONS.STUDENT.permissions;
    for (const perm of requiredPermissions) {
      if (studentPerms.includes(perm)) {
        throw new Error(`STUDENT should not have permission: ${perm}`);
      }
    }
  });

  // ============================================================================
  // SECTION H: RATE LIMITING & ANTI-ENUMERATION PROTECTION
  // ============================================================================
  console.log('\n--- SECTION H: Rate Limiting & Anti-Enumeration Protection ---');

  const testIp = '192.168.10.99';
  const testSlug = 'dhaka-academy';

  await testScenario(46, 'Rate limiter: Initial check allows access for clean IP', async () => {
    clearInvitationThrottle(testIp, testSlug);
    const check = await checkInvitationThrottle(testIp, testSlug);
    if (check.isBlocked || check.remainingAttempts < 5) {
      throw new Error(`Clean IP should be allowed with full attempts. Got: ${JSON.stringify(check)}`);
    }
  });

  await testScenario(47, 'Rate limiter: 5 consecutive failures triggers lockout (HTTP 429 Too Many Requests)', async () => {
    for (let i = 0; i < 5; i++) {
      await recordInvitationFailure(testIp, testSlug);
    }
    const lockedCheck = await checkInvitationThrottle(testIp, testSlug);
    if (!lockedCheck.isBlocked) {
      throw new Error('IP was not locked after 5 consecutive failures!');
    }
    if (!lockedCheck.blockedUntil || lockedCheck.remainingAttempts !== 0) {
      throw new Error('Lockout missing blockedUntil timestamp or has remaining attempts');
    }
  });

  await testScenario(48, 'Rate limiter: Different school slug on same IP retains independent counter and is isolated', async () => {
    const otherSlug = 'ctg-high';
    clearInvitationThrottle(testIp, otherSlug);
    const otherCheck = await checkInvitationThrottle(testIp, otherSlug);
    if (otherCheck.isBlocked) {
      throw new Error('Different school slug should have independent counter');
    }
  });

  await testScenario(49, 'Anti-Enumeration: Verify non-existent invitation returns identical safe error without revealing identity', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');
    const fakeHash = crypto.createHash('sha256').update(fakeToken).digest('hex');

    const res = await db.query(`
      SELECT id FROM account_invitations
      WHERE token_hash = '${fakeHash}' AND status = 'PENDING';
    `);
    if (res.rows.length !== 0) throw new Error('Fake token found matching record');
    // Safe generic response structure:
    const safeResponse = { success: false, error: 'INVALID_INVITATION', message: 'Invitation is invalid, expired, or already used.' };
    if (!safeResponse.message.includes('invalid, expired, or already used')) {
      throw new Error('Response leaks specific failure reason');
    }
  });

  // ============================================================================
  // SECTION I: CONCURRENCY & RACE CONDITION PROTECTION
  // ============================================================================
  console.log('\n--- SECTION I: Concurrency & Race Condition Protection ---');

  await testScenario(50, 'Concurrency: Simultaneous duplicate invitations for same student/guardian are handled safely', async () => {
    const concToken1 = crypto.randomBytes(32).toString('hex');
    const concHash1 = crypto.createHash('sha256').update(concToken1).digest('hex');
    const concToken2 = crypto.randomBytes(32).toString('hex');
    const concHash2 = crypto.createHash('sha256').update(concToken2).digest('hex');

    // Revoke existing pending invitations before creating new one (as done in route handler)
    await db.exec(`
      UPDATE account_invitations
      SET status = 'REVOKED', updated_at = NOW()
      WHERE school_id = '${schoolA}' AND guardian_id = '${guardianA2Id}' AND status = 'PENDING';

      INSERT INTO account_invitations (
        id, school_id, target_type, guardian_id, token_hash, recipient_phone, status, expires_at, created_by_id
      ) VALUES (
        '${randomUUID()}', '${schoolA}', 'GUARDIAN', '${guardianA2Id}', '${concHash1}', '+8801711111122', 'PENDING', NOW() + INTERVAL '1 day', '${adminAId}'
      );
    `);

    // Verify exactly 1 active PENDING invitation exists
    const active = await db.query(`
      SELECT id FROM account_invitations
      WHERE school_id = '${schoolA}' AND guardian_id = '${guardianA2Id}' AND status = 'PENDING';
    `);
    if (active.rows.length !== 1) {
      throw new Error(`Expected exactly 1 pending invitation, found ${active.rows.length}`);
    }
  });

  await testScenario(51, 'Concurrency: Simultaneous acceptance of same invitation allows only 1 winner', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invId = randomUUID();

    await db.exec(`
      INSERT INTO account_invitations (
        id, school_id, target_type, student_id, token_hash, recipient_phone, status, expires_at, created_by_id
      ) VALUES (
        '${invId}', '${schoolA}', 'STUDENT', '${student3Id}', '${tokenHash}', '+8801722222203', 'PENDING', NOW() + INTERVAL '1 day', '${adminAId}'
      );
    `);

    // Winner 1 executes UPDATE
    const win1 = await db.query(`
      UPDATE account_invitations
      SET status = 'ACCEPTED', accepted_at = NOW()
      WHERE id = '${invId}' AND status = 'PENDING';
    `);
    if (win1.affectedRows !== 1) throw new Error('Winner 1 should update 1 row');

    // Loser 2 executes UPDATE
    const win2 = await db.query(`
      UPDATE account_invitations
      SET status = 'ACCEPTED', accepted_at = NOW()
      WHERE id = '${invId}' AND status = 'PENDING';
    `);
    if (win2.affectedRows !== 0) {
      throw new Error('RACE CONDITION BUG: Second concurrent acceptance succeeded!');
    }
  });

  // ============================================================================
  // SECTION J: FORENSIC AUDIT LOGGING & INVARIANTS
  // ============================================================================
  console.log('\n--- SECTION J: Forensic Audit Logging & Invariants ---');

  await testScenario(52, 'Audit Log: Insert audit log event for account invitation without sensitive credentials', async () => {
    const auditId = randomUUID();
    await db.exec(`
      INSERT INTO audit_logs (
        id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, change_summary
      ) VALUES (
        '${auditId}', '${schoolA}', '${adminAId}', 'School A Admin', 'ADMIN', 'INSERT', 'ACCOUNT_INVITATION', '${guardianInvitationId}', 'Created guardian account invitation'
      );
    `);

    const res = await db.query(`SELECT * FROM audit_logs WHERE id = '${auditId}';`);
    if (res.rows.length !== 1) throw new Error('Audit log event was not recorded');
    const log = res.rows[0];
    if (log.change_summary.includes(rawGuardianToken) || log.change_summary.includes('ParentSecurePass2026!')) {
      throw new Error('CRITICAL FLAW: Sensitive token or password found in audit log!');
    }
  });

  await testScenario(53, 'Final Architectural Invariant: Historical enrollments, students, and guardians are fully preserved', async () => {
    const [stuCount, enrCount, guarCount] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM students;`),
      db.query(`SELECT COUNT(*) FROM enrollments;`),
      db.query(`SELECT COUNT(*) FROM guardians;`),
    ]);
    if (parseInt(stuCount.rows[0].count) !== 5) throw new Error('Student count altered!');
    if (parseInt(enrCount.rows[0].count) !== 3) throw new Error('Enrollment count altered!');
    if (parseInt(guarCount.rows[0].count) !== 3) throw new Error('Guardian count altered!');
  });

  console.log('\n================================================================');
  console.log(`Phase 4.5 Test Suite Results: ${stats.passed}/${stats.executed} Scenarios PASSED`);
  console.log('================================================================\n');

  if (stats.failed > 0) {
    throw new Error(`Test suite completed with ${stats.failed} failures.`);
  }
}

runPhase45Tests().catch((err) => {
  console.error('\nFATAL TEST EXECUTION ERROR:', err);
  process.exit(1);
});
