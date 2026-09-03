# Phase 3.2 — Academic Session Management

## Summary

Implements complete Academic Session management for a school, reusing the
existing `AcademicSession` Prisma model — including a database-level partial
unique index that already enforced "only one current session per school" —
together with the existing authorization engine, tenant-context helper, and
audit logger. **No schema or migration changes were required.**

## Files Created

- `src/lib/validation/academic-session.ts` — Zod schemas + `computeSessionStatus()`
- `src/lib/academic-session.ts` — `resolveSessionStatusPatch()`, the shared transactional activation/archival helper
- `src/app/api/school/academic-sessions/route.ts` — `GET` (list), `POST` (create)
- `src/app/api/school/academic-sessions/[sessionId]/route.ts` — `GET` (single), `PATCH` (update / activate / archive)
- `src/app/dashboard/settings/academic-sessions/page.tsx` — Bangla-first Academic Session UI
- `scripts/test-phase3-2-academic-sessions.mjs` — 18-scenario tenant/security/business-rule/concurrency test suite

## Files Modified

- `src/app/dashboard/layout.tsx` — added a "শিক্ষাবর্ষ" nav item (third entry, after School Settings and Campuses).

## Database Schema

**No migration was created. No Prisma schema changes were made.**

Inspection of `prisma/schema.prisma:737` and `migrations/0003_create_academic_tables.sql`
showed the `AcademicSession` model already provided every field this phase
needed:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `schoolId` | UUID FK → `School` | `onDelete: Restrict` |
| `name` | VARCHAR(100) | unique per school |
| `startDate` / `endDate` | DATE | |
| `isCurrent` | boolean | the "current/active session" flag |
| `isLocked` | boolean | finalized/frozen flag, reused here as the ARCHIVED signal |
| `createdAt` / `updatedAt` | timestamps | |

Constraints already in place and reused as-is (found in
`migrations/0008_composite_foreign_keys_and_partial_indexes.sql:5-7`):

- `@@unique([schoolId, name])` — session name uniqueness per school.
- **`CREATE UNIQUE INDEX uq_one_current_session_per_school ON academic_sessions (school_id) WHERE is_current = TRUE`**
  — a partial unique index that already guarantees, at the database level,
  that a school can have at most one `isCurrent = TRUE` row. This is the
  exact "only one ACTIVE session per school" invariant the phase brief asked
  for — it pre-existed and required no new trigger or constraint.
- Row-Level Security (`tenant_isolation_policy`) already active on
  `academic_sessions` via migration `0010_enable_tenant_rls_policies.sql`
  (it's listed in the `direct_tenant_tables` array), scoped by
  `app.current_school_id`.

### Why no `status` column was added

The model has no persisted lifecycle enum — only the two booleans above. The
brief allows a minimal `UPCOMING / ACTIVE / COMPLETED / ARCHIVED` lifecycle
*if no suitable status exists*, but also says not to invent unnecessary
fields and to modify the schema only if absolutely necessary. Since the two
existing booleans plus the date range are sufficient to derive all four
states unambiguously, a computed (non-persisted) status was used instead:

```
isCurrent = true                                  → ACTIVE
isCurrent = false, isLocked = true                 → ARCHIVED
isCurrent = false, isLocked = false, endDate < now  → COMPLETED
isCurrent = false, isLocked = false, endDate >= now → UPCOMING
```

This is implemented as the pure function `computeSessionStatus()` in
`src/lib/validation/academic-session.ts` and applied to every API response.
It is never written to the database and can't drift out of sync with
`isCurrent`/`isLocked`.

Because there is no dedicated "completed" flag, **`COMPLETED` cannot be
requested directly** — a client may only ask for `UPCOMING`, `ACTIVE`, or
`ARCHIVED` as an explicit transition (`AcademicSessionSettableStatusEnum`).
`COMPLETED` is purely a date-derived read state. This is validated and
tested (Test K-b).

`SchoolSettings.activeSessionId` (a bare, FK-less UUID column already present
in `school_settings`, created before `academic_sessions` even existed) was
deliberately left untouched — the brief forbids rewriting School Settings,
and `AcademicSession.isCurrent` (backed by the partial unique index) is
already the authoritative, DB-enforced "current session" mechanism for this
phase.

## API Routes

All routes live under `/api/school/academic-sessions` and follow the same
`requirePermission()` → `withTenantContext()` → `logAuditEvent()` pipeline
used by `/api/school/settings` and `/api/school/campuses`.

| Method | Route | Permission | Behavior |
|---|---|---|---|
| GET | `/api/school/academic-sessions` | `ACADEMICS_VIEW` | Lists all sessions for the caller's active school (current session first, then newest start date). Response includes `canCreate` / `canUpdate` (from independent `ACADEMICS_CREATE` / `ACADEMICS_UPDATE` checks) so the UI can gate actions granularly. |
| POST | `/api/school/academic-sessions` | `ACADEMICS_CREATE` | Creates a session. Accepts an optional `status: "ACTIVE"` to create-and-activate in one transactional step. Zod-invalid input → 400; a name collision (`P2002` on `(schoolId, name)`) → 409. Writes an `INSERT` audit log. |
| GET | `/api/school/academic-sessions/[sessionId]` | `ACADEMICS_VIEW` | Returns a single session scoped to the caller's school; 404 if it doesn't exist *or* belongs to another school. |
| PATCH | `/api/school/academic-sessions/[sessionId]` | `ACADEMICS_UPDATE` | Partial update of `name`/`startDate`/`endDate`, and/or a `status` transition (`ACTIVE` / `ARCHIVED` / `UPCOMING`). Re-validates the merged date range server-side even when only one of the two dates is supplied. Writes an `UPDATE` audit log with before/after state. |

**No DELETE route was added.** `AcademicSession` is referenced with
`ON DELETE CASCADE` by `enrollments`, `routines`, `academic_calendars`,
`teacher_assignments`, `exams`, `fee_structures`, `admission_applications`,
`promotion_batches`, and `subject_assessment_configs` — deleting a session
row would cascade-delete any historical data already linked to it once those
modules exist. Per the brief ("prefer ARCHIVED/COMPLETED over destructive
deletion"), `PATCH { status: "ARCHIVED" }` is the supported way to retire a
session while its row (and future historical references to it) stay intact.

### Tenant & permission enforcement in every route

- `schoolId` is derived exclusively from `requirePermission()` → the
  cryptographically verified session token, never from the request body,
  query string, or route params. The Zod schemas
  (`AcademicSessionCreateSchema` / `AcademicSessionUpdateSchema`) have no
  `schoolId` field, so a spoofed value in the JSON body is structurally
  inert (Test I).
- Every DB operation runs inside `withTenantContext(schoolId, ...)`, so
  PostgreSQL RLS enforces isolation beneath the `schoolId` filters already
  present in every query/mutation.
- `GET`/`PATCH` on `[sessionId]` first `findFirst({ where: { id, schoolId } })`
  before acting, so a session ID from another school resolves to "not found"
  rather than leaking existence or being modifiable (Tests G, H).

## Permissions

**No new permission codes were created.** The existing catalog
(`src/lib/authorization/permissions.ts:67-70`) already carries the right
permissions, and `ACADEMICS_VIEW`'s own description explicitly names
"sessions": *"View academic structure, **sessions**, classes, subjects"*.
Reused directly:

- `ACADEMICS_VIEW` — `GET` (list, single)
- `ACADEMICS_CREATE` — `POST` (create, optionally create-and-activate)
- `ACADEMICS_UPDATE` — `PATCH` (edit, activate, archive)

These are already wired into `SYSTEM_ROLE_PERMISSIONS`: `SCHOOL_OWNER`,
`PRINCIPAL`, and `ADMIN` get all three; `TEACHER` and `STUDENT` get
`ACADEMICS_VIEW` only. No broad "manage everything" permission was added.

## Business Rules Implemented

1. A session belongs to exactly one school (`schoolId` FK, immutable — never
   present in the update schema).
2. Cross-school read/update of another school's session is impossible,
   enforced independently at both the application layer and RLS.
3. Client-supplied `schoolId` cannot influence tenant context under any code
   path.
4. `startDate < endDate` is enforced on create via a Zod `.refine()`, and on
   update by merging the incoming partial payload with the persisted row
   before re-checking the range server-side (so patching only `startDate`
   against an existing `endDate` is still validated).
5. Session name is validated (2–100 chars, trimmed) and uniqueness is
   enforced per school by the existing `(schoolId, name)` constraint; a
   collision returns HTTP 409.
6. Overlapping ACTIVE sessions are impossible — enforced by the pre-existing
   `uq_one_current_session_per_school` partial unique index, independent of
   application logic (Tests M, R).
7. Only one ACTIVE/current session per school can exist (same mechanism).
8. Completing/archiving a session (`status: "ARCHIVED"`) only flips
   `isLocked = true` / `isCurrent = false` — the row and all its fields are
   preserved (Test Q).
9. Historical records that reference a session by ID are unaffected by any
   Academic Session mutation in this phase (no data outside `AcademicSession`
   is ever written).
10. No student/teacher/class/marks/attendance/fee/enrollment records are
    moved between sessions — those modules don't exist yet and nothing in
    this phase touches them.

## Active-Session Behavior

- `isCurrent` (existing field) is the sole source of truth for "the current
  session." It is exposed in every API response as `status: "ACTIVE"` and
  surfaced prominently in the UI as a highlighted "বর্তমান শিক্ষাবর্ষ" (Current
  Academic Session) banner.
- **Activation is transactional and safe under concurrency.** Requesting
  `status: "ACTIVE"` on a session runs, inside a single `withTenantContext()`
  interactive transaction:
  1. `academicSession.updateMany({ where: { schoolId, isCurrent: true, NOT: { id: sessionId } }, data: { isCurrent: false } })`
     — deactivates whichever session (if any) was previously current.
  2. `academicSession.update({ ..., data: { isCurrent: true, isLocked: false } })`
     — activates the target.

  If step 2 fails for any reason, the whole transaction (including step 1)
  rolls back — no session is left deactivated with nothing active in its
  place (Test O). If two requests race to activate different sessions, the
  database's partial unique index makes the second writer's commit fail with
  a unique-constraint violation; the route catches Prisma's `P2002` and
  returns HTTP 409, and the entire attempt's transaction is discarded, so at
  most one `isCurrent = true` row can ever exist per school, regardless of
  request ordering (Tests M, R).
- The active session is never a hidden/global variable — it is always
  resolved per-request from `schoolId` derived from the verified session
  token, exactly like every other query in this phase. A client-provided
  "current session id" is never trusted for authorization; it's purely
  informational in the UI.

## Audit Logging

Every mutation calls the existing `logAuditEvent()`
(`src/lib/audit/logger.ts`), which already redacts sensitive keys:

- `POST` → `action: 'INSERT'`, `entity: 'AcademicSession'`,
  `beforeState: null`, `afterState: <created row>`.
- `PATCH` → `action: 'UPDATE'`, `entity: 'AcademicSession'`, `beforeState`/
  `afterState` captured from before/after the update. `changeSummary`
  distinguishes plain field edits from lifecycle transitions (e.g.
  `Activated academic session "2026"`, `Archived academic session "2025"`).

Actor identity, `schoolId`, IP, and user agent are recorded exactly as the
Campus and School Settings routes do. No new `AuditAction` enum values were
introduced — activation/archival both log as `UPDATE` with a descriptive
`changeSummary`, consistent with how the existing School Settings route
already logs all of its sub-object changes (profile/address/branding) under
a single `UPDATE` action.

## Tests

### New: `scripts/test-phase3-2-academic-sessions.mjs`

Runs against an isolated in-memory PGlite Postgres instance with all 10
canonical migrations applied — the same harness pattern as every other phase
test script. All 18 required scenarios:

| Test | Result |
|---|---|
| A. Authorized user can list sessions | ✓ PASS |
| B. Unauthorized user cannot view sessions | ✓ PASS |
| C. Authorized user can create session | ✓ PASS |
| D. Unauthorized user cannot create session | ✓ PASS |
| E. Authorized user can update session | ✓ PASS |
| F. Unauthorized user cannot update session | ✓ PASS |
| G. School A cannot read School B session (RLS) | ✓ PASS |
| H. School A cannot update School B session (RLS) | ✓ PASS |
| I. Spoofed schoolId cannot escape tenant context | ✓ PASS |
| J. Invalid date range is rejected (3 sub-cases) | ✓ PASS |
| K. Invalid session status is rejected (2 sub-cases) | ✓ PASS |
| L. Duplicate/invalid session behavior follows DB constraints (2 sub-cases) | ✓ PASS |
| M. Only one ACTIVE session can exist per school | ✓ PASS |
| N. Activating a session safely transitions the previous active session | ✓ PASS |
| O. Activation is transactional | ✓ PASS |
| P. Audit log is generated | ✓ PASS |
| Q. Historical sessions are not deleted when archived | ✓ PASS |
| R. Concurrent activation cannot leave multiple ACTIVE sessions | ✓ PASS |

Tests O and R specifically exercise the database's own guarantees rather
than trusting application code: Test O forces a mid-transaction failure
(`RETURNING (1/0)`) after the deactivation step and confirms the whole
transaction — deactivation included — rolls back; Test R deliberately skips
the "deactivate first" step to simulate the worst-case race and confirms the
partial unique index alone blocks the second activation.

### Full Regression Run (all commands actually executed)

```
npx tsc --noEmit                                     → 0 errors
npm run lint                                         → 0 errors, 0 warnings
npm run build                                        → compiled successfully, all routes registered
npx tsx scripts/test-database-integrity.mjs               → ALL PASSED (100%)
npx tsx scripts/test-phase2-security.mjs                   → ALL PASSED (100%)
npx tsx scripts/test-phase2-1-security-hardening.mjs        → ALL PASSED (100%)
npx tsx scripts/test-phase3-school-settings.mjs              → ALL PASSED (100%) — unmodified, still 9/9
npx tsx scripts/test-phase3-1-campus.mjs                     → ALL PASSED (100%) — unmodified, still 11/11
npx tsx scripts/test-phase3-2-academic-sessions.mjs           → ALL PASSED (100%) — 18/18 (A–R)
```

No existing test file was edited, weakened, or skipped.

## Strict Stop Condition — Confirmed Respected

This phase implemented **only** Academic Session management: the reused
`AcademicSession` model, its two API routes, its settings page, and its test
suite. Nothing from the excluded list (Class, Section, Shift, Group,
Subject, Teacher, Teacher Assignment, Student, Guardian, Enrollment,
Attendance, Marks, Examination, Result, Fees, Discounts, Payments,
Admissions, Communication, WhatsApp, Biometric, Reports, Certificates, ID
Cards, Public Website, Subscription, or SuperAdmin features) was built,
modified, or scaffolded. Existing authentication, RBAC, tenant isolation,
RLS, audit logging, School Settings, and Campus management were reused as-is
and were not rewritten.
