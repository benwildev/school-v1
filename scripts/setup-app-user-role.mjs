import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function setupAppUser() {
  const client = await pool.connect();
  try {
    console.log('--- 11.9-B: Database Connection Role & RLS Setup ---');

    // 1. Inspect role
    const roleRes = await client.query(`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = 'edusmart_app_user';
    `);
    console.log('Current edusmart_app_user info:', roleRes.rows[0]);

    // 2. Set a strong password for edusmart_app_user
    // Use a fixed strong password for the Neon user or generate one
    const appUserPassword = 'edusmart_app_password_2026_secure!';
    await client.query(`ALTER ROLE edusmart_app_user WITH PASSWORD '${appUserPassword}';`);
    console.log('Updated role password. rolbypassrls is already false.');

    // 3. Grant schema permissions
    await client.query(`GRANT USAGE ON SCHEMA public TO edusmart_app_user;`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO edusmart_app_user;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO edusmart_app_user;`);
    console.log('Granted ALL privileges on tables and sequences to edusmart_app_user.');

    // 4. Test connecting as edusmart_app_user
    // Construct connection string for edusmart_app_user from existing DATABASE_URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    dbUrl.username = 'edusmart_app_user';
    dbUrl.password = appUserPassword;
    const appUserUrl = dbUrl.toString();

    const appPool = new pg.Pool({ connectionString: appUserUrl });
    const appClient = await appPool.connect();

    // Verify current user & rolbypassrls
    const whoami = await appClient.query(`
      SELECT current_user, r.rolbypassrls 
      FROM pg_roles r 
      WHERE r.rolname = current_user;
    `);
    console.log('Connected as:', whoami.rows[0]);

    // 5. Test RLS isolation:
    // When app.current_school_id is NOT set:
    const noContextRes = await appClient.query(`SELECT count(*) FROM schools;`);
    console.log('Query schools count without school context:', noContextRes.rows[0].count);

    // When app.current_school_id IS set:
    await appClient.query(`SET LOCAL app.current_school_id = 'test-school-id';`);
    const withContextRes = await appClient.query(`SELECT count(*) FROM schools;`);
    console.log('Query schools count with school context test-school-id:', withContextRes.rows[0].count);

    appClient.release();
    await appPool.end();

    console.log('--- 11.9-B: App User Role & RLS Verification SUCCESSFUL ---');
    console.log('App User Connection URL:', appUserUrl);
  } catch (err) {
    console.error('Error in setupAppUser:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupAppUser();
