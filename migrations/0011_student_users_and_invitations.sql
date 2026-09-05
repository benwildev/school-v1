-- ============================================================================
-- Migration 0011: Student Portal Identity & Account Invitations
-- ============================================================================

-- Create Enums
CREATE TYPE "InvitationTargetType" AS ENUM ('GUARDIAN', 'STUDENT');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- 1. student_users: Explicit 1:1 join table linking Student permanent academic identity to User login identity
CREATE TABLE student_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_user_student UNIQUE (student_id),
  CONSTRAINT uq_student_user_user UNIQUE (user_id),
  CONSTRAINT uq_student_user_tenant UNIQUE (id, school_id)
);

-- 2. account_invitations: Secure single-use high-entropy token store for portal activations
CREATE TABLE account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  target_type "InvitationTargetType" NOT NULL,
  guardian_id UUID REFERENCES guardians(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  recipient_email VARCHAR(255),
  status "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invitation_id_school UNIQUE (id, school_id)
);

-- Indexes for performance & security lookups
CREATE INDEX idx_student_users_school ON student_users (school_id);
CREATE INDEX idx_student_users_student ON student_users (student_id);
CREATE INDEX idx_student_users_user ON student_users (user_id);

CREATE INDEX idx_account_invitations_token_hash ON account_invitations (token_hash);
CREATE INDEX idx_account_invitations_school_status ON account_invitations (school_id, status);
CREATE INDEX idx_account_invitations_guardian ON account_invitations (guardian_id);
CREATE INDEX idx_account_invitations_student ON account_invitations (student_id);

-- Enable & force Row-Level Security on both new tables
ALTER TABLE student_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON student_users;
CREATE POLICY tenant_isolation_policy ON student_users
FOR ALL
USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON account_invitations;
CREATE POLICY tenant_isolation_policy ON account_invitations
FOR ALL
USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

-- Grant permissions to edusmart_app_user if present
DO $$
BEGIN
  BEGIN
    GRANT ALL PRIVILEGES ON student_users TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON account_invitations TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
