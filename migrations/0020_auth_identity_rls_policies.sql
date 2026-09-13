-- ============================================================================
-- Migration 0020: Fix Auth Identity RLS Policies for edusmart_app_user
-- ============================================================================
-- Problem being fixed: users/roles/user_roles legitimately need to be looked
-- up by user identity (login, session verification, multi-school membership
-- resolution) BEFORE any single school's app.current_school_id is known --
-- a person can hold roles at more than one school. The strict per-school
-- policy from migration 0010 made those lookups always return zero rows on
-- the unscoped connection, which is how the app actually issues them.
--
-- This is fixed via an EXPLICIT, narrow opt-in sentinel (app.identity_lookup)
-- that only the identity/authorization layer sets (see withIdentityContext in
-- src/lib/db.ts), NOT by treating an absent/empty app.current_school_id as an
-- implicit bypass. Fail-closed remains the default for every other query.
--
-- teachers/guardians/student_users are intentionally NOT included here: each
-- row belongs to exactly one school, so they stay under the strict per-school
-- policy from migration 0010 (school_id must match app.current_school_id).
-- Callers that need to read them (src/lib/authorization/scopes.ts,
-- src/lib/academic/teacher-scope.ts, src/lib/reports/report-permissions.ts,
-- and the relevant API routes) must use withTenantContext, not this bypass.
-- ============================================================================

-- 1. users (school_id IS NULL covers platform-level users with no fixed home school, e.g. SuperAdmins)
DROP POLICY IF EXISTS tenant_isolation_policy ON users;
CREATE POLICY tenant_isolation_policy ON users
  FOR ALL
  USING (
    current_setting('app.identity_lookup', true) = 'true'
    OR school_id IS NULL
    OR school_id::text = current_setting('app.current_school_id', true)
  )
  WITH CHECK (
    current_setting('app.identity_lookup', true) = 'true'
    OR school_id IS NULL
    OR school_id::text = current_setting('app.current_school_id', true)
  );

-- 2. roles (school_id IS NULL covers global/system roles shared across schools)
DROP POLICY IF EXISTS tenant_isolation_policy ON roles;
CREATE POLICY tenant_isolation_policy ON roles
  FOR ALL
  USING (
    current_setting('app.identity_lookup', true) = 'true'
    OR school_id IS NULL
    OR school_id::text = current_setting('app.current_school_id', true)
  )
  WITH CHECK (
    current_setting('app.identity_lookup', true) = 'true'
    OR school_id IS NULL
    OR school_id::text = current_setting('app.current_school_id', true)
  );

-- 3. user_roles (no direct school_id column; scoped via the linked role)
DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles;
DROP POLICY IF EXISTS tenant_isolation_policy ON user_roles;
CREATE POLICY user_roles_tenant_isolation ON user_roles
  FOR ALL
  USING (
    current_setting('app.identity_lookup', true) = 'true'
    OR role_id IN (
      SELECT id FROM roles
      WHERE school_id::text = current_setting('app.current_school_id', true)
         OR school_id IS NULL
    )
  )
  WITH CHECK (
    current_setting('app.identity_lookup', true) = 'true'
    OR role_id IN (
      SELECT id FROM roles
      WHERE school_id::text = current_setting('app.current_school_id', true)
         OR school_id IS NULL
    )
  );

-- 4. teachers / guardians / student_users: re-affirm the strict migration-0010
-- policy explicitly in this file so the identity bypass above is never
-- mistaken for covering them too. No functional change from migration 0010.
DROP POLICY IF EXISTS tenant_isolation_policy ON teachers;
CREATE POLICY tenant_isolation_policy ON teachers
  FOR ALL
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON guardians;
CREATE POLICY tenant_isolation_policy ON guardians
  FOR ALL
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON student_users;
CREATE POLICY tenant_isolation_policy ON student_users
  FOR ALL
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
