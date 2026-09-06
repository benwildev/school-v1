import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: directUrl });

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Executing Phase 11.9 Database Migration & Schema Drift Reconciliation ---');
    await client.query('BEGIN;');

    // 1. Create schema_migrations ledger table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        description TEXT
      );
    `);
    console.log('Step 1: schema_migrations table created/verified.');

    // 2. Add 'TRANSPORT' to PermissionModule enum
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e 
          JOIN pg_type t ON e.enumtypid = t.oid 
          WHERE t.typname = 'PermissionModule' AND e.enumlabel = 'TRANSPORT'
        ) THEN
          ALTER TYPE "PermissionModule" ADD VALUE 'TRANSPORT';
        END IF;
      END$$;
    `);
    console.log('Step 2: PermissionModule enum reconciled with TRANSPORT.');

    // 3. Add 'TRANSPORT_ALERT' to MessageType enum
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e 
          JOIN pg_type t ON e.enumtypid = t.oid 
          WHERE t.typname = 'MessageType' AND e.enumlabel = 'TRANSPORT_ALERT'
        ) THEN
          ALTER TYPE "MessageType" ADD VALUE 'TRANSPORT_ALERT';
        END IF;
      END$$;
    `);
    console.log('Step 3: MessageType enum reconciled with TRANSPORT_ALERT.');

    // 4. school_subscriptions: ensure start_date and end_date columns exist
    // Check existing columns
    const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'school_subscriptions' 
        AND column_name IN ('start_date', 'end_date', 'startdate', 'enddate');
    `);
    const existingCols = colCheck.rows.map(r => r.column_name);

    if (existingCols.includes('startdate') && !existingCols.includes('start_date')) {
      await client.query(`ALTER TABLE school_subscriptions RENAME COLUMN startdate TO start_date;`);
      console.log('Step 4a: Renamed school_subscriptions.startdate -> start_date');
    }
    if (existingCols.includes('enddate') && !existingCols.includes('end_date')) {
      await client.query(`ALTER TABLE school_subscriptions RENAME COLUMN enddate TO end_date;`);
      console.log('Step 4b: Renamed school_subscriptions.enddate -> end_date');
    }

    // 5. user_roles: enable and force RLS
    await client.query(`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles;`);
    await client.query(`
      CREATE POLICY user_roles_tenant_isolation ON user_roles
        FOR ALL
        USING (
          current_setting('app.current_school_id', true) = 'superadmin'
          OR role_id IN (
            SELECT id FROM roles
            WHERE school_id::text = current_setting('app.current_school_id', true)
               OR school_id IS NULL
          )
        );
    `);
    console.log('Step 5: user_roles Row Level Security enabled, forced, and policy applied.');

    // 6. student_guardians: partial unique index for primary guardian
    await client.query(`DROP INDEX IF EXISTS uq_student_primary_guardian;`);
    await client.query(`
      CREATE UNIQUE INDEX uq_student_primary_guardian
        ON student_guardians (student_id)
        WHERE is_primary = true;
    `);
    console.log('Step 6: Primary guardian partial unique index created.');

    // 7. enrollments: convert unconditional constraints to partial unique indexes (WHERE status = 'ACTIVE')
    await client.query(`ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS uq_enrollment_session_student;`);
    await client.query(`DROP INDEX IF EXISTS uq_enrollment_session_student;`);
    await client.query(`DROP INDEX IF EXISTS uq_enrollment_session_active_student;`);
    await client.query(`
      CREATE UNIQUE INDEX uq_enrollment_session_active_student
        ON enrollments (school_id, academic_session_id, student_id)
        WHERE status = 'ACTIVE';
    `);

    await client.query(`ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS uq_enrollment_session_roll;`);
    await client.query(`DROP INDEX IF EXISTS uq_enrollment_session_roll;`);
    await client.query(`DROP INDEX IF EXISTS uq_enrollment_session_active_roll;`);
    await client.query(`
      CREATE UNIQUE INDEX uq_enrollment_session_active_roll
        ON enrollments (school_id, academic_session_id, class_id, section_id, roll_no)
        WHERE status = 'ACTIVE';
    `);
    console.log('Step 7: Enrollment partial unique indexes created (historical transfers enabled).');

    // 8. Grant privileges to edusmart_app_user
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;`);
    console.log('Step 8: Granted schema permissions on all tables to edusmart_app_user.');

    // 9. Record migration in schema_migrations
    await client.query(`
      INSERT INTO schema_migrations (version, description)
      VALUES ('20260906_phase11_9_production_remediation', 'Phase 11.9 Schema drift reconciliation, partial unique indexes, RLS policies, and enum updates.')
      ON CONFLICT (version) DO UPDATE SET applied_at = NOW();
    `);
    console.log('Step 9: Migration recorded in schema_migrations ledger.');

    await client.query('COMMIT;');
    console.log('--- Phase 11.9 Database Migration COMPLETED SUCCESSFULLY ---\n');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
