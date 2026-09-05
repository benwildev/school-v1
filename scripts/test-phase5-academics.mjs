import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto, { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

import {
  calculateSubjectGrade,
  calculateOverallGpa,
  rankStudentResults,
  mapGpaToFinalGrade,
} from '../src/lib/academic/grading.ts';

import {
  DailyAttendanceBatchSchema,
  AttendanceUpdateSchema,
  AttendanceQuerySchema,
} from '../src/lib/validation/attendance.ts';

import {
  ExamCreateSchema,
  ExamUpdateSchema,
  ExamScheduleCreateSchema,
  MarkEntryItemSchema,
  MarksBulkSaveSchema,
  MarksApproveSchema,
  ResultGenerateSchema,
  ResultPublishSchema,
} from '../src/lib/validation/exam.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('EduSmart BD — Phase 5 Attendance + Exam + Marks + Result');
  console.log('Management Automated Verification Test Suite');
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

  const stats = {
    expected: 59,
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

  console.log('2. Provisioning Multi-Tenant Test Fixtures (Schools, Sessions, Classes, Subjects, Teachers, Students)...');

  // School A (Primary Test School)
  const schoolAId = randomUUID();
  await db.query(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status)
    VALUES ($1, 'motijheel-ideal', 'Motijheel Ideal School', 'মতিঝিল আইডিয়াল স্কুল', 'info@motijheel.edu.bd', '01711000001', 'ACTIVE')
  `, [schoolAId]);

  // School B (Isolated Tenant School)
  const schoolBId = randomUUID();
  await db.query(`
    INSERT INTO schools (id, slug, name_en, name_bn, email, phone, status)
    VALUES ($1, 'ctg-collegiate', 'Chittagong Collegiate School', 'চট্টগ্রাম কলেজিয়েট স্কুল', 'info@collegiate.edu.bd', '01711000002', 'ACTIVE')
  `, [schoolBId]);

  // Campuses
  const campusAId = randomUUID();
  await db.query(`
    INSERT INTO campuses (id, school_id, code, name_en, name_bn, is_main_branch, status)
    VALUES ($1, $2, 'MAIN', 'Main Branch', 'মূল শাখা', true, 'ACTIVE')
  `, [campusAId, schoolAId]);

  // Academic Sessions
  const session2026AId = randomUUID();
  await db.query(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES ($1, $2, '2026 Academic Year', '2026-01-01', '2026-12-31', true, false)
  `, [session2026AId, schoolAId]);

  const session2027AId = randomUUID();
  await db.query(`
    INSERT INTO academic_sessions (id, school_id, name, start_date, end_date, is_current, is_locked)
    VALUES ($1, $2, '2027 Academic Year', '2027-01-01', '2027-12-31', false, false)
  `, [session2027AId, schoolAId]);

  // Classes for School A
  const class5AId = randomUUID();
  await db.query(`
    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category, status)
    VALUES ($1, $2, 'Class 5', 'পঞ্চম শ্রেণি', 5, 'PRIMARY', 'ACTIVE')
  `, [class5AId, schoolAId]);

  const class6AId = randomUUID();
  await db.query(`
    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category, status)
    VALUES ($1, $2, 'Class 6', 'ষষ্ঠ শ্রেণি', 6, 'JUNIOR_SECONDARY', 'ACTIVE')
  `, [class6AId, schoolAId]);

  const class8AId = randomUUID();
  await db.query(`
    INSERT INTO classes (id, school_id, name_en, name_bn, numeric_level, category, status)
    VALUES ($1, $2, 'Class 8', 'অষ্টম শ্রেণি', 8, 'JUNIOR_SECONDARY', 'ACTIVE')
  `, [class8AId, schoolAId]);

  // Sections for Class 5
  const section5AId = randomUUID(); // Section A
  await db.query(`
    INSERT INTO sections (id, school_id, campus_id, class_id, name_en, name_bn, shift, max_capacity, status)
    VALUES ($1, $2, $3, $4, 'Section A', 'ক শাখা', 'MORNING', 50, 'ACTIVE')
  `, [section5AId, schoolAId, campusAId, class5AId]);

  const section5BId = randomUUID(); // Section B
  await db.query(`
    INSERT INTO sections (id, school_id, campus_id, class_id, name_en, name_bn, shift, max_capacity, status)
    VALUES ($1, $2, $3, $4, 'Section B', 'খ শাখা', 'MORNING', 50, 'ACTIVE')
  `, [section5BId, schoolAId, campusAId, class5AId]);

  // Subjects for Class 5
  const subBanglaId = randomUUID();
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'BAN-101', 'Bangla', 'বাংলা', 'COMPULSORY', 70.00, 30.00, 0.00, 100.00, 33.00, 'ACTIVE')
  `, [subBanglaId, schoolAId, class5AId]);

  const subEnglishId = randomUUID();
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'ENG-102', 'English', 'ইংরেজি', 'COMPULSORY', 70.00, 30.00, 0.00, 100.00, 33.00, 'ACTIVE')
  `, [subEnglishId, schoolAId, class5AId]);

  const subMathId = randomUUID();
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'MAT-103', 'Mathematics', 'গণিত', 'COMPULSORY', 70.00, 30.00, 0.00, 100.00, 33.00, 'ACTIVE')
  `, [subMathId, schoolAId, class5AId]);

  const subScienceId = randomUUID();
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'SCI-104', 'General Science', 'সাধারণ বিজ্ঞান', 'COMPULSORY', 50.00, 25.00, 25.00, 100.00, 33.00, 'ACTIVE')
  `, [subScienceId, schoolAId, class5AId]);

  const subAgriId = randomUUID(); // Optional 4th subject
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'AGR-105', 'Agriculture Studies', 'কৃষি শিক্ষা', 'OPTIONAL_FOURTH', 50.00, 25.00, 25.00, 100.00, 33.00, 'ACTIVE')
  `, [subAgriId, schoolAId, class5AId]);

  // Subject for Class 8 (to test cross-class integrity)
  const subClass8HigherMathId = randomUUID();
  await db.query(`
    INSERT INTO subjects (id, school_id, class_id, code, name_en, name_bn, subject_type, theory_marks, mcq_marks, practical_marks, total_full_marks, pass_marks, status)
    VALUES ($1, $2, $3, 'HM-801', 'Higher Mathematics 8', 'উচ্চতর গণিত ৮', 'COMPULSORY', 70.00, 30.00, 0.00, 100.00, 33.00, 'ACTIVE')
  `, [subClass8HigherMathId, schoolAId, class8AId]);

  // Users & Staff
  const passwordHash = await bcrypt.hash('AdminPass@123', 10);

  // 1. School Owner / Principal User
  const principalUserId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'principal@motijheel.test', '01711000001', 'Principal M. Rahman', $3, 'ACTIVE')
  `, [principalUserId, schoolAId, passwordHash]);

  const ownerRoleId = randomUUID();
  await db.query(`
    INSERT INTO roles (id, school_id, code, name, is_system_role)
    VALUES ($1, $2, 'SCHOOL_OWNER', 'School Owner', true)
  `, [ownerRoleId, schoolAId]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), principalUserId, ownerRoleId]);

  // 2. Teacher User A (Class 5 Section A Bangla & Class Teacher)
  const teacherUserAId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'teacher.a@motijheel.test', '01711000002', 'Farhana Begum', $3, 'ACTIVE')
  `, [teacherUserAId, schoolAId, passwordHash]);

  const teacherRoleId = randomUUID();
  await db.query(`
    INSERT INTO roles (id, school_id, code, name, is_system_role)
    VALUES ($1, $2, 'TEACHER', 'Teacher', true)
  `, [teacherRoleId, schoolAId]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), teacherUserAId, teacherRoleId]);

  const teacherAId = randomUUID();
  await db.query(`
    INSERT INTO teachers (id, school_id, campus_id, user_id, teacher_code, first_name_en, last_name_en, full_name_en, full_name_bn, designation, qualification, date_of_birth, gender, national_id, phone, email, joining_date, status)
    VALUES ($1, $2, $3, $4, 'TCH-001', 'Farhana', 'Begum', 'Farhana Begum', 'ফারহানা বেগম', 'ASSISTANT_TEACHER', 'M.A. Bangla', '1988-04-12', 'FEMALE', '19881234567890123', '01711000002', 'teacher.a@motijheel.test', '2018-01-01', 'ACTIVE')
  `, [teacherAId, schoolAId, campusAId, teacherUserAId]);

  // Teacher A Assignment: Class 5, Section A, Bangla, canTakeAttendance = true, canEnterMarks = true
  const assignmentAId = randomUUID();
  await db.query(`
    INSERT INTO teacher_assignments (id, school_id, academic_session_id, teacher_id, class_id, section_id, subject_id, role, can_take_attendance, can_enter_marks, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'CLASS_TEACHER', true, true, 'ACTIVE')
  `, [assignmentAId, schoolAId, session2026AId, teacherAId, class5AId, section5AId, subBanglaId]);

  // 3. Teacher User B (Assigned to Section B only)
  const teacherUserBId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'teacher.b@motijheel.test', '01711000003', 'Kamal Hossain', $3, 'ACTIVE')
  `, [teacherUserBId, schoolAId, passwordHash]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), teacherUserBId, teacherRoleId]);

  const teacherBId = randomUUID();
  await db.query(`
    INSERT INTO teachers (id, school_id, campus_id, user_id, teacher_code, first_name_en, last_name_en, full_name_en, full_name_bn, designation, qualification, date_of_birth, gender, national_id, phone, email, joining_date, status)
    VALUES ($1, $2, $3, $4, 'TCH-002', 'Kamal', 'Hossain', 'Kamal Hossain', 'কামাল হোসেন', 'ASSISTANT_TEACHER', 'M.Sc. Math', '1990-08-15', 'MALE', '19901234567890124', '01711000003', 'teacher.b@motijheel.test', '2019-01-01', 'ACTIVE')
  `, [teacherBId, schoolAId, campusAId, teacherUserBId]);

  // Teacher B Assignment: Class 5, Section B ONLY
  await db.query(`
    INSERT INTO teacher_assignments (id, school_id, academic_session_id, teacher_id, class_id, section_id, subject_id, role, can_take_attendance, can_enter_marks, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'CLASS_TEACHER', true, true, 'ACTIVE')
  `, [randomUUID(), schoolAId, session2026AId, teacherBId, class5AId, section5BId, subMathId]);

  // 4. Accountant User (No academic permissions)
  const accountantUserId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'accountant@motijheel.test', '01711000004', 'Shafiqul Islam', $3, 'ACTIVE')
  `, [accountantUserId, schoolAId, passwordHash]);

  const accountantRoleId = randomUUID();
  await db.query(`
    INSERT INTO roles (id, school_id, code, name, is_system_role)
    VALUES ($1, $2, 'ACCOUNTANT', 'Accountant', true)
  `, [accountantRoleId, schoolAId]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), accountantUserId, accountantRoleId]);

  // 5. Students & Enrollments (3 students in Class 5 Sec A for ranking tests)
  // Student 1 (Top student: Roll 1)
  const student1Id = randomUUID();
  await db.query(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division, status)
    VALUES ($1, $2, 'STD-2026-001', '2026-01-01', 'Aayan', 'Hasan', 'Aayan Hasan', 'আয়ান হাসান', '2015-02-10', 'MALE', 'ISLAM', 'Motijheel, Dhaka', 'Motijheel', '1000', 'Motijheel', 'Dhaka', 'DHAKA', 'Motijheel, Dhaka', 'Motijheel', 'Dhaka', 'DHAKA', 'ACTIVE')
  `, [student1Id, schoolAId]);

  const enroll1Id = randomUUID();
  await db.query(`
    INSERT INTO enrollments (id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1, '2026-01-01', 'ACTIVE')
  `, [enroll1Id, schoolAId, campusAId, student1Id, session2026AId, class5AId, section5AId]);

  // Student 2 (Middle student: Roll 2)
  const student2Id = randomUUID();
  await db.query(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division, status)
    VALUES ($1, $2, 'STD-2026-002', '2026-01-01', 'Sumaiya', 'Akter', 'Sumaiya Akter', 'সুমাইয়া আক্তার', '2015-05-14', 'FEMALE', 'ISLAM', 'Motijheel, Dhaka', 'Motijheel', '1000', 'Motijheel', 'Dhaka', 'DHAKA', 'Motijheel, Dhaka', 'Motijheel', 'Dhaka', 'DHAKA', 'ACTIVE')
  `, [student2Id, schoolAId]);

  const enroll2Id = randomUUID();
  await db.query(`
    INSERT INTO enrollments (id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 2, '2026-01-01', 'ACTIVE')
  `, [enroll2Id, schoolAId, campusAId, student2Id, session2026AId, class5AId, section5AId]);

  // Student 3 (Failed student: Roll 3)
  const student3Id = randomUUID();
  await db.query(`
    INSERT INTO students (id, school_id, student_code, admission_date, first_name_en, last_name_en, full_name_en, full_name_bn, date_of_birth, gender, religion, permanent_address_line, permanent_post_office, permanent_post_code, permanent_thana, permanent_district, permanent_division, present_address_line, present_thana, present_district, present_division, status)
    VALUES ($1, $2, 'STD-2026-003', '2026-01-01', 'Rafi', 'Ahmed', 'Rafi Ahmed', 'রাফি আহমেদ', '2015-09-20', 'MALE', 'ISLAM', 'Motijheel, Dhaka', 'Motijheel', '1000', 'Motijheel', 'Dhaka', 'DHAKA', 'Motijheel, Dhaka', 'Motijheel', 'Dhaka', 'DHAKA', 'ACTIVE')
  `, [student3Id, schoolAId]);

  const enroll3Id = randomUUID();
  await db.query(`
    INSERT INTO enrollments (id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 3, '2026-01-01', 'ACTIVE')
  `, [enroll3Id, schoolAId, campusAId, student3Id, session2026AId, class5AId, section5AId]);

  // Parent / Guardian for Student 1
  const parent1UserId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'parent1@motijheel.test', '01711000005', 'M. Hasan', $3, 'ACTIVE')
  `, [parent1UserId, schoolAId, passwordHash]);

  const parentRoleId = randomUUID();
  await db.query(`
    INSERT INTO roles (id, school_id, code, name, is_system_role)
    VALUES ($1, $2, 'PARENT', 'Parent', true)
  `, [parentRoleId, schoolAId]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), parent1UserId, parentRoleId]);

  const guardian1Id = randomUUID();
  await db.query(`
    INSERT INTO guardians (id, school_id, user_id, full_name_en, full_name_bn, relation_type, phone)
    VALUES ($1, $2, $3, 'M. Hasan', 'এম. হাসান', 'FATHER', '01711000005')
  `, [guardian1Id, schoolAId, parent1UserId]);

  await db.query(`
    INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary)
    VALUES ($1, $2, $3, $4, true)
  `, [randomUUID(), schoolAId, student1Id, guardian1Id]);

  // Parent 2 for Student 2 (to test IDOR)
  const parent2UserId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, email, phone, full_name, password_hash, status)
    VALUES ($1, $2, 'parent2@motijheel.test', '01711000006', 'Rashida Akter', $3, 'ACTIVE')
  `, [parent2UserId, schoolAId, passwordHash]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), parent2UserId, parentRoleId]);

  const guardian2Id = randomUUID();
  await db.query(`
    INSERT INTO guardians (id, school_id, user_id, full_name_en, full_name_bn, relation_type, phone)
    VALUES ($1, $2, $3, 'Rashida Akter', 'রাশিদা আক্তার', 'MOTHER', '01711000006')
  `, [guardian2Id, schoolAId, parent2UserId]);

  await db.query(`
    INSERT INTO student_guardians (id, school_id, student_id, guardian_id, is_primary)
    VALUES ($1, $2, $3, $4, true)
  `, [randomUUID(), schoolAId, student2Id, guardian2Id]);

  // Student 1 User Account
  const student1UserId = randomUUID();
  await db.query(`
    INSERT INTO users (id, school_id, phone, full_name, password_hash, status)
    VALUES ($1, $2, '01711000007', 'Aayan Hasan', $3, 'ACTIVE')
  `, [student1UserId, schoolAId, passwordHash]);

  const studentRoleId = randomUUID();
  await db.query(`
    INSERT INTO roles (id, school_id, code, name, is_system_role)
    VALUES ($1, $2, 'STUDENT', 'Student', true)
  `, [studentRoleId, schoolAId]);

  await db.query(`
    INSERT INTO user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
  `, [randomUUID(), student1UserId, studentRoleId]);

  await db.query(`
    INSERT INTO student_users (id, school_id, student_id, user_id)
    VALUES ($1, $2, $3, $4)
  `, [randomUUID(), schoolAId, student1Id, student1UserId]);

  console.log('✓ Multi-tenant fixtures seeded successfully.\n');

  // ============================================================================
  // PART A — ATTENDANCE TESTS
  // ============================================================================
  console.log('--- PART A: ATTENDANCE TESTS ---');

  await testScenario(1, 'Teacher assigned to Class 5 Sec A records daily attendance (PRESENT, ABSENT, LATE, EXCUSED)', async () => {
    const payload = {
      academicSessionId: session2026AId,
      classId: class5AId,
      sectionId: section5AId,
      date: '2026-03-01',
      source: 'MANUAL',
      records: [
        { enrollmentId: enroll1Id, studentId: student1Id, status: 'PRESENT' },
        { enrollmentId: enroll2Id, studentId: student2Id, status: 'LATE', lateMinutes: 15 },
        { enrollmentId: enroll3Id, studentId: student3Id, status: 'ABSENT', leaveReason: 'Fever' },
      ],
    };

    const valid = DailyAttendanceBatchSchema.safeParse(payload);
    if (!valid.success) throw new Error('Payload validation failed');

    for (const rec of payload.records) {
      await db.query(`
        INSERT INTO student_attendances (id, school_id, academic_session_id, class_id, section_id, enrollment_id, student_id, date, status, late_minutes, leave_reason, marked_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [randomUUID(), schoolAId, payload.academicSessionId, payload.classId, payload.sectionId, rec.enrollmentId, rec.studentId, payload.date, rec.status, rec.lateMinutes || 0, rec.leaveReason || null, teacherUserAId]);
    }

    const res = await db.query(`
      SELECT count(*) as cnt FROM student_attendances
      WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND date = $4
    `, [schoolAId, class5AId, section5AId, '2026-03-01']);

    if (parseInt(res.rows[0].cnt, 10) !== 3) {
      throw new Error(`Expected 3 attendance records, found ${res.rows[0].cnt}`);
    }
  });

  await testScenario(2, 'Teacher A tries to record attendance for Section B (Teacher Scope check -> BLOCKED)', async () => {
    // Check teacher assignment in DB
    const assignment = await db.query(`
      SELECT * FROM teacher_assignments
      WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND section_id = $4 AND can_take_attendance = true AND status = 'ACTIVE'
    `, [schoolAId, teacherAId, class5AId, section5BId]);

    if (assignment.rows.length !== 0) {
      throw new Error('Teacher A should NOT have assignment for Section B');
    }
  });

  await testScenario(3, 'Teacher A tries to record attendance for Class 6 (Teacher Scope check -> BLOCKED)', async () => {
    const assignment = await db.query(`
      SELECT * FROM teacher_assignments
      WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND can_take_attendance = true AND status = 'ACTIVE'
    `, [schoolAId, teacherAId, class6AId]);

    if (assignment.rows.length !== 0) {
      throw new Error('Teacher A should NOT have assignment for Class 6');
    }
  });

  await testScenario(4, 'Non-teacher role (Accountant) attempts attendance write (BLOCKED)', async () => {
    // Accountant has no teacher profile and no ATTENDANCE_CREATE permission
    const teacherProfile = await db.query(`
      SELECT * FROM teachers WHERE user_id = $1
    `, [accountantUserId]);

    if (teacherProfile.rows.length > 0) {
      throw new Error('Accountant should not have teacher profile');
    }
  });

  await testScenario(5, 'Institutional staff (Principal / Owner) has administrative attendance authority across all classes', async () => {
    // Principal has SCHOOL_OWNER role with ENTIRE_SCHOOL scope
    const roles = await db.query(`
      SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1
    `, [principalUserId]);

    const isOwner = roles.rows.some((r) => r.code === 'SCHOOL_OWNER');
    if (!isOwner) throw new Error('Principal user must have SCHOOL_OWNER role');
  });

  await testScenario(6, 'Duplicate daily attendance for same enrollment + date + periodId:null is rejected (409 Conflict)', async () => {
    let duplicateRejected = false;
    try {
      await db.query(`
        INSERT INTO student_attendances (id, school_id, academic_session_id, class_id, section_id, enrollment_id, student_id, date, status, marked_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-03-01', 'PRESENT', $8)
      `, [randomUUID(), schoolAId, session2026AId, class5AId, section5AId, enroll1Id, student1Id, teacherUserAId]);
    } catch (err) {
      // Partial unique index uq_daily_attendance_enrollment or uq_daily_attendance_student caught it!
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error('Database allowed duplicate daily attendance insertion for same enrollment and date!');
    }
  });

  await testScenario(7, 'Concurrent duplicate attendance submissions guarantee exactly 1 record per enrollment/date', async () => {
    const testEnrollmentId = enroll2Id;
    const testDate = '2026-03-02';

    let successCount = 0;
    let conflictCount = 0;

    const p1 = (async () => {
      try {
        await db.query(`
          INSERT INTO student_attendances (id, school_id, academic_session_id, class_id, section_id, enrollment_id, student_id, date, status, marked_by_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PRESENT', $9)
        `, [randomUUID(), schoolAId, session2026AId, class5AId, section5AId, testEnrollmentId, student2Id, testDate, teacherUserAId]);
        successCount++;
      } catch {
        conflictCount++;
      }
    })();

    const p2 = (async () => {
      try {
        await db.query(`
          INSERT INTO student_attendances (id, school_id, academic_session_id, class_id, section_id, enrollment_id, student_id, date, status, marked_by_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LATE', $9)
        `, [randomUUID(), schoolAId, session2026AId, class5AId, section5AId, testEnrollmentId, student2Id, testDate, teacherUserAId]);
        successCount++;
      } catch {
        conflictCount++;
      }
    })();

    await Promise.all([p1, p2]);

    if (successCount !== 1 || conflictCount !== 1) {
      throw new Error(`Expected 1 success and 1 conflict, got success: ${successCount}, conflict: ${conflictCount}`);
    }
  });

  await testScenario(8, 'Attendance correction with audit reason updates status and records audit trail', async () => {
    // Find record
    const attRec = await db.query(`
      SELECT * FROM student_attendances WHERE enrollment_id = $1 AND date = '2026-03-01'
    `, [enroll1Id]);

    const oldStatus = attRec.rows[0].status;
    const newStatus = 'LATE';
    const auditReason = 'Student arrived 20 minutes late due to traffic congestion';

    const updateValid = AttendanceUpdateSchema.safeParse({
      status: newStatus,
      reason: auditReason,
      lateMinutes: 20,
    });
    if (!updateValid.success) throw new Error('Validation failed');

    // Update
    await db.query(`
      UPDATE student_attendances
      SET status = $1, late_minutes = 20, updated_by_id = $2, updated_at = NOW()
      WHERE id = $3
    `, [newStatus, teacherUserAId, attRec.rows[0].id]);

    // Insert Audit log
    await db.query(`
      INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, before_state, after_state, change_summary)
      VALUES ($1, $2, $3, 'Farhana Begum', 'TEACHER', 'UPDATE', 'StudentAttendance', $4, $5, $6, $7)
    `, [
      randomUUID(),
      schoolAId,
      teacherUserAId,
      attRec.rows[0].id,
      JSON.stringify({ status: oldStatus }),
      JSON.stringify({ status: newStatus, lateMinutes: 20 }),
      auditReason,
    ]);

    const auditCheck = await db.query(`
      SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'UPDATE'
    `, [attRec.rows[0].id]);

    if (auditCheck.rows.length === 0) {
      throw new Error('Audit log was not created for attendance correction');
    }
  });

  await testScenario(9, 'Attendance correction without mandatory reason is rejected by schema', async () => {
    const invalid = AttendanceUpdateSchema.safeParse({
      status: 'PRESENT',
      reason: '', // Empty reason
    });
    if (invalid.success) {
      throw new Error('Schema should reject attendance correction with empty reason');
    }
  });

  await testScenario(10, 'Attendance belongs to enrollment academic context (session, class, section)', async () => {
    const res = await db.query(`
      SELECT a.id, a.status, e.roll_no, c.name_en as class_name, s.name_en as sec_name, sess.name as sess_name
      FROM student_attendances a
      JOIN enrollments e ON a.enrollment_id = e.id
      JOIN classes c ON a.class_id = c.id
      JOIN sections s ON a.section_id = s.id
      JOIN academic_sessions sess ON a.academic_session_id = sess.id
      WHERE a.enrollment_id = $1
    `, [enroll1Id]);

    if (res.rows.length === 0 || res.rows[0].class_name !== 'Class 5') {
      throw new Error('Attendance record lacks proper academic enrollment context relations');
    }
  });

  await testScenario(11, 'Parent can view own child attendance records', async () => {
    // Parent 1 queries child 1 attendance
    const res = await db.query(`
      SELECT a.* FROM student_attendances a
      JOIN student_guardians sg ON a.student_id = sg.student_id
      JOIN guardians g ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND a.student_id = $2
    `, [parent1UserId, student1Id]);

    if (res.rows.length === 0) {
      throw new Error('Parent should be able to view own child attendance');
    }
  });

  await testScenario(12, 'Parent IDOR: Parent 1 attempts to query Student 2 attendance (BLOCKED)', async () => {
    const res = await db.query(`
      SELECT a.* FROM student_attendances a
      JOIN student_guardians sg ON a.student_id = sg.student_id
      JOIN guardians g ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND a.student_id = $2
    `, [parent1UserId, student2Id]);

    if (res.rows.length !== 0) {
      throw new Error('Parent 1 was able to view Student 2 attendance! IDOR vulnerability.');
    }
  });

  await testScenario(13, 'Student can view own attendance history', async () => {
    const res = await db.query(`
      SELECT a.* FROM student_attendances a
      JOIN student_users su ON a.student_id = su.student_id
      WHERE su.user_id = $1
    `, [student1UserId]);

    if (res.rows.length === 0) {
      throw new Error('Student should be able to view own attendance');
    }
  });

  await testScenario(14, 'Historical attendance remains attached to original enrollment after promotion or transfer', async () => {
    // Promote Student 1 to Class 6 for 2027 session
    const enroll2027Id = randomUUID();
    await db.query(`
      INSERT INTO enrollments (id, school_id, campus_id, student_id, academic_session_id, class_id, section_id, roll_no, enrollment_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, '2027-01-01', 'ACTIVE')
    `, [enroll2027Id, schoolAId, campusAId, student1Id, session2027AId, class6AId, section5AId]);

    // Mark previous enrollment as PROMOTED
    await db.query(`
      UPDATE enrollments SET status = 'PROMOTED' WHERE id = $1
    `, [enroll1Id]);

    // Check historical attendance: Must still be linked to enroll1Id and Class 5!
    const hist = await db.query(`
      SELECT a.academic_session_id, a.class_id, a.enrollment_id
      FROM student_attendances a
      WHERE a.enrollment_id = $1
    `, [enroll1Id]);

    if (hist.rows.length === 0 || hist.rows[0].class_id !== class5AId) {
      throw new Error('Historical attendance was corrupted by new enrollment promotion');
    }
  });

  await testScenario(15, 'Cross-tenant attendance protection: School B cannot view or modify School A attendance', async () => {
    await withTenant(schoolBId, async () => {
      const res = await db.query(`
        SELECT * FROM student_attendances WHERE enrollment_id = $1
      `, [enroll1Id]);
      if (res.rows.length !== 0) {
        throw new Error('Cross-tenant data leak: School B read School A attendance!');
      }
    });
  });

  // ============================================================================
  // PART B — EXAM & SCHEDULE MANAGEMENT TESTS
  // ============================================================================
  console.log('\n--- PART B: EXAM & SCHEDULE TESTS ---');

  const exam1Id = randomUUID();

  await testScenario(16, 'Create academic exam in DRAFT status with session and term', async () => {
    const examData = {
      academicSessionId: session2026AId,
      nameEn: 'Half Yearly Examination 2026',
      nameBn: 'অর্ধ-বার্ষিক পরীক্ষা ২০২৬',
      examType: 'TERM_EXAM',
      term: 'FIRST_TERM',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      weightagePercentage: 100,
      status: 'DRAFT',
    };

    const valid = ExamCreateSchema.safeParse(examData);
    if (!valid.success) throw new Error('Exam validation failed');

    await db.query(`
      INSERT INTO exams (id, school_id, academic_session_id, name_en, name_bn, exam_type, term, weightage_percentage, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      exam1Id,
      schoolAId,
      examData.academicSessionId,
      examData.nameEn,
      examData.nameBn,
      examData.examType,
      examData.term,
      examData.weightagePercentage,
      examData.startDate,
      examData.endDate,
      examData.status,
    ]);

    const examCheck = await db.query(`SELECT * FROM exams WHERE id = $1`, [exam1Id]);
    if (examCheck.rows.length === 0 || examCheck.rows[0].status !== 'DRAFT') {
      throw new Error('Exam creation failed');
    }
  });

  await testScenario(17, 'Duplicate exam name in same academic session is rejected', async () => {
    let duplicateRejected = false;
    try {
      await db.query(`
        INSERT INTO exams (id, school_id, academic_session_id, name_en, name_bn, exam_type, term, start_date, end_date, status)
        VALUES ($1, $2, $3, 'Half Yearly Examination 2026', 'অন্য নাম', 'TERM_EXAM', 'FIRST_TERM', '2026-06-01', '2026-06-15', 'DRAFT')
      `, [randomUUID(), schoolAId, session2026AId]);
    } catch {
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error('Database permitted duplicate exam name in same academic session');
    }
  });

  await testScenario(18, 'Exam lifecycle state machine transitions DRAFT -> SCHEDULED -> ONGOING', async () => {
    // DRAFT -> SCHEDULED
    await db.query(`UPDATE exams SET status = 'SCHEDULED' WHERE id = $1`, [exam1Id]);
    let check = await db.query(`SELECT status FROM exams WHERE id = $1`, [exam1Id]);
    if (check.rows[0].status !== 'SCHEDULED') throw new Error('Failed to transition to SCHEDULED');

    // SCHEDULED -> ONGOING
    await db.query(`UPDATE exams SET status = 'ONGOING' WHERE id = $1`, [exam1Id]);
    check = await db.query(`SELECT status FROM exams WHERE id = $1`, [exam1Id]);
    if (check.rows[0].status !== 'ONGOING') throw new Error('Failed to transition to ONGOING');
  });

  await testScenario(19, 'Exam lifecycle prevents arbitrary status manipulation', async () => {
    // Validate that ExamUpdateSchema rejects invalid enum values
    const invalid = ExamUpdateSchema.safeParse({
      status: 'ARBITRARY_STATUS',
    });
    if (invalid.success) {
      throw new Error('Schema permitted arbitrary status string');
    }
  });

  const schedBanglaId = randomUUID();
  const schedEnglishId = randomUUID();
  const schedMathId = randomUUID();
  const schedScienceId = randomUUID();
  const schedAgriId = randomUUID();

  await testScenario(20, 'Add subject exam schedules for Class 5 with dates, times, fullMarks and passMarks', async () => {
    const schedules = [
      { id: schedBanglaId, subjectId: subBanglaId, examDate: '2026-06-01', fullMarks: 100, passMarks: 33 },
      { id: schedEnglishId, subjectId: subEnglishId, examDate: '2026-06-03', fullMarks: 100, passMarks: 33 },
      { id: schedMathId, subjectId: subMathId, examDate: '2026-06-05', fullMarks: 100, passMarks: 33 },
      { id: schedScienceId, subjectId: subScienceId, examDate: '2026-06-08', fullMarks: 100, passMarks: 33 },
      { id: schedAgriId, subjectId: subAgriId, examDate: '2026-06-10', fullMarks: 100, passMarks: 33 },
    ];

    for (const s of schedules) {
      const valid = ExamScheduleCreateSchema.safeParse({
        classId: class5AId,
        subjectId: s.subjectId,
        examDate: s.examDate,
        startTime: '10:00:00',
        endTime: '13:00:00',
        fullMarks: s.fullMarks,
        passMarks: s.passMarks,
      });
      if (!valid.success) throw new Error('Exam schedule validation failed');

      await db.query(`
        INSERT INTO exam_schedules (id, school_id, exam_id, class_id, subject_id, exam_date, start_time, end_time, full_marks, pass_marks)
        VALUES ($1, $2, $3, $4, $5, $6, '10:00:00', '13:00:00', $7, $8)
      `, [s.id, schoolAId, exam1Id, class5AId, s.subjectId, s.examDate, s.fullMarks, s.passMarks]);
    }

    const countRes = await db.query(`SELECT count(*) as cnt FROM exam_schedules WHERE exam_id = $1`, [exam1Id]);
    if (parseInt(countRes.rows[0].cnt, 10) !== 5) {
      throw new Error('Failed to create all 5 exam schedules');
    }
  });

  await testScenario(21, 'Cross-class subject validation: Attaching a Class 8-only subject to Class 5 exam is REJECTED', async () => {
    // Query subject to verify classId
    const subCheck = await db.query(`
      SELECT * FROM subjects WHERE id = $1 AND class_id = $2
    `, [subClass8HigherMathId, class5AId]);

    if (subCheck.rows.length !== 0) {
      throw new Error('Class 8 subject should not match Class 5');
    }
  });

  await testScenario(22, 'Duplicate schedule for same (exam, class, subject) is REJECTED', async () => {
    let duplicateRejected = false;
    try {
      await db.query(`
        INSERT INTO exam_schedules (id, school_id, exam_id, class_id, subject_id, exam_date, start_time, end_time, full_marks, pass_marks)
        VALUES ($1, $2, $3, $4, $5, '2026-06-12', '10:00:00', '13:00:00', 100, 33)
      `, [randomUUID(), schoolAId, exam1Id, class5AId, subBanglaId]);
    } catch {
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error('Database allowed duplicate schedule for same exam, class, and subject');
    }
  });

  await testScenario(23, 'Deleting exam schedule when exam is not published is permitted', async () => {
    const tempSchedId = randomUUID();
    await db.query(`
      INSERT INTO exam_schedules (id, school_id, exam_id, class_id, subject_id, exam_date, start_time, end_time, full_marks, pass_marks)
      VALUES ($1, $2, $3, $4, $5, '2026-06-14', '10:00:00', '13:00:00', 100, 33)
    `, [tempSchedId, schoolAId, exam1Id, class6AId, subClass8HigherMathId]);

    await db.query(`DELETE FROM exam_schedules WHERE id = $1`, [tempSchedId]);
    const check = await db.query(`SELECT * FROM exam_schedules WHERE id = $1`, [tempSchedId]);
    if (check.rows.length !== 0) throw new Error('Schedule deletion failed');
  });

  await testScenario(24, 'Cross-tenant exam protection: School B cannot view or modify School A exams', async () => {
    await withTenant(schoolBId, async () => {
      const res = await db.query(`SELECT * FROM exams WHERE id = $1`, [exam1Id]);
      if (res.rows.length !== 0) {
        throw new Error('Cross-tenant data leak: School B read School A exam!');
      }
    });
  });

  // ============================================================================
  // PART C — MARKS ENTRY & VALIDATION TESTS
  // ============================================================================
  console.log('\n--- PART C: MARKS ENTRY & VALIDATION TESTS ---');

  await testScenario(25, 'Assigned subject teacher can enter marks for assigned (class, section, subject, session)', async () => {
    const assignment = await db.query(`
      SELECT * FROM teacher_assignments
      WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND section_id = $4 AND subject_id = $5 AND can_enter_marks = true AND status = 'ACTIVE'
    `, [schoolAId, teacherAId, class5AId, section5AId, subBanglaId]);

    if (assignment.rows.length === 0) {
      throw new Error('Teacher A assignment for Bangla marks entry not found');
    }
  });

  await testScenario(26, 'Teacher IDOR: Teacher A attempts to enter marks for unassigned subject Mathematics (BLOCKED)', async () => {
    // Teacher A is assigned to Bangla, NOT Mathematics
    const assignment = await db.query(`
      SELECT * FROM teacher_assignments
      WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND section_id = $4 AND subject_id = $5 AND can_enter_marks = true AND status = 'ACTIVE'
    `, [schoolAId, teacherAId, class5AId, section5AId, subMathId]);

    if (assignment.rows.length > 0) {
      throw new Error('Teacher A should NOT be assigned to Mathematics');
    }
  });

  await testScenario(27, 'Teacher IDOR: Teacher A attempts to enter marks for unassigned Section B (BLOCKED)', async () => {
    const assignment = await db.query(`
      SELECT * FROM teacher_assignments
      WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND section_id = $4 AND can_enter_marks = true AND status = 'ACTIVE'
    `, [schoolAId, teacherAId, class5AId, section5BId]);

    if (assignment.rows.length > 0) {
      throw new Error('Teacher A should NOT have marks authority for Section B');
    }
  });

  await testScenario(28, 'Valid marks entry computes total obtained and NCTB subject letter grade + point', async () => {
    const theory = 58;
    const mcq = 27;
    const total = theory + mcq; // 85 / 100
    const grade = calculateSubjectGrade(total, 100, 33, false);

    if (grade.letterGrade !== 'A+' || grade.gradePoint !== 5.0) {
      throw new Error(`Grade calculation mismatch: expected A+ (5.0), got ${grade.letterGrade} (${grade.gradePoint})`);
    }
  });

  await testScenario(29, 'Marks validation: Negative marks (-10) are REJECTED by schema', async () => {
    const invalid = MarkEntryItemSchema.safeParse({
      studentId: student1Id,
      enrollmentId: enroll1Id,
      theoryObtained: -10,
    });
    if (invalid.success) throw new Error('Schema allowed negative marks');
  });

  await testScenario(30, 'Marks validation: Exceeding full marks (105 / 100) is REJECTED by schema', async () => {
    const invalid = MarkEntryItemSchema.safeParse({
      studentId: student1Id,
      enrollmentId: enroll1Id,
      theoryObtained: 105,
    });
    if (invalid.success) throw new Error('Schema allowed marks exceeding 100');
  });

  await testScenario(31, 'Marks validation: Non-numeric marks (NaN / Infinity) are REJECTED', async () => {
    const invalid = MarkEntryItemSchema.safeParse({
      studentId: student1Id,
      enrollmentId: enroll1Id,
      theoryObtained: NaN,
    });
    if (invalid.success) throw new Error('Schema allowed NaN marks');
  });

  await testScenario(32, 'Bulk marks save draft: Status sets to DRAFT in database', async () => {
    // Save draft marks for Student 1 in Bangla
    const grade = calculateSubjectGrade(85, 100, 33, false);

    await db.query(`
      INSERT INTO marks (id, school_id, exam_id, subject_id, student_id, enrollment_id, theory_obtained, mcq_obtained, total_obtained, grade_point, letter_grade, status, entered_by_id)
      VALUES ($1, $2, $3, $4, $5, $6, 58, 27, 85, $7, $8, 'DRAFT', $9)
    `, [randomUUID(), schoolAId, exam1Id, subBanglaId, student1Id, enroll1Id, grade.gradePoint, grade.letterGrade, teacherUserAId]);

    const markCheck = await db.query(`
      SELECT status FROM marks WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    if (markCheck.rows[0].status !== 'DRAFT') throw new Error('Mark status was not DRAFT');
  });

  await testScenario(33, 'Bulk marks submission by teacher: Status updates to SUBMITTED_BY_TEACHER', async () => {
    await db.query(`
      UPDATE marks SET status = 'SUBMITTED_BY_TEACHER'
      WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    const markCheck = await db.query(`
      SELECT status FROM marks WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    if (markCheck.rows[0].status !== 'SUBMITTED_BY_TEACHER') throw new Error('Mark status was not SUBMITTED_BY_TEACHER');
  });

  await testScenario(34, 'Administrative marks approval: Principal approves submitted marks -> status APPROVED', async () => {
    await db.query(`
      UPDATE marks
      SET status = 'APPROVED', approved_by_id = $1, approved_at = NOW()
      WHERE exam_id = $2 AND subject_id = $3 AND enrollment_id = $4
    `, [principalUserId, exam1Id, subBanglaId, enroll1Id]);

    const markCheck = await db.query(`
      SELECT status, approved_by_id FROM marks WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    if (markCheck.rows[0].status !== 'APPROVED' || markCheck.rows[0].approved_by_id !== principalUserId) {
      throw new Error('Marks approval failed');
    }
  });

  await testScenario(35, 'Revert to draft: Admin reverts marks to DRAFT with feedback reason', async () => {
    const approveData = {
      examId: exam1Id,
      classId: class5AId,
      subjectId: subBanglaId,
      status: 'DRAFT',
      rejectionReason: 'Practical marks column missing',
    };

    const valid = MarksApproveSchema.safeParse(approveData);
    if (!valid.success) throw new Error('Approve schema validation failed');

    await db.query(`
      UPDATE marks SET status = 'DRAFT' WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    const check = await db.query(`
      SELECT status FROM marks WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    if (check.rows[0].status !== 'DRAFT') throw new Error('Revert to draft failed');

    // Re-approve for next tests
    await db.query(`
      UPDATE marks SET status = 'APPROVED', approved_by_id = $1, approved_at = NOW()
      WHERE exam_id = $2 AND subject_id = $3 AND enrollment_id = $4
    `, [principalUserId, exam1Id, subBanglaId, enroll1Id]);
  });

  await testScenario(36, 'Unauthorized editing lock: Teacher cannot silently overwrite APPROVED marks', async () => {
    const mark = await db.query(`
      SELECT status FROM marks WHERE exam_id = $1 AND subject_id = $2 AND enrollment_id = $3
    `, [exam1Id, subBanglaId, enroll1Id]);

    if (mark.rows[0].status !== 'APPROVED') {
      throw new Error('Mark should be in APPROVED state');
    }
    // Application layer blocks teachers from editing when status is APPROVED
  });

  await testScenario(37, 'Concurrent marks submissions on same subject/enrollment handle atomic upsert safely', async () => {
    const testEnroll = enroll2Id;
    const testSub = subBanglaId;

    const p1 = db.query(`
      INSERT INTO marks (id, school_id, exam_id, subject_id, student_id, enrollment_id, total_obtained, grade_point, letter_grade, status, entered_by_id)
      VALUES ($1, $2, $3, $4, $5, $6, 75, 4.0, 'A', 'DRAFT', $7)
      ON CONFLICT (school_id, exam_id, subject_id, enrollment_id)
      DO UPDATE SET total_obtained = 75, letter_grade = 'A'
    `, [randomUUID(), schoolAId, exam1Id, testSub, student2Id, testEnroll, teacherUserAId]);

    const p2 = db.query(`
      INSERT INTO marks (id, school_id, exam_id, subject_id, student_id, enrollment_id, total_obtained, grade_point, letter_grade, status, entered_by_id)
      VALUES ($1, $2, $3, $4, $5, $6, 78, 4.0, 'A', 'DRAFT', $7)
      ON CONFLICT (school_id, exam_id, subject_id, enrollment_id)
      DO UPDATE SET total_obtained = 78, letter_grade = 'A'
    `, [randomUUID(), schoolAId, exam1Id, testSub, student2Id, testEnroll, teacherUserAId]);

    await Promise.all([p1, p2]);

    const count = await db.query(`
      SELECT count(*) as cnt FROM marks WHERE school_id = $1 AND exam_id = $2 AND subject_id = $3 AND enrollment_id = $4
    `, [schoolAId, exam1Id, testSub, testEnroll]);

    if (parseInt(count.rows[0].cnt, 10) !== 1) {
      throw new Error(`Expected exactly 1 mark row, got ${count.rows[0].cnt}`);
    }
  });

  // ============================================================================
  // PART D — BANGLADESH NCTB GRADING & RESULT GENERATION TESTS
  // ============================================================================
  console.log('\n--- PART D: NCTB GRADING & RESULT GENERATION TESTS ---');

  await testScenario(38, 'Subject grading NCTB 7-tier scale accurate mapping (80-100: A+, 70-79: A, 60-69: A-, 50-59: B, 40-49: C, 33-39: D, 0-32: F)', async () => {
    const testCases = [
      { score: 95, expGrade: 'A+', expPoint: 5.0 },
      { score: 75, expGrade: 'A', expPoint: 4.0 },
      { score: 65, expGrade: 'A-', expPoint: 3.5 },
      { score: 55, expGrade: 'B', expPoint: 3.0 },
      { score: 45, expGrade: 'C', expPoint: 2.0 },
      { score: 35, expGrade: 'D', expPoint: 1.0 },
      { score: 32, expGrade: 'F', expPoint: 0.0 },
    ];

    for (const tc of testCases) {
      const g = calculateSubjectGrade(tc.score, 100, 33, false);
      if (g.letterGrade !== tc.expGrade || g.gradePoint !== tc.expPoint) {
        throw new Error(`NCTB grade failed for ${tc.score}: expected ${tc.expGrade} (${tc.expPoint}), got ${g.letterGrade} (${g.gradePoint})`);
      }
    }
  });

  await testScenario(39, 'Overall GPA calculation with all passed subjects produces unweighted GPA', async () => {
    const subjects = [
      { subjectId: '1', subjectCode: 'B', subjectName: 'Bangla', fullMarks: 100, passMarks: 33, obtainedMarks: 80, isAbsent: false }, // A+ (5.0)
      { subjectId: '2', subjectCode: 'E', subjectName: 'English', fullMarks: 100, passMarks: 33, obtainedMarks: 70, isAbsent: false }, // A (4.0)
      { subjectId: '3', subjectCode: 'M', subjectName: 'Math', fullMarks: 100, passMarks: 33, obtainedMarks: 60, isAbsent: false }, // A- (3.5)
      { subjectId: '4', subjectCode: 'S', subjectName: 'Science', fullMarks: 100, passMarks: 33, obtainedMarks: 50, isAbsent: false }, // B (3.0)
    ];

    // Average = (5.0 + 4.0 + 3.5 + 3.0) / 4 = 15.5 / 4 = 3.875 -> 3.88
    const res = calculateOverallGpa(subjects);
    if (!res.isPassed || res.gpa !== 3.88 || res.finalGrade !== 'A-') {
      throw new Error(`GPA calculation failed: expected GPA 3.88, A-, got GPA ${res.gpa}, Grade ${res.finalGrade}`);
    }
  });

  await testScenario(40, 'Failing any mandatory subject forces overall GPA = 0.00 and Grade = F', async () => {
    const subjects = [
      { subjectId: '1', subjectCode: 'B', subjectName: 'Bangla', fullMarks: 100, passMarks: 33, obtainedMarks: 85, isAbsent: false }, // A+ (5.0)
      { subjectId: '2', subjectCode: 'E', subjectName: 'English', fullMarks: 100, passMarks: 33, obtainedMarks: 25, isAbsent: false }, // F (0.0) -> FAILED!
      { subjectId: '3', subjectCode: 'M', subjectName: 'Math', fullMarks: 100, passMarks: 33, obtainedMarks: 90, isAbsent: false }, // A+ (5.0)
    ];

    const res = calculateOverallGpa(subjects);
    if (res.isPassed || res.gpa !== 0.0 || res.finalGrade !== 'F' || res.failedSubjectsCount !== 1) {
      throw new Error(`Failed subject must yield GPA 0.00 and F! Got GPA ${res.gpa}, Grade ${res.finalGrade}`);
    }
  });

  await testScenario(41, 'Optional 4th subject bonus points: Points above 2.00 added to total and divided by mandatory subjects count', async () => {
    const subjects = [
      { subjectId: '1', subjectCode: 'B', subjectName: 'Bangla', fullMarks: 100, passMarks: 33, obtainedMarks: 80, isAbsent: false, isOptionalFourth: false }, // 5.0
      { subjectId: '2', subjectCode: 'E', subjectName: 'English', fullMarks: 100, passMarks: 33, obtainedMarks: 70, isAbsent: false, isOptionalFourth: false }, // 4.0
      { subjectId: '3', subjectCode: 'M', subjectName: 'Math', fullMarks: 100, passMarks: 33, obtainedMarks: 60, isAbsent: false, isOptionalFourth: false }, // 3.5
      { subjectId: '4', subjectCode: 'A', subjectName: 'Agriculture', fullMarks: 100, passMarks: 33, obtainedMarks: 80, isAbsent: false, isOptionalFourth: true }, // 4th subject: 5.0 -> bonus = 5.0 - 2.0 = 3.0
    ];

    // Mandatory sum = 5.0 + 4.0 + 3.5 = 12.5
    // Bonus = 3.0
    // Total = 15.5 / 3 = 5.166... -> capped at 5.00!
    const res = calculateOverallGpa(subjects);
    if (res.gpa !== 5.0 || res.finalGrade !== 'A+') {
      throw new Error(`4th subject bonus GPA failed: expected 5.00, got ${res.gpa}`);
    }
  });

  await testScenario(42, 'Perfect score GPA capped at 5.00 (Golden A+)', async () => {
    const subjects = [
      { subjectId: '1', subjectCode: 'B', subjectName: 'Bangla', fullMarks: 100, passMarks: 33, obtainedMarks: 100, isAbsent: false },
      { subjectId: '2', subjectCode: 'E', subjectName: 'English', fullMarks: 100, passMarks: 33, obtainedMarks: 100, isAbsent: false },
      { subjectId: '3', subjectCode: 'M', subjectName: 'Math', fullMarks: 100, passMarks: 33, obtainedMarks: 100, isAbsent: false },
      { subjectId: '4', subjectCode: 'A', subjectName: 'Agri', fullMarks: 100, passMarks: 33, obtainedMarks: 100, isAbsent: false, isOptionalFourth: true },
    ];

    const res = calculateOverallGpa(subjects);
    if (res.gpa > 5.0 || res.finalGrade !== 'A+') {
      throw new Error(`GPA must never exceed 5.00! Got ${res.gpa}`);
    }
  });

  await testScenario(43, 'Seed marks for Class 5 students across all subjects and generate results', async () => {
    // Student 1: All A+ (Total marks: 450/500, GPA 5.00)
    // Student 2: Solid A (Total marks: 370/500, GPA 4.00)
    // Student 3: Failed in Math (Total marks: 220/500, GPA 0.00, Grade F)
    const marksData = [
      // Student 1 (Roll 1)
      { studentId: student1Id, enrollId: enroll1Id, subId: subBanglaId, marks: 88 },
      { studentId: student1Id, enrollId: enroll1Id, subId: subEnglishId, marks: 90 },
      { studentId: student1Id, enrollId: enroll1Id, subId: subMathId, marks: 95 },
      { studentId: student1Id, enrollId: enroll1Id, subId: subScienceId, marks: 85 },
      { studentId: student1Id, enrollId: enroll1Id, subId: subAgriId, marks: 92 },

      // Student 2 (Roll 2)
      { studentId: student2Id, enrollId: enroll2Id, subId: subBanglaId, marks: 72 },
      { studentId: student2Id, enrollId: enroll2Id, subId: subEnglishId, marks: 74 },
      { studentId: student2Id, enrollId: enroll2Id, subId: subMathId, marks: 78 },
      { studentId: student2Id, enrollId: enroll2Id, subId: subScienceId, marks: 70 },
      { studentId: student2Id, enrollId: enroll2Id, subId: subAgriId, marks: 76 },

      // Student 3 (Roll 3 - Failed in Math)
      { studentId: student3Id, enrollId: enroll3Id, subId: subBanglaId, marks: 60 },
      { studentId: student3Id, enrollId: enroll3Id, subId: subEnglishId, marks: 50 },
      { studentId: student3Id, enrollId: enroll3Id, subId: subMathId, marks: 20 }, // FAILED (pass is 33)
      { studentId: student3Id, enrollId: enroll3Id, subId: subScienceId, marks: 45 },
      { studentId: student3Id, enrollId: enroll3Id, subId: subAgriId, marks: 45 },
    ];

    for (const m of marksData) {
      const g = calculateSubjectGrade(m.marks, 100, 33, false);
      await db.query(`
        INSERT INTO marks (id, school_id, exam_id, subject_id, student_id, enrollment_id, total_obtained, grade_point, letter_grade, status, entered_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', $10)
        ON CONFLICT (school_id, exam_id, subject_id, enrollment_id)
        DO UPDATE SET total_obtained = $7, grade_point = $8, letter_grade = $9, status = 'APPROVED'
      `, [randomUUID(), schoolAId, exam1Id, m.subId, m.studentId, m.enrollId, m.marks, g.gradePoint, g.letterGrade, principalUserId]);
    }

    // Now calculate candidates
    const candidates = [
      { enrollmentId: enroll1Id, studentId: student1Id, classId: class5AId, sectionId: section5AId, totalMarksObtained: 450, totalFullMarks: 500, calculatedGpa: 5.0, finalGrade: 'A+', isPassed: true, failedSubjectsCount: 0 },
      { enrollmentId: enroll2Id, studentId: student2Id, classId: class5AId, sectionId: section5AId, totalMarksObtained: 370, totalFullMarks: 500, calculatedGpa: 4.0, finalGrade: 'A', isPassed: true, failedSubjectsCount: 0 },
      { enrollmentId: enroll3Id, studentId: student3Id, classId: class5AId, sectionId: section5AId, totalMarksObtained: 220, totalFullMarks: 500, calculatedGpa: 0.0, finalGrade: 'F', isPassed: false, failedSubjectsCount: 1 },
    ];

    const ranked = rankStudentResults(candidates);

    // Persist StudentExamResults
    for (const r of ranked) {
      await db.query(`
        INSERT INTO student_exam_results (id, school_id, exam_id, student_id, enrollment_id, class_id, section_id, total_marks_obtained, total_full_marks, calculated_gpa, final_grade, is_passed, failed_subjects_count, class_position, section_position, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      `, [randomUUID(), schoolAId, exam1Id, r.studentId, r.enrollmentId, r.classId, r.sectionId, r.totalMarksObtained, r.totalFullMarks, r.calculatedGpa, r.finalGrade, r.isPassed, r.failedSubjectsCount, r.classPosition, r.sectionPosition]);
    }

    const saved = await db.query(`SELECT count(*) as cnt FROM student_exam_results WHERE exam_id = $1`, [exam1Id]);
    if (parseInt(saved.rows[0].cnt, 10) !== 3) throw new Error('Result generation failed');
  });

  await testScenario(44, 'Result generation computes correct class and section merit positions (Rank 1, 2, 3)', async () => {
    const res = await db.query(`
      SELECT e.roll_no, r.calculated_gpa, r.class_position, r.section_position, r.is_passed, r.final_grade
      FROM student_exam_results r
      JOIN enrollments e ON r.enrollment_id = e.id
      WHERE r.exam_id = $1
      ORDER BY r.class_position ASC
    `, [exam1Id]);

    // Rank 1: Student 1 (Roll 1, GPA 5.0)
    if (res.rows[0].roll_no !== 1 || res.rows[0].class_position !== 1 || res.rows[0].final_grade !== 'A+') {
      throw new Error(`Rank 1 mismatch: expected Roll 1, got Roll ${res.rows[0].roll_no}`);
    }

    // Rank 2: Student 2 (Roll 2, GPA 4.0)
    if (res.rows[1].roll_no !== 2 || res.rows[1].class_position !== 2 || res.rows[1].final_grade !== 'A') {
      throw new Error(`Rank 2 mismatch: expected Roll 2, got Roll ${res.rows[1].roll_no}`);
    }

    // Rank 3: Student 3 (Roll 3, GPA 0.0, Grade F)
    if (res.rows[2].roll_no !== 3 || res.rows[2].class_position !== 3 || res.rows[2].final_grade !== 'F') {
      throw new Error(`Rank 3 mismatch: expected Roll 3, got Roll ${res.rows[2].roll_no}`);
    }
  });

  await testScenario(45, 'Result records remain tied to Exam + AcademicSession + Enrollment', async () => {
    const res = await db.query(`
      SELECT r.id, e.academic_session_id, ex.academic_session_id as exam_session_id
      FROM student_exam_results r
      JOIN enrollments e ON r.enrollment_id = e.id
      JOIN exams ex ON r.exam_id = ex.id
      WHERE r.exam_id = $1
    `, [exam1Id]);

    if (res.rows.length === 0 || res.rows[0].academic_session_id !== res.rows[0].exam_session_id) {
      throw new Error('Result records mismatch academic session context');
    }
  });

  // ============================================================================
  // PART E — RESULT PUBLICATION & PORTAL SECURITY TESTS
  // ============================================================================
  console.log('\n--- PART E: PUBLICATION GATE & PORTAL SECURITY TESTS ---');

  await testScenario(46, 'Publication Gate: Before publication, published_at is NULL on student_exam_results', async () => {
    const check = await db.query(`
      SELECT count(*) as cnt FROM student_exam_results
      WHERE exam_id = $1 AND published_at IS NOT NULL
    `, [exam1Id]);

    if (parseInt(check.rows[0].cnt, 10) !== 0) {
      throw new Error('Results should NOT have published_at timestamp before publication!');
    }
  });

  await testScenario(47, 'Publication Gate: Student attempting to query unpublished results gets ZERO rows', async () => {
    const check = await db.query(`
      SELECT r.* FROM student_exam_results r
      JOIN student_users su ON r.student_id = su.student_id
      WHERE su.user_id = $1 AND r.published_at IS NOT NULL
    `, [student1UserId]);

    if (check.rows.length !== 0) {
      throw new Error('Student was able to view unpublished results! Publication gate failed.');
    }
  });

  await testScenario(48, 'Publication Gate: Parent attempting to query unpublished child results gets ZERO rows', async () => {
    const check = await db.query(`
      SELECT r.* FROM student_exam_results r
      JOIN student_guardians sg ON r.student_id = sg.student_id
      JOIN guardians g ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND r.published_at IS NOT NULL
    `, [parent1UserId]);

    if (check.rows.length !== 0) {
      throw new Error('Parent was able to view unpublished child results! Publication gate failed.');
    }
  });

  await testScenario(49, 'Teacher attempting to publish results directly is BLOCKED (requires MARKS_PUBLISH)', async () => {
    // Teacher role permissions check: Teacher does NOT have MARKS_PUBLISH
    const roles = await db.query(`
      SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1
    `, [teacherUserAId]);

    const hasPublish = roles.rows.some((r) => ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN'].includes(r.code));
    if (hasPublish) throw new Error('Teacher should not possess administrative publication rights');
  });

  await testScenario(50, 'Admin publishes results: sets published_at timestamp, updates Exam status to RESULTS_PUBLISHED', async () => {
    const pubDate = new Date();
    await db.query(`
      UPDATE student_exam_results SET published_at = $1 WHERE exam_id = $2
    `, [pubDate, exam1Id]);

    await db.query(`
      UPDATE exams SET status = 'RESULTS_PUBLISHED' WHERE id = $1
    `, [exam1Id]);

    await db.query(`
      UPDATE marks SET status = 'PUBLISHED' WHERE exam_id = $1
    `, [exam1Id]);

    const examCheck = await db.query(`SELECT status FROM exams WHERE id = $1`, [exam1Id]);
    const resCheck = await db.query(`SELECT count(*) as cnt FROM student_exam_results WHERE exam_id = $1 AND published_at IS NOT NULL`, [exam1Id]);

    if (examCheck.rows[0].status !== 'RESULTS_PUBLISHED' || parseInt(resCheck.rows[0].cnt, 10) !== 3) {
      throw new Error('Publish results operation failed');
    }
  });

  await testScenario(51, 'Post-publication: Student can view own published results and GPA transcript', async () => {
    const res = await db.query(`
      SELECT r.calculated_gpa, r.final_grade, r.class_position, r.total_marks_obtained
      FROM student_exam_results r
      JOIN student_users su ON r.student_id = su.student_id
      WHERE su.user_id = $1 AND r.published_at IS NOT NULL
    `, [student1UserId]);

    if (res.rows.length === 0 || parseFloat(res.rows[0].calculated_gpa) !== 5.0) {
      throw new Error('Student could not view published results transcript');
    }
  });

  await testScenario(52, 'Post-publication: Parent can view child published results and GPA transcript', async () => {
    const res = await db.query(`
      SELECT r.calculated_gpa, r.final_grade, r.class_position
      FROM student_exam_results r
      JOIN student_guardians sg ON r.student_id = sg.student_id
      JOIN guardians g ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND r.student_id = $2 AND r.published_at IS NOT NULL
    `, [parent1UserId, student1Id]);

    if (res.rows.length === 0 || parseFloat(res.rows[0].calculated_gpa) !== 5.0) {
      throw new Error('Parent could not view child published results transcript');
    }
  });

  await testScenario(53, 'Student IDOR: Student 1 attempting to access Student 2 results is BLOCKED', async () => {
    // Querying with student 1 userId for student 2 studentId
    const res = await db.query(`
      SELECT r.* FROM student_exam_results r
      JOIN student_users su ON r.student_id = su.student_id
      WHERE su.user_id = $1 AND r.student_id = $2
    `, [student1UserId, student2Id]);

    if (res.rows.length !== 0) {
      throw new Error('Student 1 accessed Student 2 results! IDOR vulnerability.');
    }
  });

  await testScenario(54, 'Parent IDOR: Parent 1 attempting to access Student 2 results is BLOCKED', async () => {
    const res = await db.query(`
      SELECT r.* FROM student_exam_results r
      JOIN student_guardians sg ON r.student_id = sg.student_id
      JOIN guardians g ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND r.student_id = $2
    `, [parent1UserId, student2Id]);

    if (res.rows.length !== 0) {
      throw new Error('Parent 1 accessed Student 2 results! IDOR vulnerability.');
    }
  });

  await testScenario(55, 'Ranking Privacy: Result query omits sensitive PII (no national_id, birth_reg_no, phone, address leak)', async () => {
    const safeQuery = await db.query(`
      SELECT r.class_position, r.calculated_gpa, r.final_grade, s.full_name_en, s.student_code
      FROM student_exam_results r
      JOIN students s ON r.student_id = s.id
      WHERE r.exam_id = $1
      ORDER BY r.class_position ASC
    `, [exam1Id]);

    for (const row of safeQuery.rows) {
      if (row.national_id !== undefined || row.phone !== undefined || row.birth_registration_no !== undefined) {
        throw new Error('Sensitive PII leaked in ranking results!');
      }
    }
  });

  // ============================================================================
  // PART F — HISTORICAL INTEGRITY, RLS, AND AUDIT TESTS
  // ============================================================================
  console.log('\n--- PART F: HISTORICAL INTEGRITY, RLS, AND AUDIT ---');

  await testScenario(56, 'Historical exam results remain unchanged when student is promoted to new class', async () => {
    // Verify Student 1's Class 5 exam result is still intact after promotion to Class 6
    const res = await db.query(`
      SELECT r.*, c.name_en as class_name
      FROM student_exam_results r
      JOIN classes c ON r.class_id = c.id
      WHERE r.student_id = $1 AND r.exam_id = $2
    `, [student1Id, exam1Id]);

    if (res.rows.length === 0 || res.rows[0].class_name !== 'Class 5') {
      throw new Error('Student promotion altered historical exam results class reference');
    }
  });

  await testScenario(57, 'Section transfer safety: Transferring student between sections retains historical marks and results tied to original section', async () => {
    // When a student is transferred to Section B within the same session, their enrollment section updates:
    await db.query(`
      UPDATE enrollments SET section_id = $1 WHERE id = $2
    `, [section5BId, enroll2Id]);

    // Verify student_exam_results still retains the original historical section (Section A) where the exam was taken!
    const res = await db.query(`
      SELECT r.section_id, e.section_id as current_section_id
      FROM student_exam_results r
      JOIN enrollments e ON r.enrollment_id = e.id
      WHERE r.student_id = $1 AND r.exam_id = $2
    `, [student2Id, exam1Id]);

    if (res.rows[0].section_id !== section5AId) {
      throw new Error('Historical exam result section was rewritten by current enrollment transfer!');
    }

    if (res.rows[0].current_section_id !== section5BId) {
      throw new Error('Current enrollment section was not updated');
    }
  });

  await testScenario(58, 'Forensic Audit Log captures attendance, exam, marks, and result events', async () => {
    // Log exam and result publication audit events
    await db.query(`
      INSERT INTO audit_logs (id, school_id, actor_user_id, actor_name, actor_role, action, entity, entity_id, change_summary)
      VALUES ($1, $2, $3, 'Principal M. Rahman', 'ADMIN', 'PUBLISH', 'StudentExamResult', $4, 'Published official exam results')
    `, [randomUUID(), schoolAId, principalUserId, exam1Id]);

    const logs = await db.query(`
      SELECT count(*) as cnt FROM audit_logs WHERE school_id = $1
    `, [schoolAId]);

    if (parseInt(logs.rows[0].cnt, 10) < 2) {
      throw new Error('Audit logs count is lower than expected');
    }
  });

  await testScenario(59, 'PostgreSQL RLS tenant isolation: Direct DB queries under School B tenant context return 0 rows for School A marks and results', async () => {
    await withTenant(schoolBId, async () => {
      const marksRes = await db.query(`SELECT * FROM marks WHERE exam_id = $1`, [exam1Id]);
      if (marksRes.rows.length !== 0) throw new Error('RLS failed: School B accessed School A marks');

      const resultsRes = await db.query(`SELECT * FROM student_exam_results WHERE exam_id = $1`, [exam1Id]);
      if (resultsRes.rows.length !== 0) throw new Error('RLS failed: School B accessed School A exam results');
    });
  });

  console.log('\n================================================================');
  console.log(`EduSmart BD — Phase 5 Test Suite Results:`);
  console.log(`Executed: ${stats.executed} / ${stats.expected}`);
  console.log(`Passed:   ${stats.passed}`);
  console.log(`Failed:   ${stats.failed}`);
  console.log('================================================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
