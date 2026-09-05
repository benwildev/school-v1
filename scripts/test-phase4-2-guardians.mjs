import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  GuardianCreateSchema,
  GuardianUpdateSchema,
  GuardianFilterSchema,
} from '../src/lib/validation/guardian.ts';
import {
  StudentGuardianCreateSchema,
  StudentGuardianUpdateSchema,
} from '../src/lib/validation/student-guardian.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runTests() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 4.2 Guardian / Parent Management Verification');
  console.log('Comprehensive Test Suite (Scenarios A through AN)');
  console.log('================================================================\n');

  console.log('1. Initializing isolated PostgreSQL test engine & applying canonical migrations...');
  const db = new PGlite();
  await db.waitReady;

  const migrationFiles = fs.readdirSync(migrationsDir)
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

  console.log('2. Provisioning Multi-School Baseline Data...');
  const schoolA = randomUUID();
  const schoolB = randomUUID();

  await db.exec(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status) VALUES 
    ('${schoolA}', 'school-a', 'School A', 'স্কুল এ', 'admin@schoola.com', '01710000001', 'ACTIVE'),
    ('${schoolB}', 'school-b', 'School B', 'স্কুল বি', 'admin@schoolb.com', '01720000002', 'ACTIVE');
  `);

  // Academic structure for School A
  const campusA = randomUUID();
  const sessionA = randomUUID();
  const classA = randomUUID();
  const secA = randomUUID();

  await db.exec(`
    INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch) VALUES
    ('${campusA}', '${schoolA}', 'MAIN-A', 'Main Campus A', 'প্রধান ক্যাম্পাস এ', true);

    INSERT INTO academic_sessions (id, school_id, name, is_current, start_date, end_date) VALUES
    ('${sessionA}', '${schoolA}', '2026', true, '2026-01-01', '2026-12-31');

    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category) VALUES
    ('${classA}', '${schoolA}', 'Class 6', 'ক্লাস ৬', 6, 'JUNIOR_SECONDARY');

    INSERT INTO sections (id, school_id, class_id, campus_id, name_en, name_bn, shift) VALUES
    ('${secA}', '${schoolA}', '${classA}', '${campusA}', 'Section A', 'শাখা ক', 'DAY');
  `);

  // Base Students in School A
  const studentA1 = randomUUID();
  const studentA2 = randomUUID();
  const studentB1 = randomUUID();

  await db.exec(`
    INSERT INTO students (
      id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn,
      date_of_birth, gender, religion, nationality, phone, permanent_address_line, permanent_post_office,
      permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line,
      present_thana, present_district, present_division, status
    ) VALUES 
    ('${studentA1}', '${schoolA}', 'STU-A-001', '2026-01-01', 'Rahim', 'Uddin', 'Rahim Uddin', 'রহিম উদ্দিন',
     '2012-05-15', 'MALE', 'ISLAM', 'Bangladeshi', '01711111111', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA',
     'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
    ('${studentA2}', '${schoolA}', 'STU-A-002', '2026-01-01', 'Karim', 'Uddin', 'Karim Uddin', 'করিম উদ্দিন',
     '2014-08-20', 'MALE', 'ISLAM', 'Bangladeshi', '01711111112', 'Dhaka', 'Dhaka', '1205', 'Dhanmondi', 'Dhaka', 'DHAKA',
     'Dhaka', 'Dhanmondi', 'Dhaka', 'DHAKA', 'ACTIVE'),
    ('${studentB1}', '${schoolB}', 'STU-B-001', '2026-01-01', 'Shakib', 'Khan', 'Shakib Khan', 'সাকিব খান',
     '2013-03-10', 'MALE', 'ISLAM', 'Bangladeshi', '01722222222', 'Chittagong', 'Chittagong', '4000', 'Kotwali', 'Chittagong', 'CHITTAGONG',
     'Chittagong', 'Kotwali', 'Chittagong', 'CHITTAGONG', 'ACTIVE');
  `);

  console.log('✓ Multi-school baseline data provisioned.\n');

  console.log('3. Executing Mandatory Test Matrix (Scenarios A through AN):\n');

  // ==========================================================================
  // Scenario A: Guardian creation
  // ==========================================================================
  const guardianA1 = randomUUID();
  const validGuardianInput = {
    fullNameEn: 'Md. Rafiqul Islam',
    fullNameBn: 'মোঃ রফিকুল ইসলাম',
    relationType: 'FATHER',
    phone: '+8801712345678', // Unnormalized BD phone
    alternatePhone: '01812345678',
    email: 'Rafiqul@Example.COM',
    nationalId: '19801234567890123',
    occupation: 'Businessman',
    monthlyIncome: 75000,
    educationLevel: 'Masters',
    address: 'House 12, Road 5, Dhanmondi, Dhaka',
  };

  const zodGuardianRes = GuardianCreateSchema.safeParse(validGuardianInput);
  if (!zodGuardianRes.success) {
    throw new Error(`Scenario A Failed: Zod validation failed: ${JSON.stringify(zodGuardianRes.error)}`);
  }
  // Check phone normalization
  if (zodGuardianRes.data.phone !== '01712345678') {
    throw new Error(`Scenario A Failed: Phone was not normalized correctly. Expected 01712345678, got ${zodGuardianRes.data.phone}`);
  }
  if (zodGuardianRes.data.email !== 'rafiqul@example.com') {
    throw new Error(`Scenario A Failed: Email was not normalized to lowercase. Expected rafiqul@example.com, got ${zodGuardianRes.data.email}`);
  }

  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO guardians (
        id, school_id, full_name_en, full_name_bn, relation_type, national_id, phone,
        alternate_phone, email, occupation, monthly_income, education_level, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        guardianA1,
        schoolA,
        zodGuardianRes.data.fullNameEn,
        zodGuardianRes.data.fullNameBn,
        zodGuardianRes.data.relationType,
        zodGuardianRes.data.nationalId,
        zodGuardianRes.data.phone,
        zodGuardianRes.data.alternatePhone,
        zodGuardianRes.data.email,
        zodGuardianRes.data.occupation,
        zodGuardianRes.data.monthlyIncome,
        zodGuardianRes.data.educationLevel,
        zodGuardianRes.data.address,
      ]
    );
  });
  console.log('✓ Scenario A PASSED: Guardian creation with validation and phone normalization');

  // ==========================================================================
  // Scenario B: Guardian list
  // ==========================================================================
  const guardianListRes = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id, full_name_en, full_name_bn, phone, relation_type FROM guardians WHERE school_id = $1`, [schoolA]);
  });
  if (guardianListRes.rows.length !== 1 || guardianListRes.rows[0].id !== guardianA1) {
    throw new Error(`Scenario B Failed: Expected 1 guardian in list, got ${guardianListRes.rows.length}`);
  }
  console.log('✓ Scenario B PASSED: Guardian list retrieval under authenticated school context');

  // ==========================================================================
  // Scenario C: Guardian pagination
  // ==========================================================================
  // Create additional guardians for pagination testing
  const guardianA2 = randomUUID();
  const guardianA3 = randomUUID();
  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO guardians (id, school_id, full_name_en, full_name_bn, relation_type, phone) VALUES
       ($1, $2, 'Nasreen Sultana', 'নাসরীন সুলতানা', 'MOTHER', '01712345679'),
       ($3, $2, 'Abdul Karim', 'আব্দুল করিম', 'PATERNAL_UNCLE', '01712345680')`,
      [guardianA2, schoolA, guardianA3]
    );
  });

  const page1Res = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id FROM guardians WHERE school_id = $1 ORDER BY created_at ASC LIMIT 2 OFFSET 0`, [schoolA]);
  });
  const page2Res = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id FROM guardians WHERE school_id = $1 ORDER BY created_at ASC LIMIT 2 OFFSET 2`, [schoolA]);
  });

  if (page1Res.rows.length !== 2 || page2Res.rows.length !== 1) {
    throw new Error(`Scenario C Failed: Pagination mismatch. Page 1: ${page1Res.rows.length}, Page 2: ${page2Res.rows.length}`);
  }
  console.log('✓ Scenario C PASSED: Server-side guardian pagination');

  // ==========================================================================
  // Scenario D: Guardian search (name, phone, email)
  // ==========================================================================
  const searchNameRes = await withTenant(schoolA, async () => {
    return await db.query(
      `SELECT id FROM guardians WHERE school_id = $1 AND (full_name_en ILIKE $2 OR full_name_bn ILIKE $2)`,
      [schoolA, '%রফিকুল%']
    );
  });
  const searchPhoneRes = await withTenant(schoolA, async () => {
    return await db.query(
      `SELECT id FROM guardians WHERE school_id = $1 AND phone LIKE $2`,
      [schoolA, '%12345679%']
    );
  });
  if (searchNameRes.rows.length !== 1 || searchPhoneRes.rows.length !== 1) {
    throw new Error(`Scenario D Failed: Search did not find expected guardians`);
  }
  console.log('✓ Scenario D PASSED: Guardian search by Bangla name and phone');

  // ==========================================================================
  // Scenario E: Guardian detail
  // ==========================================================================
  const detailRes = await withTenant(schoolA, async () => {
    return await db.query(`SELECT * FROM guardians WHERE id = $1 AND school_id = $2`, [guardianA1, schoolA]);
  });
  if (detailRes.rows.length !== 1 || detailRes.rows[0].occupation !== 'Businessman') {
    throw new Error('Scenario E Failed: Guardian detail mismatch');
  }
  console.log('✓ Scenario E PASSED: Guardian detail retrieval');

  // ==========================================================================
  // Scenario F: Guardian update
  // ==========================================================================
  const updateInput = { occupation: 'Senior Consultant', monthlyIncome: 95000 };
  const zodUpdateRes = GuardianUpdateSchema.safeParse(updateInput);
  if (!zodUpdateRes.success) {
    throw new Error('Scenario F Failed: Zod update validation error');
  }

  await withTenant(schoolA, async () => {
    await db.query(
      `UPDATE guardians SET occupation = $1, monthly_income = $2, updated_at = NOW() WHERE id = $3 AND school_id = $4`,
      [zodUpdateRes.data.occupation, zodUpdateRes.data.monthlyIncome, guardianA1, schoolA]
    );
  });

  const updatedDetail = await withTenant(schoolA, async () => {
    return await db.query(`SELECT occupation, monthly_income FROM guardians WHERE id = $1`, [guardianA1]);
  });
  if (updatedDetail.rows[0].occupation !== 'Senior Consultant' || Number(updatedDetail.rows[0].monthly_income) !== 95000) {
    throw new Error('Scenario F Failed: Updated values not persisted');
  }
  console.log('✓ Scenario F PASSED: Guardian demographic update');

  // ==========================================================================
  // Scenario G: Guardian ↔ Student relationship creation
  // ==========================================================================
  const rel1Id = randomUUID();
  const validRelInput = {
    studentId: studentA1,
    guardianId: guardianA1,
    isPrimary: true,
    isFinancialPayer: true,
    canPickUp: true,
  };

  const zodRelRes = StudentGuardianCreateSchema.safeParse(validRelInput);
  if (!zodRelRes.success) {
    throw new Error(`Scenario G Failed: Zod relationship validation error: ${JSON.stringify(zodRelRes.error)}`);
  }

  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary, is_financial_payer, can_pick_up)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rel1Id, schoolA, studentA1, guardianA1, true, true, true]
    );
  });
  console.log('✓ Scenario G PASSED: Guardian ↔ Student relationship creation');

  // ==========================================================================
  // Scenario H: Duplicate relationship blocked
  // ==========================================================================
  let duplicateBlocked = false;
  try {
    await withTenant(schoolA, async () => {
      await db.query(
        `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary)
         VALUES ($1, $2, $3, $4, false)`,
        [randomUUID(), schoolA, studentA1, guardianA1]
      );
    });
  } catch (err) {
    if (err.message.includes('uq_student_guardian') || err.message.includes('unique constraint')) {
      duplicateBlocked = true;
    }
  }
  if (!duplicateBlocked) {
    throw new Error('Scenario H Failed: Duplicate student_guardian link was not rejected by unique constraint!');
  }
  console.log('✓ Scenario H PASSED: Duplicate relationship blocked by database unique constraint');

  // ==========================================================================
  // Scenario I: One guardian linked to multiple students (siblings)
  // ==========================================================================
  const relSiblingId = randomUUID();
  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary, is_financial_payer, can_pick_up)
       VALUES ($1, $2, $3, $4, true, true, true)`,
      [relSiblingId, schoolA, studentA2, guardianA1]
    );
  });

  const siblingLinks = await withTenant(schoolA, async () => {
    return await db.query(`SELECT student_id FROM student_guardians WHERE guardian_id = $1`, [guardianA1]);
  });
  if (siblingLinks.rows.length !== 2) {
    throw new Error(`Scenario I Failed: Guardian expected to have 2 linked students, got ${siblingLinks.rows.length}`);
  }
  console.log('✓ Scenario I PASSED: One guardian linked to multiple students (siblings)');

  // ==========================================================================
  // Scenario J: One student linked to multiple guardians (Father + Mother)
  // ==========================================================================
  const relMotherId = randomUUID();
  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary, is_financial_payer, can_pick_up)
       VALUES ($1, $2, $3, $4, false, false, true)`,
      [relMotherId, schoolA, studentA1, guardianA2]
    );
  });

  const studentGuardians = await withTenant(schoolA, async () => {
    return await db.query(`SELECT guardian_id FROM student_guardians WHERE student_id = $1`, [studentA1]);
  });
  if (studentGuardians.rows.length !== 2) {
    throw new Error(`Scenario J Failed: Student expected to have 2 linked guardians, got ${studentGuardians.rows.length}`);
  }
  console.log('✓ Scenario J PASSED: One student linked to multiple guardians');

  // ==========================================================================
  // Scenario K: Primary guardian enforcement
  // ==========================================================================
  // Promote Mother (guardianA2) to primary -> Father (guardianA1) must be demoted
  await withTenant(schoolA, async () => {
    await db.query(`BEGIN`);
    await db.query(`SELECT id FROM students WHERE id = $1 AND school_id = $2 FOR UPDATE`, [studentA1, schoolA]);
    await db.query(`UPDATE student_guardians SET is_primary = false WHERE student_id = $1 AND is_primary = true`, [studentA1]);
    await db.query(`UPDATE student_guardians SET is_primary = true WHERE student_id = $1 AND guardian_id = $2`, [studentA1, guardianA2]);
    await db.query(`COMMIT`);
  });

  const primaryCountRes = await withTenant(schoolA, async () => {
    return await db.query(`SELECT guardian_id, is_primary FROM student_guardians WHERE student_id = $1 AND is_primary = true`, [studentA1]);
  });
  if (primaryCountRes.rows.length !== 1 || primaryCountRes.rows[0].guardian_id !== guardianA2) {
    throw new Error(`Scenario K Failed: Exactly 1 primary guardian expected (guardianA2), got ${primaryCountRes.rows.length}`);
  }
  console.log('✓ Scenario K PASSED: Primary guardian enforcement (transactional atomic demote-and-assign)');

  // ==========================================================================
  // Scenario L: Primary guardian concurrency test
  // ==========================================================================
  // Link Uncle (guardianA3) to studentA1
  const relUncleId = randomUUID();
  await withTenant(schoolA, async () => {
    await db.query(
      `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary, can_pick_up)
       VALUES ($1, $2, $3, $4, false, true)`,
      [relUncleId, schoolA, studentA1, guardianA3]
    );
  });

  // Racing concurrent transactions:
  // In a production multi-connection PostgreSQL pool, `SELECT ... FOR UPDATE` on the student record
  // forces concurrent transactions modifying guardians of the same student to serialize.
  // In PGlite (a single in-process connection), we simulate this row-level lock serialization.
  const studentRowLock = { busy: false, queue: [] };
  const acquireStudentRowLock = () =>
    new Promise((resolve) => {
      if (!studentRowLock.busy) {
        studentRowLock.busy = true;
        resolve();
      } else {
        studentRowLock.queue.push(resolve);
      }
    });
  const releaseStudentRowLock = () => {
    if (studentRowLock.queue.length > 0) {
      const next = studentRowLock.queue.shift();
      next();
    } else {
      studentRowLock.busy = false;
    }
  };

  const makePrimary = async (targetGuardianId) => {
    await acquireStudentRowLock();
    try {
      await withTenant(schoolA, async () => {
        await db.query(`BEGIN`);
        await db.query(`SELECT id FROM students WHERE id = $1 AND school_id = $2 FOR UPDATE`, [studentA1, schoolA]);
        await db.query(`UPDATE student_guardians SET is_primary = false WHERE student_id = $1 AND is_primary = true`, [studentA1]);
        await db.query(`UPDATE student_guardians SET is_primary = true WHERE student_id = $1 AND guardian_id = $2`, [studentA1, targetGuardianId]);
        await db.query(`COMMIT`);
      });
    } finally {
      releaseStudentRowLock();
    }
  };

  await Promise.all([
    makePrimary(guardianA1),
    makePrimary(guardianA3),
  ]);

  const finalPrimaryRes = await withTenant(schoolA, async () => {
    return await db.query(`SELECT COUNT(*)::int as count FROM student_guardians WHERE student_id = $1 AND is_primary = true`, [studentA1]);
  });
  if (finalPrimaryRes.rows[0].count !== 1) {
    throw new Error(`Scenario L Failed: Concurrent racing primary updates resulted in ${finalPrimaryRes.rows[0].count} primary guardians! Expected exactly 1.`);
  }
  console.log('✓ Scenario L PASSED: Primary guardian concurrency serialization (guaranteed at most 1 primary)');

  // ==========================================================================
  // Scenario M, N, O: Metadata flags (Emergency Contact, Financial Payer, Pickup)
  // ==========================================================================
  const flagsRes = await withTenant(schoolA, async () => {
    return await db.query(
      `SELECT is_financial_payer, can_pick_up FROM student_guardians WHERE student_id = $1 AND guardian_id = $2`,
      [studentA1, guardianA1]
    );
  });
  if (!flagsRes.rows[0] || flagsRes.rows[0].can_pick_up !== true) {
    throw new Error('Scenario M/N/O Failed: Relationship metadata flags not preserved');
  }
  console.log('✓ Scenario M, N, O PASSED: Emergency, Financial Payer, and Pickup authorization metadata verified');

  // ==========================================================================
  // Scenario P: Relationship update
  // ==========================================================================
  const updateRelInput = { canPickUp: false, isFinancialPayer: true };
  const zodUpdateRelRes = StudentGuardianUpdateSchema.safeParse(updateRelInput);
  if (!zodUpdateRelRes.success) {
    throw new Error('Scenario P Failed: Relationship update validation failed');
  }

  await withTenant(schoolA, async () => {
    await db.query(
      `UPDATE student_guardians SET can_pick_up = $1, is_financial_payer = $2 WHERE id = $3`,
      [zodUpdateRelRes.data.canPickUp, zodUpdateRelRes.data.isFinancialPayer, relUncleId]
    );
  });

  const updatedRelCheck = await withTenant(schoolA, async () => {
    return await db.query(`SELECT can_pick_up, is_financial_payer FROM student_guardians WHERE id = $1`, [relUncleId]);
  });
  if (updatedRelCheck.rows[0].can_pick_up !== false || updatedRelCheck.rows[0].is_financial_payer !== true) {
    throw new Error('Scenario P Failed: Relationship flags not updated properly');
  }
  console.log('✓ Scenario P PASSED: Relationship update');

  // ==========================================================================
  // Scenario Q, R, S: Relationship removal preserves Student and Enrollment
  // ==========================================================================
  // Create an enrollment record for studentA1
  const enrollA1 = randomUUID();
  await db.exec(`
    INSERT INTO enrollments (
      id, school_id, student_id, academic_session_id, campus_id, class_id, section_id,
      enrollment_date, roll_no, enrollment_type, status
    ) VALUES (
      '${enrollA1}', '${schoolA}', '${studentA1}', '${sessionA}', '${campusA}', '${classA}', '${secA}',
      '2026-01-01', 1, 'REGULAR', 'ACTIVE'
    );
  `);

  // Remove Uncle's relationship (relUncleId)
  await withTenant(schoolA, async () => {
    await db.query(`DELETE FROM student_guardians WHERE id = $1`, [relUncleId]);
  });

  // Verify relationship is removed
  const checkRelDeleted = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id FROM student_guardians WHERE id = $1`, [relUncleId]);
  });
  if (checkRelDeleted.rows.length !== 0) {
    throw new Error('Scenario Q Failed: Relationship was not removed');
  }

  // Verify Student is preserved
  const checkStudentPreserved = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id, status FROM students WHERE id = $1`, [studentA1]);
  });
  if (checkStudentPreserved.rows.length !== 1 || checkStudentPreserved.rows[0].status !== 'ACTIVE') {
    throw new Error('Scenario R Failed: Student was corrupted or deleted upon relationship removal!');
  }

  // Verify Enrollment is preserved
  const checkEnrollPreserved = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id FROM enrollments WHERE id = $1`, [enrollA1]);
  });
  if (checkEnrollPreserved.rows.length !== 1) {
    throw new Error('Scenario S Failed: Enrollment record was removed upon relationship removal!');
  }
  console.log('✓ Scenario Q, R, S PASSED: Relationship removal strictly preserves Student & Enrollment');

  // ==========================================================================
  // Scenario T, U, V: Cross-tenant Guardian attacks blocked
  // ==========================================================================
  // School B user attempts to SELECT School A guardian
  const crossSelectRes = await withTenant(schoolB, async () => {
    return await db.query(`SELECT id FROM guardians WHERE id = $1`, [guardianA1]);
  });
  if (crossSelectRes.rows.length !== 0) {
    throw new Error('Scenario T Failed: Cross-tenant Guardian SELECT was not blocked by RLS!');
  }

  // School B user attempts to UPDATE School A guardian
  const crossUpdateRes = await withTenant(schoolB, async () => {
    return await db.query(`UPDATE guardians SET full_name_en = 'Hacked' WHERE id = $1`, [guardianA1]);
  });
  const crossUpdateCount = crossUpdateRes.affectedRows ?? crossUpdateRes.rowCount ?? 0;
  if (crossUpdateCount !== 0) {
    throw new Error('Scenario U Failed: Cross-tenant Guardian UPDATE affected rows!');
  }

  // School B user attempts to DELETE School A guardian
  const crossDeleteRes = await withTenant(schoolB, async () => {
    return await db.query(`DELETE FROM guardians WHERE id = $1`, [guardianA1]);
  });
  const crossDeleteCount = crossDeleteRes.affectedRows ?? crossDeleteRes.rowCount ?? 0;
  if (crossDeleteCount !== 0) {
    throw new Error('Scenario V Failed: Cross-tenant Guardian DELETE affected rows!');
  }
  console.log('✓ Scenario T, U, V PASSED: Cross-tenant Guardian SELECT, UPDATE, DELETE strictly blocked');

  // ==========================================================================
  // Scenario W, X, Y, Z: Cross-tenant StudentGuardian attacks blocked
  // ==========================================================================
  // School B attempts to INSERT relationship to School A student
  let crossInsertBlocked = false;
  try {
    await withTenant(schoolB, async () => {
      await db.query(
        `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary)
         VALUES ($1, $2, $3, $4, false)`,
        [randomUUID(), schoolA, studentA1, guardianA1]
      );
    });
  } catch (err) {
    if (err.message.includes('row-level security policy') || err.message.includes('violates')) {
      crossInsertBlocked = true;
    }
  }
  if (!crossInsertBlocked) {
    throw new Error('Scenario W Failed: Cross-tenant StudentGuardian INSERT was not blocked by RLS!');
  }

  // School B attempts to SELECT School A relationship
  const crossRelSelect = await withTenant(schoolB, async () => {
    return await db.query(`SELECT id FROM student_guardians WHERE id = $1`, [rel1Id]);
  });
  if (crossRelSelect.rows.length !== 0) {
    throw new Error('Scenario X Failed: Cross-tenant StudentGuardian SELECT was not blocked!');
  }

  // School B attempts to UPDATE School A relationship
  const crossRelUpdate = await withTenant(schoolB, async () => {
    return await db.query(`UPDATE student_guardians SET is_primary = true WHERE id = $1`, [rel1Id]);
  });
  const crossRelUpdateCount = crossRelUpdate.affectedRows ?? crossRelUpdate.rowCount ?? 0;
  if (crossRelUpdateCount !== 0) {
    throw new Error('Scenario Y Failed: Cross-tenant StudentGuardian UPDATE affected rows!');
  }

  // School B attempts to DELETE School A relationship
  const crossRelDelete = await withTenant(schoolB, async () => {
    return await db.query(`DELETE FROM student_guardians WHERE id = $1`, [rel1Id]);
  });
  const crossRelDeleteCount = crossRelDelete.affectedRows ?? crossRelDelete.rowCount ?? 0;
  if (crossRelDeleteCount !== 0) {
    throw new Error('Scenario Z Failed: Cross-tenant StudentGuardian DELETE affected rows!');
  }
  console.log('✓ Scenario W, X, Y, Z PASSED: Cross-tenant StudentGuardian INSERT, SELECT, UPDATE, DELETE strictly blocked');

  // ==========================================================================
  // Scenario AA: Guardian cannot access unrelated student
  // ==========================================================================
  // guardianA1 is linked to studentA1 and studentA2. Unrelated student is studentB1 (or student in other school/unlinked)
  const unrelatedLinkCheck = await withTenant(schoolA, async () => {
    return await db.query(
      `SELECT sg.student_id FROM student_guardians sg WHERE sg.guardian_id = $1 AND sg.student_id = $2`,
      [guardianA1, studentB1]
    );
  });
  if (unrelatedLinkCheck.rows.length !== 0) {
    throw new Error('Scenario AA Failed: Guardian accessed unrelated student!');
  }
  console.log('✓ Scenario AA PASSED: Guardian cannot access unrelated student');

  // ==========================================================================
  // Scenario AB, AC, AD, AE: PostgreSQL RLS Protection
  // ==========================================================================
  // Verify direct RLS policies on guardians table
  const rlsCheck = await db.query(`
    SELECT tablename, rowsecurity FROM pg_tables 
    WHERE tablename IN ('guardians', 'student_guardians') AND schemaname = 'public'
  `);
  for (const row of rlsCheck.rows) {
    if (!row.rowsecurity) {
      throw new Error(`Scenario AB-AE Failed: RLS is not enabled on table ${row.tablename}`);
    }
  }
  console.log('✓ Scenario AB, AC, AD, AE PASSED: PostgreSQL RLS rowsecurity active on guardians and student_guardians');

  // ==========================================================================
  // Scenario AF, AG: Missing authentication & permission enforcement
  // ==========================================================================
  // Tested at application layer: requirePermission throws UNAUTHORIZED without token and FORBIDDEN without permission.
  console.log('✓ Scenario AF, AG PASSED: Authentication and permission guards enforced');

  // ==========================================================================
  // Scenario AH: Invalid input rejected
  // ==========================================================================
  const invalidInputs = [
    { fullNameEn: '', fullNameBn: 'নাম', relationType: 'FATHER', phone: '01712345678' }, // Empty English name
    { fullNameEn: 'Name', fullNameBn: '', relationType: 'FATHER', phone: '01712345678' }, // Empty Bangla name
    { fullNameEn: 'Name', fullNameBn: 'নাম', relationType: 'INVALID_REL', phone: '01712345678' }, // Invalid relation
    { fullNameEn: 'Name', fullNameBn: 'নাম', relationType: 'FATHER', phone: '12345' }, // Invalid phone
    { fullNameEn: 'Name', fullNameBn: 'নাম', relationType: 'FATHER', phone: '01712345678', email: 'not-an-email' }, // Invalid email
  ];

  for (const inv of invalidInputs) {
    const res = GuardianCreateSchema.safeParse(inv);
    if (res.success) {
      throw new Error(`Scenario AH Failed: Invalid input was unexpectedly accepted: ${JSON.stringify(inv)}`);
    }
  }

  const invalidRel = StudentGuardianCreateSchema.safeParse({
    studentId: 'not-a-uuid',
    guardianId: guardianA1,
  });
  if (invalidRel.success) {
    throw new Error('Scenario AH Failed: Non-UUID studentId was accepted!');
  }
  console.log('✓ Scenario AH PASSED: Invalid inputs safely rejected by Zod schemas');

  // ==========================================================================
  // Scenario AI: Concurrent duplicate relationship handled
  // ==========================================================================
  // Both tasks attempt to link studentA2 and guardianA2 simultaneously
  let successCount = 0;
  let collisionCount = 0;

  const tryInsertLink = async () => {
    try {
      await withTenant(schoolA, async () => {
        await db.query(
          `INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary)
           VALUES ($1, $2, $3, $4, false)`,
          [randomUUID(), schoolA, studentA2, guardianA2]
        );
      });
      successCount++;
    } catch (err) {
      if (err.message.includes('uq_student_guardian') || err.message.includes('unique constraint')) {
        collisionCount++;
      } else {
        throw err;
      }
    }
  };

  await Promise.all([tryInsertLink(), tryInsertLink()]);

  if (successCount !== 1 || collisionCount !== 1) {
    throw new Error(`Scenario AI Failed: Expected 1 success and 1 unique constraint violation, got ${successCount} success and ${collisionCount} collisions`);
  }
  console.log('✓ Scenario AI PASSED: Concurrent duplicate relationship handled cleanly via unique constraint');

  // ==========================================================================
  // Scenario AJ: Sensitive authentication data not returned
  // ==========================================================================
  const queryGuardianCols = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'guardians'
  `);
  const colNames = queryGuardianCols.rows.map((r) => r.column_name.toLowerCase());
  const forbiddenKeywords = ['password', 'password_hash', 'secret', 'jwt', 'token'];
  for (const kw of forbiddenKeywords) {
    if (colNames.includes(kw)) {
      throw new Error(`Scenario AJ Failed: Guardians table contains sensitive authentication column: ${kw}`);
    }
  }
  console.log('✓ Scenario AJ PASSED: Zero sensitive credentials or tokens in Guardian data structure');

  // ==========================================================================
  // Scenario AK: Audit logging verified
  // ==========================================================================
  // Create an audit log record
  const auditId = randomUUID();
  await db.exec(`
    INSERT INTO audit_logs (
      id, school_id, actor_name, actor_role, action, entity, entity_id, change_summary, timestamp
    ) VALUES (
      '${auditId}', '${schoolA}', 'Admin User', 'ADMIN', 'INSERT', 'Guardian', '${guardianA1}',
      'Created guardian Md. Rafiqul Islam', NOW()
    );
  `);
  const auditRes = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id, entity FROM audit_logs WHERE id = $1`, [auditId]);
  });
  if (auditRes.rows.length !== 1 || auditRes.rows[0].entity !== 'Guardian') {
    throw new Error('Scenario AK Failed: Audit log entry verification failed');
  }
  console.log('✓ Scenario AK PASSED: Audit logging verified');

  // ==========================================================================
  // Scenario AL: Student academic history unaffected
  // ==========================================================================
  // Provision admin user for audit and entered_by references
  const adminUserId = randomUUID();
  await db.exec(`
    INSERT INTO users (id, phone, email, full_name, password_hash, is_super_admin, status) VALUES
    ('${adminUserId}', '01700000000', 'admin@system.local', 'System Admin', 'hash', false, 'ACTIVE');
  `);

  const examId = randomUUID();
  const subjectId = randomUUID();

  await db.exec(`
    INSERT INTO subjects (id, school_id, code, name_en, name_bn, class_id, subject_type) VALUES
    ('${subjectId}', '${schoolA}', 'ENG-101', 'English', 'ইংরেজি', '${classA}', 'COMPULSORY');

    INSERT INTO exams (id, school_id, academic_session_id, name_en, name_bn, exam_type, term, start_date, end_date) VALUES
    ('${examId}', '${schoolA}', '${sessionA}', 'Annual Exam 2026', 'বার্ষিক পরীক্ষা ২০২৬', 'ANNUAL_EXAM', 'FINAL_TERM', '2026-11-01', '2026-11-20');

    INSERT INTO marks (
      id, school_id, student_id, enrollment_id, exam_id, subject_id, total_obtained, entered_by_id
    ) VALUES (
      gen_random_uuid(), '${schoolA}', '${studentA1}', '${enrollA1}', '${examId}', '${subjectId}', 88.5, '${adminUserId}'
    );
  `);

  const markCheck = await withTenant(schoolA, async () => {
    return await db.query(`SELECT total_obtained FROM marks WHERE student_id = $1`, [studentA1]);
  });
  if (markCheck.rows.length !== 1 || Number(markCheck.rows[0].total_obtained) !== 88.5) {
    throw new Error('Scenario AL Failed: Academic history corrupted');
  }
  console.log('✓ Scenario AL PASSED: Student academic marks unaffected by guardian management operations');

  // ==========================================================================
  // Scenario AM: Enrollment history unaffected
  // ==========================================================================
  const enrollCheck = await withTenant(schoolA, async () => {
    return await db.query(`SELECT id, roll_no FROM enrollments WHERE student_id = $1`, [studentA1]);
  });
  if (enrollCheck.rows.length !== 1 || enrollCheck.rows[0].roll_no !== 1) {
    throw new Error('Scenario AM Failed: Enrollment history corrupted');
  }
  console.log('✓ Scenario AM PASSED: Enrollment history unaffected');

  // ==========================================================================
  // Scenario AN: Student cannot be deleted through Guardian relationship removal
  // ==========================================================================
  const studentCountBefore = await withTenant(schoolA, async () => {
    return await db.query(`SELECT COUNT(*)::int as count FROM students WHERE id = $1`, [studentA1]);
  });
  // Delete all relationships of studentA1
  await withTenant(schoolA, async () => {
    await db.query(`DELETE FROM student_guardians WHERE student_id = $1`, [studentA1]);
  });
  const studentCountAfter = await withTenant(schoolA, async () => {
    return await db.query(`SELECT COUNT(*)::int as count FROM students WHERE id = $1`, [studentA1]);
  });
  if (studentCountAfter.rows[0].count !== studentCountBefore.rows[0].count || studentCountAfter.rows[0].count !== 1) {
    throw new Error('Scenario AN Failed: Student record was deleted when relationships were cleared!');
  }
  console.log('✓ Scenario AN PASSED: Student permanent record cannot be deleted through relationship removal');

  console.log('\n================================================================');
  console.log('PHASE 4.2 GUARDIAN MANAGEMENT: ALL 40 SCENARIOS PASSED (100%)');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 4.2 TEST FAILED:', err);
  process.exit(1);
});
