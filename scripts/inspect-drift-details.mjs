import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function inspectDrift() {
  const client = await pool.connect();
  try {
    console.log('--- Inspecting Neon Schema Drift Details ---');

    // 1. PermissionModule enum values
    const permEnum = await client.query(`
      SELECT enumlabel 
      FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = 'PermissionModule';
    `);
    console.log('PermissionModule labels:', permEnum.rows.map(r => r.enumlabel));

    // 2. MessageType enum values
    const msgEnum = await client.query(`
      SELECT enumlabel 
      FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = 'MessageType';
    `);
    console.log('MessageType labels:', msgEnum.rows.map(r => r.enumlabel));

    // 3. school_subscriptions columns
    const subCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'school_subscriptions';
    `);
    console.log('school_subscriptions columns:', subCols.rows);

    // 4. promotion_items columns
    const promoCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'promotion_items';
    `);
    console.log('promotion_items columns:', promoCols.rows);

    // 5. transport time columns
    const transportCols = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('transport_routes', 'transport_trips', 'route_stops') 
        AND column_name LIKE '%time%';
    `);
    console.log('Transport time columns:', transportCols.rows);

    // 6. user_roles and roles
    const rolesCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'roles';
    `);
    console.log('roles columns:', rolesCols.rows.map(r => r.column_name));

    const urCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_roles';
    `);
    console.log('user_roles columns:', urCols.rows.map(r => r.column_name));

    const urRls = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'user_roles';
    `);
    console.log('user_roles RLS:', urRls.rows);

    // 7. schema_migrations table
    const smTable = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'schema_migrations';
    `);
    console.log('schema_migrations exists:', smTable.rows.length > 0);

  } finally {
    client.release();
    await pool.end();
  }
}

inspectDrift();
