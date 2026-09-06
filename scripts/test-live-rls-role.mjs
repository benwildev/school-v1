import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Build URL for edusmart_app_user
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.username = 'edusmart_app_user';
dbUrl.password = 'edusmart_app_password_2026_secure!';
const appUserUrl = dbUrl.toString();

const pool = new pg.Pool({ connectionString: appUserUrl });

async function testRls() {
  const client = await pool.connect();
  try {
    console.log('--- 11.9-B: Testing Live PostgreSQL RLS Under edusmart_app_user (rolbypassrls = false) ---');

    // Check user & rolbypassrls
    const whoami = await client.query(`
      SELECT current_user, r.rolbypassrls 
      FROM pg_roles r 
      WHERE r.rolname = current_user;
    `);
    console.log('Connected user:', whoami.rows[0]);
    if (whoami.rows[0].rolbypassrls !== false) {
      throw new Error('FAIL: User has rolbypassrls = true!');
    }

    // Inspect RLS status on core tenant tables
    const rlsTables = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log(`Total public tables: ${rlsTables.rows.length}`);
    const tablesWithRls = rlsTables.rows.filter(r => r.rowsecurity);
    console.log(`Tables with rowsecurity enabled: ${tablesWithRls.length}`);

    // Check policies on students
    const studentPolicies = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'students';
    `);
    console.log('Students policies:', studentPolicies.rows);

    // Let's test tenant isolation on students table:
    // 1. Without setting app.current_school_id
    const noSchoolStudents = await client.query(`SELECT count(*) FROM students;`);
    console.log('Students visible without tenant context:', noSchoolStudents.rows[0].count);

    // 2. Query two different real schools from the DB
    const schools = await client.query(`SELECT id, name_en, slug FROM schools LIMIT 2;`);
    if (schools.rows.length >= 2) {
      const school1 = schools.rows[0];
      const school2 = schools.rows[1];

      // Test with school1 context
      await client.query(`SET LOCAL app.current_school_id = '${school1.id}';`);
      const school1Students = await client.query(`SELECT count(*) FROM students;`);
      console.log(`Students visible for ${school1.name_en} (${school1.id}):`, school1Students.rows[0].count);

      // Verify all returned students belong to school1
      const school1Check = await client.query(`SELECT distinct school_id FROM students;`);
      console.log(`Distinct school_ids visible in school1 context:`, school1Check.rows.map(r => r.school_id));
      if (school1Check.rows.some(r => r.school_id !== school1.id)) {
        throw new Error('FAIL: Cross-tenant data leaked in school1 context!');
      }

      // Test with school2 context
      await client.query(`SET LOCAL app.current_school_id = '${school2.id}';`);
      const school2Students = await client.query(`SELECT count(*) FROM students;`);
      console.log(`Students visible for ${school2.name} (${school2.id}):`, school2Students.rows[0].count);

      const school2Check = await client.query(`SELECT distinct school_id FROM students;`);
      console.log(`Distinct school_ids visible in school2 context:`, school2Check.rows.map(r => r.school_id));
      if (school2Check.rows.some(r => r.school_id !== school2.id)) {
        throw new Error('FAIL: Cross-tenant data leaked in school2 context!');
      }

      console.log('PASS: Strict PostgreSQL RLS tenant isolation verified on students table!');
    }

    console.log('--- 11.9-B Verification Complete: PASS ---\n');
  } catch (err) {
    console.error('Error in testRls:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testRls();
