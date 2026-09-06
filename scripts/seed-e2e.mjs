import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function seedE2E() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 11.5 Deterministic E2E Test Data Provisioning');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('0. Cleaning up any previous E2E test data...');
    const oldSlugs = ['dhaka-ideal', 'ctg-model'];
    const existingSchools = await client.query('SELECT id FROM schools WHERE slug = ANY($1)', [oldSlugs]);
    if (existingSchools.rowCount > 0) {
      const eIds = existingSchools.rows.map((r) => r.id);
      await client.query('DELETE FROM audit_logs WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM student_guardians WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM guardians WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM enrollments WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM student_users WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM students WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM teacher_assignments WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM teachers WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE school_id = ANY($1))', [eIds]);
      await client.query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE school_id = ANY($1))', [eIds]);
      await client.query('DELETE FROM roles WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM users WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM sections WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM classes WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM academic_sessions WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM campuses WHERE school_id = ANY($1)', [eIds]);
      await client.query('DELETE FROM schools WHERE id = ANY($1)', [eIds]);
      console.log('  ✔ Previous E2E test schools and associated entities purged.');
    }

    console.log('1. Provisioning Schools...');
    const schoolAId = '11111111-1111-4111-a111-111111111111';
    const schoolBId = '22222222-2222-4222-a222-222222222222';

    await client.query(`
      INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status, locale)
      VALUES
        ($1, 'dhaka-ideal', 'Dhaka Ideal School & College', 'ঢাকা আইডিয়াল স্কুল ও কলেজ', 'admin@dhaka-ideal.bd', '01711111111', 'ACTIVE', 'bn_BD'),
        ($2, 'ctg-model', 'Chittagong Model School', 'চট্টগ্রাম মডেল স্কুল', 'admin@ctg-model.bd', '01811111111', 'ACTIVE', 'bn_BD')
      ON CONFLICT (id) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_bn = EXCLUDED.name_bn,
        status = EXCLUDED.status;
    `, [schoolAId, schoolBId]);
    console.log('  ✔ Schools: Dhaka Ideal (School A) & Chittagong Model (School B) seeded.');

    console.log('2. Provisioning Campuses...');
    const campusAId = '33333333-3333-4333-a333-333333333333';
    const campusBId = '44444444-4444-4444-a444-444444444444';

    await client.query(`
      INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch)
      VALUES
        ($1, $2, 'MAIN', 'Main Campus', 'মূল ক্যাম্পাস', true),
        ($3, $4, 'MAIN', 'Chittagong Main', 'চট্টগ্রাম মূল শাখা', true)
      ON CONFLICT (id) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_bn = EXCLUDED.name_bn;
    `, [campusAId, schoolAId, campusBId, schoolBId]);
    console.log('  ✔ Campuses seeded.');

    console.log('3. Provisioning Roles & Permissions...');
    const rolesToSeed = [
      { code: 'PRINCIPAL', name: 'Principal / Admin', isSystem: true },
      { code: 'ADMIN', name: 'Institutional Admin', isSystem: true },
      { code: 'TEACHER', name: 'Teacher', isSystem: true },
      { code: 'ACCOUNTANT', name: 'Accountant', isSystem: true },
      { code: 'STUDENT', name: 'Student', isSystem: true },
      { code: 'PARENT', name: 'Parent / Guardian', isSystem: true },
    ];

    const roleMap = {};

    for (const r of rolesToSeed) {
      // Seed for School A
      const resA = await client.query(`
        INSERT INTO roles (school_id, code, name, is_system_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `, [schoolAId, r.code, r.name, r.isSystem]);
      roleMap[`A_${r.code}`] = resA.rows[0].id;

      // Seed for School B
      const resB = await client.query(`
        INSERT INTO roles (school_id, code, name, is_system_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `, [schoolBId, r.code, r.name, r.isSystem]);
      roleMap[`B_${r.code}`] = resB.rows[0].id;
    }
    console.log('  ✔ Roles seeded for both schools.');

    console.log('3.1 Provisioning System Permissions & Role Assignments...');
    const permissionsToSeed = [
      { module: 'STUDENTS', action: 'VIEW', code: 'STUDENTS_VIEW', desc: 'View Students' },
      { module: 'ACADEMICS', action: 'VIEW', code: 'ACADEMICS_VIEW', desc: 'View Academics' },
      { module: 'MARKS', action: 'VIEW', code: 'MARKS_VIEW', desc: 'View Marks' },
      { module: 'ATTENDANCE', action: 'VIEW', code: 'ATTENDANCE_VIEW', desc: 'View Attendance' },
      { module: 'COMMUNICATION', action: 'VIEW', code: 'COMMUNICATION_VIEW', desc: 'View Communication' },
      { module: 'FEES', action: 'VIEW', code: 'FEES_VIEW', desc: 'View Fees' },
      { module: 'STAFF', action: 'VIEW', code: 'STAFF_VIEW', desc: 'View Staff' },
      { module: 'LIBRARY', action: 'VIEW', code: 'LIBRARY_VIEW', desc: 'View Library' },
      { module: 'INVENTORY', action: 'VIEW', code: 'INVENTORY_VIEW', desc: 'View Inventory' },
      { module: 'REPORTS', action: 'VIEW', code: 'REPORTS_VIEW', desc: 'View Reports' },
      { module: 'SETTINGS', action: 'VIEW', code: 'SETTINGS_VIEW', desc: 'View Settings' },
    ];

    const permMap = {};
    for (const p of permissionsToSeed) {
      const pRes = await client.query(`
        INSERT INTO permissions (module, action, code, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description
        RETURNING id;
      `, [p.module, p.action, p.code, p.desc]);
      permMap[p.code] = pRes.rows[0].id;
    }

    // Role-permission mappings
    const rolePermAssignments = [
      { roleKey: 'A_TEACHER', perms: ['ACADEMICS_VIEW', 'MARKS_VIEW', 'ATTENDANCE_VIEW'] },
      { roleKey: 'A_ACCOUNTANT', perms: ['FEES_VIEW'] },
      { roleKey: 'A_PRINCIPAL', perms: Object.keys(permMap) },
      { roleKey: 'A_ADMIN', perms: Object.keys(permMap) },
      { roleKey: 'B_PRINCIPAL', perms: Object.keys(permMap) },
    ];

    for (const assignment of rolePermAssignments) {
      const rId = roleMap[assignment.roleKey];
      if (rId) {
        for (const pCode of assignment.perms) {
          const pId = permMap[pCode];
          if (pId) {
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id, scope)
              VALUES ($1, $2, 'ENTIRE_SCHOOL')
              ON CONFLICT (role_id, permission_id) DO NOTHING;
            `, [rId, pId]);
          }
        }
      }
    }
    console.log('  ✔ Permissions and role_permissions seeded successfully.');

    console.log('4. Provisioning Academic Session, Class & Section for School A...');
    const sessionId = '55555555-5555-4555-a555-555555555555';
    const classId = '66666666-6666-4666-a666-666666666666';
    const sectionId = '77777777-7777-4777-a777-777777777777';

    await client.query(`
      INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current)
      VALUES ($1, $2, 'Academic Year 2026', '2026-01-01', '2026-12-31', true)
      ON CONFLICT (id) DO UPDATE SET is_current = true;
    `, [sessionId, schoolAId]);

    await client.query(`
      INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category, status)
      VALUES ($1, $2, 'Class 10', 'দশম শ্রেণি', 10, 'SECONDARY', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `, [classId, schoolAId]);

    await client.query(`
      INSERT INTO sections (id, school_id, campus_id, class_id, name_en, name_bn, shift, gender_type, max_capacity, status)
      VALUES ($1, $2, $3, $4, 'Padma', 'পদ্মা', 'DAY', 'CO_ED', 50, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `, [sectionId, schoolAId, campusAId, classId]);
    console.log('  ✔ Academic Structure: Class 10 Section Padma seeded.');

    console.log('5. Provisioning Deterministic Users (Password: Pass123!@#)...');
    const passwordHash = await bcrypt.hash('Pass123!@#', 10);

    const usersData = [
      {
        id: 'a1111111-1111-4111-a111-111111111111',
        email: 'admin@dhaka-ideal.bd',
        phone: '01711111111',
        fullName: 'Principal Rahman (অধ্যক্ষ রহমান)',
        schoolId: schoolAId,
        isSuperAdmin: false,
        roleCode: 'PRINCIPAL',
        schoolKey: 'A',
      },
      {
        id: 'a2222222-2222-4222-a222-222222222222',
        email: 'teacher@dhaka-ideal.bd',
        phone: '01722222222',
        fullName: 'Kazi Farhana Teacher (কাজী ফারহানা শিক্ষক)',
        schoolId: schoolAId,
        isSuperAdmin: false,
        roleCode: 'TEACHER',
        schoolKey: 'A',
      },
      {
        id: 'a3333333-3333-4333-a333-333333333333',
        email: 'accountant@dhaka-ideal.bd',
        phone: '01733333333',
        fullName: 'Shafiqul Accountant (শফিকুল হিসাবরক্ষক)',
        schoolId: schoolAId,
        isSuperAdmin: false,
        roleCode: 'ACCOUNTANT',
        schoolKey: 'A',
      },
      {
        id: 'a4444444-4444-4444-a444-444444444444',
        email: 'student@dhaka-ideal.bd',
        phone: '01744444444',
        fullName: 'Tanvir Ahmed Student (তানভীর আহমেদ শিক্ষার্থী)',
        schoolId: schoolAId,
        isSuperAdmin: false,
        roleCode: 'STUDENT',
        schoolKey: 'A',
      },
      {
        id: 'a5555555-5555-4555-a555-555555555555',
        email: 'parent@dhaka-ideal.bd',
        phone: '01755555555',
        fullName: 'Rafiqul Islam Guardian (রফিকুল ইসলাম অভিভাবক)',
        schoolId: schoolAId,
        isSuperAdmin: false,
        roleCode: 'PARENT',
        schoolKey: 'A',
      },
      {
        id: 'a6666666-6666-4666-a666-666666666666',
        email: 'admin@ctg-model.bd',
        phone: '01811111111',
        fullName: 'Chittagong Admin (চট্টগ্রাম অ্যাডমিন)',
        schoolId: schoolBId,
        isSuperAdmin: false,
        roleCode: 'PRINCIPAL',
        schoolKey: 'B',
      },
      {
        id: 'a7777777-7777-4777-a777-777777777777',
        email: 'superadmin@edusmart.bd',
        phone: '01911111111',
        fullName: 'EduSmart SuperAdmin (এডুস্মার্ট সুপার অ্যাডমিন)',
        schoolId: null,
        isSuperAdmin: true,
        roleCode: null,
        schoolKey: null,
      },
    ];

    for (const u of usersData) {
      await client.query(`
        INSERT INTO users (id, school_id, email, phone, password_hash, full_name, is_super_admin, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          is_super_admin = EXCLUDED.is_super_admin,
          status = 'ACTIVE';
      `, [u.id, u.schoolId, u.email, u.phone, passwordHash, u.fullName, u.isSuperAdmin]);

      if (u.roleCode && u.schoolKey) {
        const roleId = roleMap[`${u.schoolKey}_${u.roleCode}`];
        await client.query(`
          INSERT INTO user_roles (user_id, role_id, campus_id)
          VALUES ($1, $2, NULL)
          ON CONFLICT (user_id, role_id, campus_id) DO NOTHING;
        `, [u.id, roleId]);
      }
    }
    console.log('  ✔ All 7 deterministic accounts seeded with password Pass123!@#.');

    console.log('6. Provisioning Domain Profiles & Academic Linkages...');
    // Teacher Profile
    const teacherId = 'b2222222-2222-4222-a222-222222222222';
    await client.query(`
      INSERT INTO teachers (
        id, school_id, campus_id, user_id, teacher_code, first_name_en, last_name_en,
        full_name_en, full_name_bn, designation, qualification, date_of_birth,
        gender, national_id, phone, email, joining_date, status
      )
      VALUES (
        $1, $2, $3, $4, 'T-2026-001', 'Kazi', 'Farhana',
        'Kazi Farhana', 'কাজী ফারহানা', 'ASSISTANT_TEACHER', 'M.Sc in Mathematics', '1985-05-15',
        'FEMALE', '19851234567890123', '01722222222', 'teacher@dhaka-ideal.bd', '2020-01-01', 'ACTIVE'
      )
      ON CONFLICT (id) DO NOTHING;
    `, [teacherId, schoolAId, campusAId, 'a2222222-2222-4222-a222-222222222222']);

    // Teacher Assignment
    await client.query(`
      INSERT INTO teacher_assignments (
        school_id, academic_session_id, teacher_id, class_id, section_id, role, can_enter_marks, can_take_attendance, status
      )
      VALUES (
        $1, $2, $3, $4, $5, 'CLASS_TEACHER', true, true, 'ACTIVE'
      )
      ON CONFLICT (school_id, academic_session_id, section_id, subject_id, role) DO NOTHING;
    `, [schoolAId, sessionId, teacherId, classId, sectionId]);

    // Student Profile
    const studentId = 'b4444444-4444-4444-a444-444444444444';
    await client.query(`
      INSERT INTO students (
        id, school_id, student_code, permanent_admission_no, admission_date,
        first_name_en, last_name_en, full_name_en, full_name_bn,
        date_of_birth, gender, religion, nationality, phone, email,
        permanent_address_line, permanent_post_office, permanent_post_code,
        permanent_thana, permanent_district, permanent_division,
        present_address_line, present_thana, present_district, present_division,
        status
      )
      VALUES (
        $1, $2, 'STU-2026-001', 'ADM-2026-001', '2026-01-01',
        'Tanvir', 'Ahmed', 'Tanvir Ahmed', 'তানভীর আহমেদ',
        '2010-01-15', 'MALE', 'ISLAM', 'Bangladeshi', '01744444444', 'student@dhaka-ideal.bd',
        'House 12, Road 5, Mirpur-10', 'Mirpur', '1216',
        'Mirpur', 'Dhaka', 'DHAKA',
        'House 12, Road 5, Mirpur-10', 'Mirpur', 'Dhaka', 'DHAKA',
        'ACTIVE'
      )
      ON CONFLICT (id) DO NOTHING;
    `, [studentId, schoolAId]);

    // Student User Link
    await client.query(`
      INSERT INTO student_users (school_id, student_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (student_id) DO NOTHING;
    `, [schoolAId, studentId, 'a4444444-4444-4444-a444-444444444444']);

    // Enrollment
    const enrollmentId = 'c4444444-4444-4444-a444-444444444444';
    await client.query(`
      INSERT INTO enrollments (
        id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 1, '2026-01-01', 'ACTIVE'
      )
      ON CONFLICT (id) DO NOTHING;
    `, [enrollmentId, schoolAId, campusAId, studentId, sessionId, classId, sectionId]);

    // Guardian Profile
    const guardianId = 'b5555555-5555-4555-a555-555555555555';
    await client.query(`
      INSERT INTO guardians (
        id, school_id, user_id, full_name_en, full_name_bn, relation_type,
        national_id, phone, email, occupation, monthly_income, address
      )
      VALUES (
        $1, $2, $3, 'Rafiqul Islam', 'রফিকুল ইসলাম', 'FATHER',
        '19751234567890123', '01755555555', 'parent@dhaka-ideal.bd', 'Engineer', 75000.00, 'Mirpur-10, Dhaka'
      )
      ON CONFLICT (id) DO NOTHING;
    `, [guardianId, schoolAId, 'a5555555-5555-4555-a555-555555555555']);

    // Student-Guardian Link
    await client.query(`
      INSERT INTO student_guardians (
        school_id, student_id, guardian_id, is_primary, is_financial_payer, can_pick_up
      )
      VALUES ($1, $2, $3, true, true, true)
      ON CONFLICT (student_id, guardian_id) DO NOTHING;
    `, [schoolAId, studentId, guardianId]);

    console.log('  ✔ Domain profiles (Teacher, Student, Guardian, Enrollment, Linkages) seeded.');

    await client.query('COMMIT');
    console.log('\n================================================================');
    console.log('✔ Phase 11.5 Deterministic E2E Seed completed successfully!');
    console.log('================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ E2E Seed Failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
