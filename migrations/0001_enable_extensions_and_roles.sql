-- ============================================================================
-- Migration 0001: Extensions and Security Roles
-- ============================================================================

-- PostgreSQL 13+ provides native gen_random_uuid(). Enable extensions conditionally.
DO $$ 
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'uuid-ossp extension skipped or already present.';
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgcrypto extension skipped or already present.';
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "btree_gist";
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'btree_gist extension skipped or already present.';
  END;
END $$;

-- Create schema for custom functions and procedures
CREATE SCHEMA IF NOT EXISTS app;

-- Create application user role vs admin role safely for both self-hosted and cloud DBs (Neon/RDS)
DO $$ 
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'edusmart_app_user') THEN
      CREATE ROLE edusmart_app_user WITH LOGIN PASSWORD 'CHANGE_IN_PROD_APP_PASSWORD';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping edusmart_app_user creation: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'edusmart_admin_role') THEN
      CREATE ROLE edusmart_admin_role WITH LOGIN PASSWORD 'CHANGE_IN_PROD_ADMIN_PASSWORD';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping edusmart_admin_role creation: %', SQLERRM;
  END;
END $$;

-- Active tenant resolution function
CREATE OR REPLACE FUNCTION app.current_school_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_school_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;
