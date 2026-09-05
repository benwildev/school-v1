# Phase 3.4 — Subject Management

## Overview
Phase 3.4 implements Subject Management for EduSmart BD. The objective was to expose the existing `Subject` model in `schema.prisma` through secure API endpoints and a Bangla-first UI, while strictly adhering to tenant isolation, role-based access control, and forensic audit logging.

## Database Schema Discovery
The `Subject` model was discovered in `schema.prisma` as follows:
- Subjects are **class-specific** (linked via `classId`).
- Subjects can optionally be **group-specific** (linked via `groupId`).
- This means "Mathematics for Class 8" and "Mathematics for Class 9" are stored as separate Subject records, perfectly mirroring the intended architectural boundaries.
- No new database schema migration was necessary. The existing schema perfectly accommodates the Phase 3.4 requirements.

## Models Reused
- `Subject`
- `Class` (for relationship)
- `AcademicGroup` (for relationship)
- `School` (for tenant isolation)

## API Routes Created
1. **`GET /api/school/subjects`**
   - Lists all subjects for the active tenant.
   - Requires `ACADEMICS_VIEW` permission.
   - Accepts an optional `?classId=` query parameter for filtering.
2. **`POST /api/school/subjects`**
   - Creates a new subject.
   - Checks the database unique constraint: `[schoolId, classId, code]`.
   - Requires `ACADEMICS_CREATE` permission.
3. **`GET /api/school/subjects/[subjectId]`**
   - Fetches a single subject by ID.
4. **`PATCH /api/school/subjects/[subjectId]`**
   - Updates an existing subject.
   - Requires `ACADEMICS_UPDATE` permission.
5. **`DELETE /api/school/subjects/[subjectId]`**
   - Attempts safe deletion.
   - Requires `ACADEMICS_DELETE` permission.
   - Protects historical data: If a subject is referenced by routines, exams, or marks, the deletion falls back to a non-destructive deactivation (`status = INACTIVE`).

## Business Rules Enforced
1. Subject must belong to the correct school (tenant).
2. Cross-school access is strictly blocked at the query layer via `withTenantContext()`.
3. Client-supplied `schoolId` is entirely ignored; tenant context is derived exclusively from the verified session token.
4. Duplicate subject codes within the same class are rejected.
5. Unsafe destructive deletion is blocked if historical references exist.

## Tenant & Security Controls
- Standard multi-tenant RLS guarantees are applied automatically.
- No `schoolId` injection is possible from the client JSON body.
- Only users with verified `ACADEMICS_*` permissions can access or mutate data.

## Audit Logging
- Every `INSERT`, `UPDATE`, and `DELETE`/`DEACTIVATE` operation generates a forensic audit log via `logAuditEvent()`.
- Records include actor user ID, role, before/after states, operation, IP address, and user-agent string.

## User Interface (UI)
- Path: `/dashboard/settings/subjects`
- A Bangla-first interface featuring a filterable data table for subjects.
- Add/Edit dialogs with fields for English name, Bangla name, Subject Code, Subject Type (COMPULSORY, ELECTIVE, etc.), Marks distribution, Class, and Group mappings.

## Testing Strategy
An automated test script (`scripts/test-phase3-4-subjects.mjs`) has been written to verify:
- Authentication & Authorization workflows.
- Successful creation, read, update, and deletion of Subject records.
- Proper enforcement of duplicate constraints.
- Rejection of unauthorized unauthenticated requests.
