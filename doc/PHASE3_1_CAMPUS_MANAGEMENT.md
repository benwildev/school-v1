# Phase 3.1 — Campus / Branch Management

## Summary

Implements complete Campus / Branch management for a school, reusing the existing
Campus Prisma model, authorization engine, tenant-context helper, audit logger,
and School Settings UI/API conventions established in Phase 3. No schema or
migration changes were required — the `campuses` table already had every field
this phase needed, including its RLS policy and `(schoolId, code)` uniqueness
constraint.

## Files Created

- `src/lib/validation/campus.ts` — Zod schemas (`CampusCreateSchema`, `CampusUpdateSchema`)
- `src/app/api/school/campuses/route.ts` — `GET` (list), `POST` (create)
- `src/app/api/school/campuses/[campusId]/route.ts` — `GET` (single), `PATCH` (update/deactivate)
- `src/app/dashboard/settings/campuses/page.tsx` — Bangla-first Campus/Branch management UI
- `scripts/test-phase3-1-campus.mjs` — Tenant security & business-rule test suite

## Files Modified

- `src/app/dashboard/layout.tsx` — added a "ক্যাম্পাস / শাখা" nav item and made the
  breadcrumb label dynamic based on the active settings section (was previously
  hardcoded to "বিদ্যালয়ের পরিচিতি" for every settings page).

## Database Schema

**No migration was created. No Prisma schema changes were made.**

The existing `Campus` model (`prisma/schema.prisma:637`) and its `campuses` table
(`migrations/0002_create_types_and_core_tables.sql:158`) already provided every
field required by this phase:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `schoolId` | UUID FK → `School` | `onDelete: Restrict` |
| `code` | VARCHAR(20) | unique per school |
| `nameEn` / `nameBn` | VARCHAR(255) | |
| `phone` / `email` / `principalName` | nullable | |
| `isMainBranch` | boolean | |
| `status` | `RecordStatus` (`ACTIVE` / `INACTIVE` / `ARCHIVED`) | |
| `createdAt` / `updatedAt` / `deletedAt` | timestamps | |

Constraints already in place and reused as-is:
- `@@unique([schoolId, code])` — enforces campus-code uniqueness per school.
- Row-Level Security (`tenant_isolation_policy`) already active on `campuses`
  via migration `0010_enable_tenant_rls_policies.sql`, scoped by
  `app.current_school_id`.

Bangladesh-oriented address detail is intentionally **not** duplicated onto
`Campus` — the schema already models campus-level addresses through the
existing `SchoolAddress.campusId` (optional) relation, which belongs to a
future phase if/when campus-level address entry is required. Adding it here
would have been inventing an unrequested field, so it was left out per the
"do not invent unnecessary fields" instruction.

## API Routes

All routes live under `/api/school/campuses` and follow the exact
`requirePermission()` → `withTenantContext()` → `logAuditEvent()` pipeline
already used by `/api/school/settings`.

| Method | Route | Permission | Behavior |
|---|---|---|---|
| GET | `/api/school/campuses` | `SETTINGS_VIEW` | Lists all non-deleted campuses for the caller's active school; response includes `canEdit` (result of a `SETTINGS_UPDATE` check) so the UI can gate write actions. |
| POST | `/api/school/campuses` | `SETTINGS_UPDATE` | Creates a campus. Rejects Zod-invalid input (400); maps a Prisma `P2002` unique-constraint violation on `(schoolId, code)` to a friendly 409. Writes an `INSERT` audit log. |
| GET | `/api/school/campuses/[campusId]` | `SETTINGS_VIEW` | Returns a single campus scoped to the caller's school; 404 if it doesn't exist *or* belongs to another school (no existence leak). |
| PATCH | `/api/school/campuses/[campusId]` | `SETTINGS_UPDATE` | Partial update, including status toggling (`ACTIVE` ⇄ `INACTIVE`). Same 409-on-duplicate-code handling. Writes an `UPDATE` audit log with before/after state. |

**No DELETE route was added.** `Campus` has `onDelete: Restrict` on its School
relation and is referenced by `Section`, `Classroom`, `Enrollment`, `Teacher`,
`Expense`, `BiometricDevice`, `UserRole`, `SchoolAddress`, and
`AdmissionApplication`. Destructive deletion would either fail at the DB level
once any of those exist, or silently orphan/lose historical linkage. Per the
phase brief ("prefer disabling/deactivating... when historical records may
depend on it"), deactivation is done via `PATCH { status: "INACTIVE" }`
instead.

### Tenant & permission enforcement in every route

- `schoolId` is derived exclusively from `requirePermission()` → the
  cryptographically verified session token. It is never read from the request
  body, query string, or route params.
- Every DB operation runs inside `withTenantContext(schoolId, ...)`, which
  sets `app.current_school_id` for the transaction so PostgreSQL RLS enforces
  isolation as a second, independent layer beneath the application-level
  `schoolId` filters already used in every query/mutation.
- `POST`/`PATCH` payloads are parsed with `CampusCreateSchema` /
  `CampusUpdateSchema`, which have no `schoolId` field at all — a spoofed
  `schoolId` in the JSON body is structurally inert.
- `GET`/`PATCH` on `[campusId]` first `findFirst({ where: { id, schoolId } })`
  before acting, so a campus ID from another school resolves to "not found"
  rather than leaking existence or being modifiable.

## Permissions

No new permission codes were created. `SETTINGS_VIEW` and `SETTINGS_UPDATE`
were reused directly — the existing permission catalog
(`src/lib/authorization/permissions.ts:125`) already documents
`SETTINGS_VIEW` as covering "school branding, campus, and session settings",
confirming Campus was intended to live under this permission from the start.
The authorization engine (`authorize()` / `requirePermission()`) was not
modified.

## Business Rules Implemented

- A campus belongs to exactly one school (`schoolId` FK, immutable — never
  present in the update schema).
- Campus code is unique per school (`(schoolId, code)`); the same code is
  correctly permitted across different schools. Duplicate attempts return
  HTTP 409 with a Bangla message.
- Cross-school read/update of another school's campus is impossible, enforced
  independently at both the application layer (`schoolId` filters) and the
  database layer (RLS).
- Deactivating a campus (`status: INACTIVE`) is the supported path for
  removing it from active operational use; no destructive delete is exposed.
- Client-supplied `schoolId` cannot influence tenant context under any code
  path (see above).

No `isMainBranch`-uniqueness rule (e.g. "only one main branch per school") was
added, since the existing schema has no such constraint and the brief
explicitly said not to invent business rules beyond what the schema supports.

## UI

`/dashboard/settings/campuses` — Bangla-first page matching the visual and
interaction conventions of `/dashboard/settings/school` (same card/rounded-2xl
styling, emerald action color, Loader2 spinner, red/emerald alert banners).

States implemented:
- **Loading** — spinner with Bangla label while the initial `GET` resolves.
- **Permission-denied** — shown when the API returns 401/403 on load (locked
  icon, explanation that `SETTINGS_VIEW` is required).
- **Error** — red banner surfaced from any failed fetch/save.
- **Empty** — dashed-border placeholder with a "নতুন ক্যাম্পাস যোগ করুন" CTA when
  the school has zero campuses.
- **Read-only** — when the caller has `SETTINGS_VIEW` but not
  `SETTINGS_UPDATE`, add/edit/deactivate controls are hidden and an amber
  "Read Only" badge is shown instead (server independently re-enforces this
  even if a client were tampered with).
- **List** — responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
  showing name (Bn/En), code, status badge, main-branch badge, contact info,
  with "সম্পাদনা" (edit) and activate/deactivate actions per card.
- **Add/Edit** — modal form covering all editable fields (name Bn/En, code,
  status, phone, email, principal name, main-branch checkbox), with per-field
  Bangla error messages sourced from the API's Zod `details.fieldErrors`.

Navigation: added as a second entry in the dashboard settings nav
(`src/app/dashboard/layout.tsx`), and the breadcrumb's trailing label is now
computed from the active route instead of being hardcoded to the School
Settings page's title.

## Validation

`src/lib/validation/campus.ts` follows the exact structure and Bangla-message
convention of `src/lib/validation/school-settings.ts`:

- `code`: uppercased, `^[A-Z0-9][A-Z0-9-]{1,19}$` (2–20 chars).
- `nameEn` / `nameBn`: 2–255 chars, trimmed.
- `phone`: optional, `^[0-9+\s()-]{6,30}$`.
- `email`: optional, standard email format, ≤255 chars.
- `principalName`: optional, ≤150 chars.
- `isMainBranch`: optional boolean.
- `status`: optional, one of `ACTIVE` / `INACTIVE` / `ARCHIVED`.

`CampusUpdateSchema` is `CampusCreateSchema.partial()`, matching how
`SchoolSettingsUpdateSchema` composes its sub-schemas. Server-side validation
via `safeParse()` is authoritative; the UI's `required` attributes and
`toUpperCase()` transform are UX-only conveniences.

## Audit

Every mutation calls the existing `logAuditEvent()`
(`src/lib/audit/logger.ts`), which already redacts sensitive keys before
persisting:

- `POST` → `action: 'INSERT'`, `entity: 'Campus'`, `beforeState: null`,
  `afterState: <created row>`.
- `PATCH` → `action: 'UPDATE'`, `entity: 'Campus'`, `beforeState`/`afterState`
  captured from before/after the update, `changeSummary` listing the changed
  field names.

Actor identity (`actorUserId`, `actorName`), `schoolId`, IP, and user agent are
recorded exactly as the School Settings route does. No passwords, tokens, or
credentials are ever part of a Campus row, so no additional redaction logic
was needed beyond what `sanitizeState()` already provides.

## Tests

### New: `scripts/test-phase3-1-campus.mjs`

Runs against an isolated in-memory PGlite Postgres instance with all 10
canonical migrations applied — the same harness pattern as the other phase
test scripts. Covers all required scenarios:

| Test | Result |
|---|---|
| A. Authorized user can list campuses | ✓ PASS |
| B. User without `SETTINGS_VIEW` is rejected | ✓ PASS |
| C. Authorized user can create campus | ✓ PASS |
| D. User without `SETTINGS_UPDATE` cannot create/update | ✓ PASS |
| E. Authorized user can update campus | ✓ PASS |
| F. School A cannot read School B campus (RLS) | ✓ PASS |
| G. School A cannot update School B campus (RLS) | ✓ PASS |
| H. Spoofed `schoolId` cannot escape tenant context | ✓ PASS |
| I. Invalid Campus input is rejected (5 sub-cases) | ✓ PASS |
| J. Duplicate code rejected within a school; same code permitted across schools | ✓ PASS |
| K. Audit log generated for INSERT and UPDATE | ✓ PASS |

### Full Validation Run (all commands actually executed)

```
npx tsc --noEmit                              → 0 errors
npm run lint                                  → 0 errors, 0 warnings
npm run build                                 → compiled successfully, all routes registered
npx tsx scripts/test-database-integrity.mjs        → ALL PASSED (100%)
npx tsx scripts/test-phase2-security.mjs            → ALL PASSED (100%)
npx tsx scripts/test-phase2-1-security-hardening.mjs → ALL PASSED (100%)
npx tsx scripts/test-phase3-school-settings.mjs      → ALL PASSED (100%) — unmodified, still 9/9
npx tsx scripts/test-phase3-1-campus.mjs             → ALL PASSED (100%) — 11/11 (A–K)
```

No existing test file was edited, weakened, or skipped.

## Strict Stop Condition — Confirmed Respected

This phase implemented **only** Campus / Branch management: the reused
`Campus` model, its two API routes, its settings page, and its test suite.
Nothing from the excluded list (Academic Sessions, Classes, Sections, Shifts,
Groups, Subjects, Teachers, Teacher Assignments, Students, Guardians,
Attendance, Marks, Examinations, Fees, Payments, Discounts, Admissions,
WhatsApp, Biometric, Reports, Certificates, ID Cards, Public Website,
Subscription, or SuperAdmin features) was built, modified, or scaffolded.
Existing authentication, RBAC, tenant isolation, RLS, session, permission,
audit, and School Settings architecture were reused as-is and were not
rewritten.
