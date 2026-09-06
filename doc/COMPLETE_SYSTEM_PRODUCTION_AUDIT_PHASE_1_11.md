# COMPLETE SYSTEM PRODUCTION AUDIT — Phases 1–11
## EduSmart BD — Bangladesh Multi-Tenant School Management SaaS

**Audit date:** 2026-09-06
**Scope:** Phases 1 through 11.5 as implemented in the current working tree (branch `main`, uncommitted changes included). No new features implemented. Phase 12 **not** started.
**Method:** Direct inspection of Prisma schema, all 18 raw-SQL migrations, live Neon PostgreSQL database, 206 API routes, middleware, authorization engine, and six focused forensic investigations across the codebase, cross-checked against 16 prior self-authored phase audit documents in `doc/`. Live database queries were run directly against the project's own Neon instance (read-only except where noted); a JWT-forgery proof-of-concept was executed locally against the exact verification logic used by `middleware.ts`.

---

## 1. Executive Summary

Phases 1–11 are **not** one coherent, secure, production-ready system. They are a large, mostly well-structured codebase (120 Prisma models, 206 API routes, real Decimal-based financial math, genuinely strong HR/payroll and admission-approval concurrency control) sitting on top of **two independent, compounding failures of the database-level tenant-isolation layer**, plus a **live authentication-bypass condition** in the exact environment this audit was run against, plus a **fabricated-data violation on the flagship executive dashboard** — the single failure mode the audit brief named as most important to catch.

None of these are theoretical. Each was reproduced or directly observed:

- A forged JWT carrying `isSuperAdmin: true` for an arbitrary user ID was generated and successfully verified using the exact fallback secret hardcoded in `src/middleware.ts:5` and `src/lib/auth/session.ts:9` — because `AUTH_SECRET` is **not set** in this environment's `.env`.
- The database role in the live `DATABASE_URL` (`neondb_owner`) was queried directly and confirmed to have `rolbypassrls = true` — every Postgres Row-Level Security policy in the system is inert for every query the running application makes.
- A live schema-drift diff (`prisma migrate diff` against the actual Neon database) turned up a table (`school_subscriptions`) whose live column names do not match what Prisma Client generates SQL for at all — any query against it throws at runtime — plus a promotion-history table whose foreign-key columns are stored as free-text `varchar(50)` instead of the `UUID` the schema declares.
- The executive analytics dashboard (`src/lib/reports/overview-analytics.ts:259–287`) was read directly: five of six months of "collection trend," the entire "attendance trend," two of four admission-funnel stages, and the entire grade-distribution chart are hardcoded literals, rendered under a page header that says "Real-time executive KPIs."

Alongside these, the audit found a genuinely well-built HR/Payroll module (row-locked concurrency, self-approval prevention, immutable payslip snapshots), a correct NCTB grading implementation, a correct admission→student→enrollment atomic conversion flow, and a Library module with real database-level double-issue protection. The problem is not that the team can't build this correctly — several modules prove they can — it's that the security-critical connective tissue (the DB role actually used, the transaction-context plumbing, the deployment secret) was never wired all the way through, and the most customer-visible screen (the dashboard) ships fabricated numbers.

**Certification: C — NOT PRODUCTION READY.** See Section 41.

---

## 2. Audit Scope

Everything the brief listed was inspected to the depth practical within one audit pass: `prisma/schema.prisma` (4,307 lines, 120 models), all 18 files in `migrations/`, the live Neon PostgreSQL database itself, `src/middleware.ts`, `src/lib/auth/*`, `src/lib/authorization/*`, `src/lib/security/*`, `src/lib/tenant/*`, `src/lib/finance/*`, `src/lib/hr/*`, `src/lib/payroll/*`, `src/lib/academic/*`, `src/lib/communication/*`, `src/lib/transport/*`, `src/lib/library/*`, `src/lib/inventory/*`, `src/lib/reports/*`, all 206 files under `src/app/api/**/route.ts`, `tests/**` (7 Playwright specs), `scripts/**` (26 ad-hoc Node test scripts + migration runner + seed script), `playwright.config.ts` and the actual `playwright-results.json` from the most recent run, and all 16 prior self-authored audit documents under `doc/`.

Not exhaustively covered: the full Bangladesh-localization sweep (Section 28) beyond spot checks, a manual axe-core accessibility pass (the repo has none either — see Section 26), and byte-for-byte review of every one of the ~120 dashboard page components (a representative sample plus the flagship analytics page were read in full).

---

## 3. Actual Architecture Discovered

- **Stack:** Next.js 16 (webpack build, not Turbopack), React 19, Prisma 6.4 + `@prisma/client`, `pg` for raw queries, `jose` for JWT, `bcryptjs` for password hashing, Zod 4 for validation. No ORM-level migration tool is used — `prisma/schema.prisma` is hand-authored and kept in sync manually with 18 hand-written raw SQL files in `migrations/`, applied by a bespoke runner (`scripts/migrate-neon.mjs`) that has **no migration-ledger table**: it simply re-executes every `.sql` file in the directory, in filename order, every time it's run, with no tracking of what already ran. This is the direct root cause of the live schema drift documented in Section 6.
- **Database:** Live Neon PostgreSQL (`ep-fragrant-poetry-b3j38l7j-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb`), not PGlite, not a local Postgres. This is real, confirmed by direct connection.
- **Tenant model:** every tenant-owned table carries a `schoolId` (112 of 120 models directly; 3 more — `EmergencyContact`, `GradeRule`, `ApplicationDocument` — indirectly via a parent FK; `School`, `Permission`, `RolePermission`, `UserRole`, `SubscriptionPlan` are intentionally global/platform-level or covered by a parent's scope). Isolation is meant to be enforced at the database level via Postgres RLS policies keyed on a session GUC (`app.current_school_id`), set inside a Prisma `$transaction` by `withTenantContext()` in `src/lib/db.ts`.
- **Auth:** JWT (`jose`, HS256) issued at login, verified at the edge in `src/middleware.ts`, with spoofed `x-user-id`/`x-active-school-id`/`x-is-super-admin` request headers explicitly stripped before server-verified values are injected — a correctly-implemented defense against header-spoofing. Every downstream route additionally re-checks live `User.status`, live `UserRole`/`Permission` assignments, and (for teachers) live `TeacherAssignment` scope via `src/lib/authorization/engine.ts` and `scopes.ts` — the JWT is *not* trusted as sole authorization truth for permission decisions, which is architecturally correct. What defeats this design in the current environment is that the JWT's *signature* itself can be forged (Section 9).
- **No unit-test framework** is wired into `package.json` (no Jest/Vitest). Real, adversarial, security-focused test logic exists in 26 ad-hoc `scripts/test-phaseN-*.mjs` files running against a genuine (if disposable, in-memory) Postgres engine (`@electric-sql/pglite`) — but only one of them (`test-phase11-reporting.mjs`) is wired into `package.json` scripts, none run in CI (no `.github/workflows` exists), and none of them touch the actual configured `DATABASE_URL`.
- **Playwright** is configured well (5 real viewport projects covering all the brief's required breakpoints, an auto-starting `webServer`), but the only spec with a clean recorded run is the visual-screenshot spec, which asserts nothing.

---

## 4. Phase-by-Phase Audit

| Phase | Area | Verdict | Key evidence |
|---|---|---|---|
| 1 | DB + RLS Foundation | **FAIL (as deployed)** | RLS policies exist and are logically well-designed (113 tables protected, including 4 correctly-scoped indirect policies), but are structurally inert — see §7, §8. |
| 2 / 2.1 | Auth + RBAC + Hardening | **FAIL (as deployed)** | Design is sound (live status re-checks, scoped permissions, header-spoofing defense) but the signing secret has a hardcoded fallback that is live in this environment — see §9. |
| 3 / 3.1–3.5 | School setup, Campus, Sessions, Structure, Subjects, Teachers | **PASS (no defects found)** | All routes correctly scoped by `schoolId`; not independently stress-tested beyond static + tenant-scope review. |
| 4.0–4.3 | Student/Guardian/Enrollment architecture, CRUD, Promotion/Transfer | **CONDITIONAL** | Admission→Student→Enrollment conversion is atomic and correct; **Promotion is correct**; **Transfer and same-session Readmission-reactivation mutate the historical Enrollment row in place — P0, §12**. |
| 4.4 | Admission Management + Hardening | **PASS** | Advisory-lock-protected code generation, row-locked double-approval prevention, real guardian deduplication — all verified against actual code, not just docs. |
| 4.5 | Student/Parent Portal Identity | **CONDITIONAL** | Account linking and revocation are enforced live; one sibling route (`/api/student/reports`) breaks the pattern — see §13. |
| 5 | Academic Engine | **CONDITIONAL** | NCTB grading and GPA cap are byte-exact correct; publication gate to students/parents is solid; mark-approval/result-generation is missing a workflow-status gate (P1). |
| 6 | Finance & Billing | **CONDITIONAL** | Decimal arithmetic, immutability, and card-data hygiene are all correct; payment-allocation over-allocation guard is not actually row-locked despite a comment claiming it is (P1); admission fees are tracked through a second, weaker, unaudited path (P1). |
| 7 | HR + Payroll | **PASS** | The strongest module in the system: real `FOR UPDATE` locking, self-approval prevention, immutable finalized payslip snapshots, correct Decimal math throughout. |
| 8 | Attendance/Biometric + Communication | **CONDITIONAL** | Attendance dedup is DB-enforced; communication webhook HMAC is solid for SMS/WhatsApp but silently skipped for Email; **every SMS/Email/WhatsApp provider is a hardcoded Mock that always reports success — no real gateway is wired in anywhere (P1)**. |
| 9 | Transport | **FAIL** | Vehicle-capacity enforcement is not atomic (two unlocked queries) — a real overbooking race; self-reported doc's "pessimistic locking" claim is false; "real-time" language is used for what is manual/static boarding-event entry only. |
| 10 | Library + Inventory | **CONDITIONAL** | Library issue/return concurrency is genuinely DB-enforced (a real partial unique index) — the strongest tenant module besides HR; Inventory's stock-ledger concept is correct but the negative-stock guard is not race-proof; a Library-fine/Finance-payment sync gap exists. |
| 11 | Reporting + Analytics | **FAIL** | Fabricated data on the executive dashboard presented as real-time (P0, §16); a silent 50-row export-truncation bug on paginated reports; otherwise (tenant scoping, filter validation, export audit logging, N+1 avoidance) is solid. |
| 11.5 | Playwright UI/UX audit | **FAIL (as evidenced)** | The only clean recorded run (25/25) is the visual-screenshot spec, which has zero assertions; security/auth/nav specs were not part of that run and are shallow where they exist. |

---

## 5. Database Audit

`npx prisma validate` passes. `npx prisma generate` and `npx tsc --noEmit` both complete without error. `npm run build` (webpack, production) completes with exit code 0 and produces the expected static/dynamic route manifest for all 206 API routes and ~90 dashboard pages.

None of this catches what the live-database diff catches (Section 6), because Prisma Client is generated from `schema.prisma`, not validated against the actual database — a schema that *looks* internally consistent can still be silently divergent from the live table it will issue SQL against.

`prisma db pull`-style comparison was not used; instead `npx prisma migrate diff --from-url <live DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script` was run directly against the project's real Neon database. Results in Section 6.

---

## 6. Migration Audit — CRITICAL

**There is no migration ledger.** `scripts/migrate-neon.mjs` reads every `.sql` file in `migrations/` (18 files, `0001`…`0018`, correctly zero-padded and sequential) and re-executes all of them, every time, with no table tracking which migrations already succeeded. This means:

- If a migration file is edited *after* it has already been run once, that edit is **silently never applied** unless someone remembers to re-run the entire batch from a fresh database or manually apply just the delta.
- There is no rollback mechanism, no checksum verification, and no protection against two people editing the same migration file with divergent intent.

This is not a theoretical risk — it is the confirmed root cause of live, reproducible drift found by diffing the actual database against `prisma/schema.prisma`:

1. **`school_subscriptions`**: the live table has columns `startdate` / `enddate` (no underscore, `date` type). `prisma/schema.prisma` maps `SchoolSubscription.startDate`/`endDate` to `start_date`/`end_date` (`@map("start_date")` etc.). **Every Prisma query touching `SchoolSubscription` will generate SQL referencing a column that does not exist in the live database and will throw at runtime.** Confirmed via `information_schema.columns` query against the live DB (0 rows currently in the table, which is why this has gone unnoticed).
2. **`promotion_items`**: live columns `source_class_id` / `source_section_id` / `target_class_id` / `target_section_id` are all `character varying(50)`. `schema.prisma` declares `sourceClassId`/`sourceSectionId` as `String @db.Uuid` (i.e., intended to be real UUID foreign keys) while `targetClassId`/`targetSectionId` are plain `String` with no `@db.Uuid` and no `@relation` at all. **The promotion-history table currently has no referential integrity to real `Class`/`Section` rows on either side** — a class or section could be renamed or deleted with nothing catching a stale reference, and the source-side UUID conversion that the schema clearly intends was never migrated onto the live database.
3. **Enum drift**: the live `MessageType` enum is missing the value `TRANSPORT_ALERT`, and `PermissionModule` is missing `TRANSPORT` — both present in `schema.prisma`. Any code path that tries to write either value will throw a Postgres "invalid input value for enum" error at runtime.
4. **`route_stops.pickup_time`/`dropoff_time`** and **`transport_trips.scheduled_start_time`/`scheduled_end_time`**: live columns are native Postgres `time without time zone`; `schema.prisma` declares them as `String @db.VarChar(20)`. A real, unresolved type mismatch between what Prisma's query engine expects and what the database actually stores.

All four are new findings from this audit, not previously documented. They exist specifically in the newer phases (Transport, Subscriptions/platform billing) where the migration file was evidently edited or the schema was hand-adjusted after the initial `migrate-neon.mjs` run and never re-applied.

**Live PostgreSQL verification statement (per audit brief requirement):** this audit used a real, live Neon PostgreSQL database throughout — not PGlite. The 26 `scripts/test-phaseN-*.mjs` files, in contrast, run exclusively against a disposable in-memory PGlite instance rebuilt from the `migrations/*.sql` files each run; their passing status says nothing about the live database's actual current state, which this audit found to be drifted from those same migration files.

---

## 7. RLS Audit — CRITICAL

The RLS policy design itself is competent: 113 tables have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a `tenant_isolation_policy` keyed on `current_setting('app.current_school_id')`, including four correctly-written indirect policies for tables scoped through a parent (`grade_rules` via `grading_scales`, `emergency_contacts` via `students`, `application_documents` via `admission_applications`, `role_permissions` via `roles`).

**One table was never added to any RLS enable-list at all: `user_roles`** (created in `migrations/0002`, never referenced in `0010`, `0011`, or `0014`–`0018`). This is the table that determines which role a user holds and at which campus — it has zero database-level tenant boundary. The only protection is a consistently-applied application-layer `WHERE role: { schoolId: ... }` clause, confirmed present everywhere it's read (`authorization/engine.ts`, `auth/me`, `school/analytics/overview`, `school/reports`, `tenant/membership.ts`) — a real but unbacked compensating control.

That gap is almost moot next to the two findings below, because **RLS currently provides zero protection anywhere in this system, for two independent reasons:**

### 7.1 The connecting database role bypasses RLS entirely

Direct query against the live database:

```
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;
→ { rolname: 'neondb_owner', rolsuper: false, rolbypassrls: true }
```

The role in the actual `DATABASE_URL` this application connects with has `BYPASSRLS`. Per Postgres semantics, `FORCE ROW LEVEL SECURITY` does **not** override `BYPASSRLS` — a role with this attribute ignores every RLS policy on every table, regardless of `FORCE`, regardless of whether `withTenantContext` was used, regardless of anything in application code.

A separate, correctly-restricted role does exist and is fully provisioned: `edusmart_app_user` (`rolbypassrls: false`, `rolcanlogin: true`) — this is clearly the role the system was designed to run as (migration `0010` explicitly `GRANT`s privileges to it). **The application is simply not configured to connect as it.** This is a deployment/configuration gap, not a design gap — but it means the entire RLS layer is decorative in the current deployment.

### 7.2 Even where `withTenantContext` is called, most call sites don't use the transaction client it provides

`withTenantContext(schoolId, callback)` (`src/lib/db.ts:17–25`) opens a `prisma.$transaction`, sets the RLS session GUC on that transaction's connection, and passes the transaction client (`tx`) into the callback specifically so queries run on the same connection that has the GUC set. Grepping the codebase found **111 occurrences across 58 route files** — nearly all of Attendance-devices, Communication, Library, Transport, and Inventory — where the callback is written as `async () => { ... }`, **ignoring the `tx` parameter**, and issuing every real query through the module-level `prisma` singleton instead, which pulls a *different* pooled connection where the GUC was never set. Confirmed directly, e.g. `src/app/api/school/transport/student-assignments/route.ts:124–194`.

The practical effect: even if Finding 7.1 were fixed today (switching to `edusmart_app_user`), most of these 58 route files would get **zero rows back** on every query — not a leak, but a hard outage across five modules — because RLS would correctly see no `app.current_school_id` set on the connection actually being used. The two failures compound in the worst possible way: today, bypass means nothing is protected; fixing only the role would mean half the app breaks, because the transaction-context plumbing needs a separate, dedicated fix everywhere this pattern appears.

Every route audited manually filters by `schoolId` in its `WHERE` clause regardless — no route was found leaking cross-tenant data as a *result* of these two bugs today — but that is because every single one of those 58+ files independently got the manual filter right, which is exactly the "security boundary relies only on application code" pattern the audit brief explicitly asked to be flagged. One missed `schoolId` clause in a future edit, or a raw `$queryRaw`, or a bulk `updateMany`, has no database-level backstop at all right now.

---

## 8. Multi-Tenant Isolation Audit

Beyond the RLS findings above: 112/120 models carry `schoolId` directly, the remaining 8 are legitimately global or indirectly scoped (Section 3). A classification pass was run across all 59 API route files that don't reference `withTenantContext` at all (auth, public admissions, webhooks, self-service portals, and the 42 staff/finance/reports routes that scope manually):

- **Self-service portals (Employee, Parent, Student) correctly derive "which record is mine" from a server-verified link table** (`Employee.userId`, `StudentGuardian.guardianId → Guardian.userId`, `StudentUser.userId`) in every route checked **except one**: see Section 13.
- **Public/webhook routes** are correctly scoped by resolving the school from the URL slug before any query, with one webhook-specific gap noted in Section 8.1 below.
- **Staff/finance/report routes** (42 files) consistently hand-write `where: { schoolId }` — no missing clause was found in the files read, but as above, none of this has a database backstop today.

### 8.1 Live cross-tenant test

With only 2 schools and 1 student currently seeded in the live database, a full two-tenant attack simulation (create parallel records in School A/B, attempt cross-tenant GET/POST/PATCH/DELETE) was not runnable against realistic data volume. The `rolbypassrls=true` finding is independently dispositive regardless of data volume — it is a structural, not a data-dependent, finding — but a full black-box cross-tenant sweep with populated fixtures is a recommended follow-up once the role/connection fix lands.

`scripts/test-phase2-security.mjs` and `scripts/test-phase6-finance.mjs` (run against disposable PGlite, not the live DB) do assert real cross-tenant leak checks (`if (bCheck.rows.length !== 0) throw new Error('School B saw School A fee structures')`) and pass — but this proves the *application-layer* `WHERE schoolId` discipline is correct, which was never in doubt; it does not exercise the actual live-database RLS layer, which is the layer found broken.

---

## 9. Authentication Audit — CRITICAL

`src/middleware.ts:5` and `src/lib/auth/session.ts:9` both contain:

```ts
const AUTH_SECRET = process.env.AUTH_SECRET || 'edusmart-bd-dev-secret-key-at-least-32-chars-long!';
```

This project's own `.env` (the file actually loaded by this running application) contains only `DATABASE_URL` and `DIRECT_URL` — **`AUTH_SECRET` is not set.** This was verified directly (`grep -oE "^[A-Z_]+=" .env` → only those two keys). That means, in this exact environment, right now, every JWT the application signs and verifies uses the hardcoded literal string above.

**Proof-of-concept executed:**

```js
const forged = await new SignJWT({ userId: '<any-uuid>', activeSchoolId: '<any-school>', isSuperAdmin: true })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d')
  .sign(new TextEncoder().encode('edusmart-bd-dev-secret-key-at-least-32-chars-long!'));
// jwtVerify(forged, sameKey, { algorithms: ['HS256'] }) → succeeds, payload intact including isSuperAdmin: true
```

This reproduces exactly what `middleware.ts` does with an inbound cookie. **Anyone with read access to this source code (which, being a hardcoded literal, means anyone at all — it is not a secret) can forge a session token claiming SuperAdmin platform access, or claiming to be any known user ID, without any credentials.** `middleware.ts`'s `/platform` SuperAdmin gate is checked purely from the JWT claim at the edge, before any database lookup — a forged token passes that gate immediately. For non-platform API routes, the downstream `requireAuth`/`getAuthContext` layer does re-verify the user exists and is `ACTIVE` in the live database (a real, correctly-implemented defense — see Section 10), so the practical blast radius for *impersonating a specific user* depends on the attacker knowing that user's real UUID; but the edge-level SuperAdmin gate itself has no such backstop.

This is the single most severe finding in this audit — it defeats authentication for the whole platform, not just tenant isolation.

**Other authentication findings:**

- **Session revocation works correctly at the logic layer**: `verifySessionToken` checks both per-session and per-user revocation on every call, and `getAuthContext`/`authorize()` independently re-query live `User.status` on every request — a suspended or revoked user is blocked on their very next request even with an unexpired JWT. This is genuinely well-built and matches the audit brief's "live state is authoritative" requirement.
- **But `middleware.ts` itself never calls into this revocation check** — it only verifies JWT signature/expiry. Enforcement is not structural; it depends entirely on every route handler consistently calling `requireAuth`/`requirePermission` downstream, which all 206 routes reviewed do today, but nothing prevents a future route from skipping it.
- **The revocation store, and every throttle store (login, invitation, tracking, communication) are all designed as "Redis for production, memory for dev,"** switching on `process.env.REDIS_URL`. This project has **no `redis`/`ioredis` package installed at all**, and grepping the full codebase shows all six of these modules read `globalThis.__redisClient` — **which is never assigned anywhere in the codebase.** Even if `REDIS_URL` were set in a real deployment, none of these Redis code paths could ever activate; they would silently fall back to per-instance memory regardless. In any horizontally-scaled or serverless production deployment, this means: brute-force lockout, session revocation, invitation-replay protection, and webhook/tracking throttling are all **per-instance and reset on restart**, not distributed as the code's own naming and comments claim.
- Brute-force lockout logic itself (5 attempts → 15-minute lockout, keyed by identifier+IP) is correctly implemented within a single instance.
- Cookie is `HttpOnly`-style server-set (verified via cookie-based token extraction in middleware); `Secure`/`SameSite` attributes were not independently verified against the actual `Set-Cookie` header emission code in this pass — flagged as **not verified**, recommended follow-up.

---

## 10. RBAC Audit

`src/lib/authorization/engine.ts`'s `authorize()` and `getAuthContext()` both re-query the live database on every call — `User.status`, current `UserRole`/`Role`/`Permission` assignments — not cached from the JWT. This is architecturally correct per the brief's "JWT is not authorization truth" invariant. `scopes.ts`'s `ASSIGNED_CLASSES`/`ASSIGNED_SUBJECTS`/`OWN_STUDENTS` scopes perform a live `TeacherAssignment.findFirst` against `status: 'ACTIVE'` on every check — a revoked teacher assignment is denied on the very next request, not stale.

A full ROLE × MODULE × ACTION × SCOPE matrix enumeration across all `PermissionModule`/`PermissionAction`/`PermissionScope` enum values (18/13/6 values respectively in the schema) was not exhaustively hand-built as a table in this pass given the size of that cross-product; the sampling done (attendance, marks, finance, payroll, salary, payslip routes) found consistent `requirePermission(...)` gating before every sensitive operation, with no bypass found. This is flagged as **partially verified** — a full matrix enumeration is a recommended follow-up, ideally auto-generated from the `RolePermission` seed data plus a script that hits every route with every role.

`evaluateScope`'s `OWN_DATA` fallback (used when no direct link-table record exists) matches a `Student` by email/phone rather than a link table — the same weak-identity pattern flagged as a P0 in Section 13, here constrained at least to the caller's own `schoolId`.

---

## 11. Scope Authorization Audit

Object-level and scope authorization (assigned-class, assigned-subject, own-student, own-child, entire-school) were verified as **enforced server-side, not merely hidden in navigation**, for every route sampled across Finance, Payroll, Attendance, Marks, and the Student/Parent/Employee self-service portals (Section 8). The one navigation-only test in the existing Playwright suite (`role-navigation.spec.ts`) checks *only* that a menu item's text is hidden for a role — per the brief, this does **not** constitute an authorization test, and no corresponding direct-API test exists to independently confirm the backend blocks what the UI hides for every role/module combination. The manual route sampling in Section 8/13 substitutes for this to the extent it was feasible in one pass, but it is not exhaustive across all 206 routes.

---

## 12. Student/Enrollment Historical Integrity — CRITICAL

The core invariant (Student = permanent identity, Enrollment = session-specific context, historical records immutable) is **correctly implemented for Promotion and Withdrawal, and violated for Transfer and same-session Readmission-reactivation.**

- **Promotion** (`src/app/api/school/enrollments/promotion/route.ts`): correctly `tx.enrollment.create(...)`s a **new** Enrollment row for the new session/class/section and only ever updates the **source** enrollment's `status` field — never its class/section/roll. Row-locked (`FOR UPDATE`), idempotent, DB-unique-constrained. **Correct.**
- **Withdrawal**: only mutates `status`/`remarks`. **Correct.**
- **Transfer** (`src/app/api/school/enrollments/transfer/route.ts:130–138`): `tx.enrollment.update({ where: { id: current.id }, data: { classId, sectionId, rollNo, campusId, ... } })` — **directly overwrites the live Enrollment row's class/section/roll/campus in place.** Any `StudentAttendance`, `Mark`, `StudentExamResult`, `StudentFee`, or `Payment` row already pointing at that `enrollmentId` (all of which correctly store both `studentId` and `enrollmentId` — the schema-level design is right) will now silently read as belonging to the *new* section/class for events that occurred *before* the transfer, because the Enrollment row they join against has been changed underneath them. The route's own code comment claims this "preserves historical enrollment ID and dependent records intact" — true only of the row's *identity* (its primary key), not its *content*, which is the part that actually matters for historical accuracy.
- **Readmission** (`src/app/api/school/enrollments/readmission/route.ts:120–132`): when a fresh session is involved, correctly creates a new Enrollment. When re-admitting into a session where an inactive Enrollment already exists, it **reactivates that row in place** via `.update()`, overwriting class/section/roll/campus/group — the same pattern as Transfer, narrower in blast radius (same-session, previously-inactive row) but the same underlying defect.
- **Roll number / primary guardian concurrency**: DB-unique-constrained for roll numbers (`@@unique([schoolId, academicSessionId, classId, sectionId, rollNo])`); primary-guardian uniqueness relies on consistent application-layer row-locking rather than a DB partial-unique index — functionally closed today, but no defense-in-depth backstop.

**Documented self-contradiction found:** `doc/STUDENT_ARCHITECTURE_AUDIT.md` claims at one line that "historical enrollments are immutable snapshots and are NEVER overwritten," and at another line in the same document describes "mid-session section transfer: handled by updating the current enrollment's section_id and roll_no" — the document contradicts itself, and the code confirms the second (destructive) claim, not the first.

---

## 13. Admissions Audit

The Admission → Student → Guardian → Enrollment conversion (`src/app/api/school/admissions/[applicationId]/approve/route.ts`) is **the best-implemented critical workflow in the system**: a single transaction, a `SELECT ... FOR UPDATE` row lock on the application before checking for prior conversion (closing the concurrent-double-approval race), a `pg_advisory_xact_lock`-protected student-code generator with a deterministic fallback, and real guardian deduplication (by admin selection, then National ID, then phone+name match) rather than blind duplicate creation. Concurrent-approval and duplicate-conversion were traced through the code and are correctly guarded; this was not independently load-tested against the live database but the locking mechanism used is sound.

One weaker, parallel path exists outside this flow: **admission-application fees** are tracked via two flat, client-supplied fields on `AdmissionApplication` (`applicationFeePaid: Boolean`, `applicationFeeTrxId: String`) that are never linked to `Payment`/`StudentFee`/`Receipt` and are not verified server-side against any payment gateway — a school's admission-fee "paid" status is currently just whatever the submitting client claims. Flagged P1 in Section 16.

---

## 14. Parent/Student Portal Audit — CRITICAL (one route)

Every Parent-portal route (`/api/parent/children/[studentId]/*`, `/api/parent/me`, `/api/parent/reports`, `/api/parent/transport/*`, `/api/parent/library`) correctly derives "which children am I allowed to see" from a live `StudentGuardian` lookup keyed on the authenticated `userId` — verified present and enforced in all 11 files. Every Student-portal route except one derives "who am I" from the unique `StudentUser.userId` link.

**The one exception: `src/app/api/student/reports/route.ts:14–21`.**

```ts
const student = await prisma.student.findFirst({
  where: { OR: [{ email: context.user.email }, { phone: context.user.phone }], deletedAt: null },
});
```

No `schoolId` filter. No `StudentUser` link-table check — the only route in the entire student portal that doesn't use it. `Student.email`/`Student.phone` carry **no unique constraint anywhere in the schema** (confirmed: only `@@unique([id, schoolId])` and `@@unique([schoolId, studentCode])` exist on the model). Because `phone` in particular is a very plausible field to be duplicated, blank, or shared across placeholder records in real Bangladeshi school data entry — and because there is no tenant filter at all — a logged-in student whose registered phone or email happens to coincidentally match another student's record, **in any school on the platform**, would be served that other student's academic results, attendance percentage, and outstanding-fee balance through this endpoint. If the field is null/empty on both sides, Prisma's `findFirst` with `{ phone: null }` would match the first null-phone student in the entire database, regardless of school.

Sensitive-field exposure check: NID, birth-registration number, guardian NID, and medical/disability notes were checked against the response shapes of Student/Parent/Employee self-service and reporting routes sampled — none were found being returned in any of the JSON payloads read. This was not exhaustively checked against all 206 routes.

---

## 15. Academic Engine Audit

- **NCTB grading is byte-exact correct**: `src/lib/academic/grading.ts:19–27` implements 80–100=A+/5.00 down through 0–32.99=F/0.00 with no deviation from the specified brackets.
- **Optional 4th-subject bonus is correctly `max(0, GP−2)`**, and **final GPA is correctly capped at 5.00** (`Math.min(5.0, ...)`).
- **Attendance uniqueness is DB-enforced** via two partial unique indexes added in migration `0012` (correctly handling the whole-day-vs-period-based attendance NULL case that a naive single unique constraint would miss).
- **Publication gating to students/parents is solid**: both `/api/student/results` and `/api/parent/children/[studentId]/results` filter on `publishedAt: { not: null }` and `status: PUBLISHED` — unpublished results do not leak.
- **Gap before publication**: `marks/approve/route.ts` updates marks with no filter requiring they were first `SUBMITTED_BY_TEACHER` (an admin can "approve" a still-DRAFT mark), and `results/generate/route.ts` pulls **all** `Mark` rows for computing GPA/rank with **no workflow-status filter at all** — results can be computed from unapproved marks. This never reaches a student (the publish step is separately gated correctly), but it means the approval workflow itself is not enforced where the brief expects it to be. **P1.**
- Mark bounds (0–100, component-vs-max, total-vs-fullMarks) are validated both at the Zod layer and again at the business-logic layer.

---

## 16. Finance Audit

Money fields are `Decimal @db.Decimal(12,2)` throughout; calculation code (`src/lib/finance/*`) consistently uses `Prisma.Decimal` methods; `.toNumber()` is used only for JSON output/display, never fed back into further math. `Payment` and `PaymentAllocation` are genuinely separate models and concepts; a Payment can fund multiple invoices via multiple allocations, correctly. Refunds create a new, separate `Refund` record and only touch `Payment.status`/`advanceCreditAmount` — the original payment's core fields are never rewritten. No card number, CVV, PIN, or OTP field exists anywhere in the schema or code.

**Two concrete gaps:**

- **Payment allocation over-allocation guard is not actually row-locked.** `src/lib/finance/allocation.ts:70`'s own comment says "Lock the fee invoice row for update to prevent concurrent double-allocation," but the actual call beneath it is a plain `tx.studentFee.findFirst(...)`, not `SELECT ... FOR UPDATE`. Two concurrent allocation requests against the same payment or fee can both read stale due-amounts before either commits. Contrast: HR/Payroll (Section 17) does use real row locking for the equivalent problem, so the pattern is known in this codebase, just not applied here. **P1.**
- **Admission-application fees bypass the finance ledger entirely** (Section 13) — a second, unaudited, client-trusted payment-tracking mechanism. **P1.**

`doc/PHASE_6_FINANCE_BILLING_AUDIT.md` additionally claims "bulk fee generation uses transactions and advisory locks" — no `pg_advisory_lock` usage exists anywhere in `src/` (grep confirmed zero matches); the actual protection is a pre-check plus a DB unique constraint, which is adequate but is not what the document describes.

---

## 17. HR/Payroll Audit

This is the **strongest module in the system.** `SalaryAdvance` recovery cannot exceed outstanding balance or net pay (`Decimal.min` chaining, verified in `src/lib/payroll/calculator.ts:306–340`); leave self-approval is explicitly blocked by comparing the approver's `userId` against the requester's (`src/lib/hr/leave-engine.ts:74–78`); payroll generation and finalization both take real `SELECT ... FOR UPDATE` row locks and reject re-running against an already-finalized period; adjustment of a finalized/paid record is explicitly blocked (correction must go through a separate adjustment journal); historical payslips are protected via a stored `calculationSnapshot` JSON field populated at generation time, so later changes to `SalaryStructure` don't retroactively alter past payslips. All arithmetic is Decimal-based with `ROUND_HALF_UP` — correctly implemented, but see the terminology note below.

**Documentation defect, not code defect:** `doc/PHASE_6_FINANCE_BILLING_AUDIT.md:15` (and the equivalent payroll rounding description) calls `ROUND_HALF_UP` "Banker's rounding." Banker's rounding is round-half-to-even; `ROUND_HALF_UP` is round-half-away-from-zero. The code is correct and consistent; the label in the self-authored audit document is wrong. Per the audit brief's explicit instruction, this is called out directly.

One minor concurrency caveat: `SalaryAdvance` rows are not row-locked during recovery (only the `PayrollRecord`/`PayrollPeriod` is), leaving a narrow theoretical race if multiple payroll periods for the same employee were ever finalized concurrently — likely low real-world risk given normal payroll cadence.

---

## 18. Attendance/Hardware Audit

Student and Employee attendance are correctly modeled as separate tables (`StudentAttendance`, `EmployeeAttendance`). `RawAttendanceEvent` provides durable raw-event retention ahead of processing into attendance records; per the audit brief's instruction on terminology, this audit does **not** describe this as "zero data loss" — durable raw-event retention is the accurate description, and no stronger claim was found asserted in the code or its comments. Device/webhook validation and per-device tenant ownership were reviewed at a sampling level via the communication webhook path (Section 19) rather than a dedicated hardware-integration test, since no physical biometric/RFID hardware was available to this audit — **no hardware certification is claimed here**, consistent with the brief's instruction.

---

## 19. Communication Audit

There is genuinely **one canonical** communication architecture (`src/lib/communication/provider-abstraction.ts`, `template-engine.ts`, `campaign-engine.ts`) — no duplicate notification/template/campaign system was found. `DELIVERED` status is never set optimistically at send time (`SENT`/`QUEUED`/`FAILED` only); it is only updated via the provider-callback webhook, which is correct per the brief's requirement. HMAC signature verification with timing-safe comparison is correctly implemented for SMS and WhatsApp callbacks.

**Two real gaps:**

- The webhook route's `else` branch treats any provider without an explicit `verifyWebhookSignature` implementation — **including Email** — as `isSignatureValid = true`, i.e., **signature verification is silently skipped for Email delivery callbacks.** The webhook secret itself also falls back to a hardcoded literal (`'edusmart-webhook-secret-salt-2026'`) if `COMMUNICATION_WEBHOOK_SECRET` is unset — the same fail-open-default-secret anti-pattern found in Section 9. **P1.**
- **`CommunicationProviderRegistry`'s default SMS, Email, and WhatsApp providers are all hardcoded `Mock*` classes** (`src/lib/communication/provider-abstraction.ts:217–219`) that always report success and `getDeliveryStatus() → 'DELIVERED'` without contacting any real service. `setSmsProvider()`/`setEmailProvider()`/`setWhatsAppProvider()` (and their `registerXProvider` aliases) exist specifically to swap in a real gateway integration — **and are never called anywhere else in the codebase.** As shipped, this entire phase's core purpose (actually notifying parents/staff via SMS, email, or WhatsApp) is a complete no-op that reports false success. This is functionally the same category of problem as the fabricated-dashboard finding in Section 21: the system reports a real-world action succeeded when nothing happened. **P1, and arguably should be read alongside Section 21 as the same underlying discipline failure.**

---

## 20. Transport Audit

Models correctly reuse `Student`/`Enrollment`/`Employee` — no duplicate identity. Completed-trip immutability is correctly enforced (status transitions out of `COMPLETED` are blocked; `DELETE` on a completed trip is blocked). Two real defects:

- **Vehicle-capacity enforcement is not atomic.** `checkVehicleCapacity()` and the subsequent assignment `create()` run as two independent, unlocked calls against the module-level `prisma` client inside a `withTenantContext` callback that (per Section 7.2) never actually uses its `tx` parameter — there is no row lock and no DB constraint tying assignment count to `seatingCapacity`. Two concurrent requests can both pass the capacity check and both insert, overbooking the vehicle. `doc/PHASE_9_TRANSPORT_AUDIT.md` explicitly claims this is "enforced ... with pessimistic locking/concurrency checks" inside a class/function (`AssignmentEngine.assignStudentToTransport`) that **does not exist anywhere in the codebase** under that name — a materially false "VERIFIED" claim in the self-authored document. **P0/P1 (functional race, not a security leak).**
- **No GPS or live-location capability exists anywhere** — only manually-entered `TransportBoardingEvent` records and static `RouteStop` coordinates. The self-authored doc's repeated "real-time" framing for trip/boarding operations overstates what is actually a manual-entry system. Per the audit brief's instruction on terminology, this should not be marketed or documented as GPS tracking.

---

## 21. Library Audit

The strongest of the operational modules besides HR. `LibraryLoan` correctly references `LibraryBookCopy` (the physical item), not the title-level `LibraryBook`. Double-issue of the same copy is protected by a **real database-level partial unique index** (`CREATE UNIQUE INDEX uq_active_copy_loan ON library_loans (copy_id) WHERE status IN ('ISSUED','OVERDUE')`, migration `0017`) — this is genuine, DB-enforced concurrency protection, not just an application-layer check, and it is the one place in the newer-phase modules where the "the app-layer check is the only real boundary" pattern does *not* apply. (Note: this partial index is not reflected back into `prisma/schema.prisma`, which only shows a plain non-unique index — a schema/migration drift that doesn't affect live behavior since the migration is authoritative for the actual database, but should be reconciled.)

Fines correctly reuse the Finance `Payment`/`StudentFee` system rather than building a second payment mechanism when auto-billed — but the sync is one-directional: no code path was found updating `LibraryFine.status`/`paidAmount` when the linked `StudentFee` is later settled through Finance, so a fully-paid fine can show as permanently `UNPAID` in the Library UI. **P2.**

---

## 22. Inventory/Asset Audit

Stock is correctly derived from an append-only `StockMovement` ledger (`PURCHASE_IN`, `ISSUE_OUT`, etc.) rather than a freely-editable on-hand quantity field — the architecturally correct approach. The outbound-movement check does run inside a `prisma.$transaction`, which is better than the Transport pattern, but it operates at default `READ COMMITTED` isolation with no row locking (`SELECT ... FOR UPDATE`) and no DB-level `CHECK`/trigger guaranteeing the ledger's aggregate balance never goes negative. Two concurrent `ISSUE_OUT` requests against the last unit of stock can both read the same balance before either commits and both succeed, producing negative effective stock. **P1**, same category of gap as the Finance allocation and Transport capacity findings — a recurring pattern of "real transactional intent, missing the row lock that would make it actually race-proof," everywhere except Library and Payroll.

---

## 23. Reporting/Analytics Audit — CRITICAL

This is the section the audit brief named as needing the most scrutiny, and it is where the single most serious non-authentication finding was made.

### 23.1 Fabricated data presented as real-time

`src/lib/reports/overview-analytics.ts:259–287`, the function backing the school-wide executive dashboard (`/api/school/analytics/overview`, rendered at `src/app/dashboard/analytics/page.tsx`):

- `monthlyCollection`: 5 of 6 months are hardcoded literals (`450000, 520000, 490000, 580000, 620000`); the 6th falls back to a hardcoded `650000` if the real sum happens to be falsy.
- `attendanceTrend`: **100% hardcoded** — five fixed `{date, rate}` pairs, zero query against `StudentAttendance`, despite a correct, working live equivalent already existing elsewhere in the same codebase (`executeMonthlyAttendanceReport`).
- `admissionFunnel`: "Applications" and "Enrolled" are real counts; "Under Review" and "Approved" are fabricated as `Math.round(appCount * 0.75)` and `* 0.55)` — arbitrary constants unrelated to the actual `AdmissionApplication.status` distribution.
- `academicDistribution`: **100% hardcoded** grade counts, no query against `Mark`/`StudentExamResult` at all.
- The dashboard page itself (`src/app/dashboard/analytics/page.tsx:83–84`) labels this "Real-time executive KPIs... রিয়েল-টাইম প্রাতিষ্ঠানিক পারফরম্যান্স ইন্ডিকেটর" and additionally renders a hardcoded `+12.4% MoM` badge with no backing calculation at all (line 160).

This is exactly the failure mode the audit brief named first and most emphatically: illustrative data presented as real school data, with no `isIllustrative` flag, no UI disclaimer, and an explicit "real-time" claim contradicting the actual implementation. `doc/PHASE_11_REPORTING_ANALYTICS_AUDIT.md` describes this as "PARTIAL... partially illustrative... documented TODO" — that framing materially understates what was found: `attendanceTrend` and `academicDistribution` have no live component whatsoever, and the fabricated `admissionFunnel` stages and the fabricated UI badge are not mentioned in the self-authored document at all.

### 23.2 Other reporting findings

- Report queries compute directly from canonical tables at request time (confirmed for finance, attendance, and student reports) — no separately-drifting aggregate table exists.
- The report cache (`src/lib/reports/report-cache.ts`) is correctly an in-memory `Map`, and is correctly *never* described in code as distributed — but its `invalidate()` method is defined and **never called anywhere**, so cache freshness relies entirely on a 60-second TTL with no active invalidation on write. Per the brief's requirement, this single-instance limitation is now explicitly documented here. **P2.**
- Export authorization and audit logging are solid: `exportReport()` re-runs the full permission-check pipeline before generating, and every export writes a `ReportExportLog` row.
- **A real, silent data-integrity bug**: the export UI (`src/app/dashboard/reports/page.tsx`) builds its export request without ever setting a `limit` parameter, and paginated report queries default to `limit: 50` when absent — **exporting a paginated report (e.g., a full student directory) silently truncates to the first 50 rows with no warning that the file is incomplete.** Several *non*-paginated aggregation-style reports have the opposite problem: no `take` limit at all on their underlying `findMany` calls, an unbounded-query risk for large schools. **P1.**
- Tenant/scope filtering, `generatedAt` honesty (for the report-engine-backed routes), and Zod-based filter validation were all verified correct. Legacy parallel routes (finance dashboard/collection, employee/student/parent self-service reports) omit `generatedAt` entirely — an inconsistency, not a dishonesty.

---

## 24. API Audit

206 route files enumerated. Authentication (`requireAuth`) and permission (`requirePermission`) gating were found consistently applied across every sampled route (Finance, Payroll, Attendance, Marks, Admissions, Enrollments, Library, Transport, Inventory, Reports, and all three self-service portals). Zod validation is used consistently for request bodies in the routes read. IDOR protection is correct everywhere except the one route in Section 14. Concurrency safety varies significantly by module — see the per-phase sections above for exactly which routes have real row-locking versus which have only an unlocked check-then-write. A full route-by-route status-code and error-handling audit across all 206 files was not performed as an exhaustive checklist in this pass; the sampling covered the highest-risk modules (money, identity, authorization) in full and the remainder (school setup, academic structure) at a lighter tenant-scoping-only pass.

---

## 25. Frontend Audit

The production build completes successfully (`npm run build`, webpack, exit code 0) and generates the full expected route manifest — 206 API routes and roughly 90 dashboard pages, correctly split between static and server-rendered. `npx eslint src` (correctly scoped) returns **0 errors, 14 warnings**, all trivial unused-variable warnings in `src/app/dashboard/finance/page.tsx` and two `src/lib/finance/*.ts` files. Note: running ESLint against the repository root without scoping to `src/` produces **1,132 false "errors"**, because `eslint.config.mjs`'s ignore list does not exclude `playwright-report/`, `test-results/`, or `playwright-screenshots/` — all of the actual errors are inside vendored Playwright trace-viewer JS bundles, not first-party code. This is a real tooling-configuration gap (anyone running `eslint .` naively, including a future CI job, would see a wall of irrelevant errors and could either be alarmed unnecessarily or, worse, get desensitized to a genuinely broken lint run). **P3 — fix the ignore list.**

The application was not interactively driven through a browser in this audit pass (no live dev server was kept running against real data long enough for manual UI walkthroughs); the Playwright visual-screenshot spec's clean run confirms pages render without crashing across 5 viewports, which is a real, if narrow, signal. Bangla/English toggling, form validation UX, and empty/error/loading states were spot-checked in the files read (the analytics page, several finance and library pages) and appeared present and reasonably consistent, but a full page-by-page walkthrough was not completed.

---

## 26. Playwright Audit — CRITICAL

Exact numbers, read directly from `playwright-results.json`:

```json
{"startTime":"2026-09-06T05:17:56.774Z","duration":70986.015,"expected":25,"skipped":0,"unexpected":0,"flaky":0}
```

**25 run, 25 passed, 0 failed, 0 skipped, 0 flaky.** But `d.suites` contains exactly **one** suite: `tests/visual/critical-pages.spec.ts` (5 tests × 5 viewport projects = 25). **The other 6 spec files — accessibility, auth/login, role-navigation, responsive/viewports, security/authorization, security/tenant-isolation — were not part of this recorded run at all.** The "25/25 passed" figure that would naturally be cited as evidence of a healthy test suite is, in fact, evidence only that five pages don't crash when screenshotted. The visual spec itself makes **zero pixel-diff or content assertions** — it can only fail if a page throws before the screenshot call.

Of the specs that do exist to cover security ground:

- `tests/security/tenant-isolation.spec.ts` makes exactly one genuine cross-tenant HTTP call (a `switch-school` attempt, correctly asserting 403) and one non-adversarial check (SuperAdmin can see multiple schools, which is expected behavior, not a security test). It never attempts to fetch a specific School-B business record as a School-A user — and currently *can't*, because the E2E seed data (`scripts/seed-e2e.mjs`) gives School B a single admin user and zero students/teachers/invoices to even target.
- `tests/security/authorization.spec.ts`'s three tests all check *unauthenticated* access (401/redirect behavior) — none logs in as a low-privileged role and attempts a forbidden API call against a higher-privilege resource, which is the actual authorization-bypass pattern the brief is concerned about.
- `tests/navigation/role-navigation.spec.ts` checks only that a sidebar menu item's text is hidden per role — explicitly the pattern the brief says does **not** count as an authorization test.

**Honest summary requested by the brief:** the current automated test suite, as evidenced by its one clean recorded run, would **not** catch a cross-tenant data leak or an authorization bypass introduced tomorrow. The suite that *would* catch such things — 26 `scripts/test-phaseN-*.mjs` files running against a genuine (if disposable) Postgres engine, several with real adversarial assertions (`throw new Error('FAIL: Cross-tenant data was returned!')`, brute-force lockout checks, MIME-spoofing rejection tests) — is not wired into `package.json` (only `test:phase11` is), has no CI, and does not exercise the actual configured `DATABASE_URL` where this audit's most severe findings live.

Viewport coverage in `playwright.config.ts` is genuinely good — all 5 of the brief's requested breakpoints (1440×900, 1280×800, 768×1024, 390×844, 375×812) are configured — but only Chromium is exercised; no Firefox/WebKit coverage exists.

---

## 27. Accessibility Audit

`tests/accessibility/a11y.spec.ts` performs real (not fabricated) DOM checks — single-`<h1>`, label-for association, landmark presence, Escape-key drawer dismissal — but is a narrow manual smoke check, not the WCAG 2.2 audit its own `describe` block title claims; no `axe-core` or equivalent automated accessibility scanning tool is used anywhere in the repo. **Not independently deep-audited beyond confirming this spec's actual scope** — a real axe-core pass across the dashboard is a recommended follow-up rather than something this audit can certify either way today.

---

## 28. Responsive Audit

`playwright.config.ts` configures all 5 required/recommended viewport breakpoints correctly. `tests/responsive/viewports.spec.ts` checks for horizontal-overflow (`scrollWidth > innerWidth`) on 2 pages and one mobile-drawer interaction — real but narrow assertions, not a full responsive-regression suite. The visual-screenshot spec captures all 5 critical pages at all 5 viewports without crashing, which is a real (if weak) signal that nothing is catastrophically broken at any configured breakpoint.

---

## 29. Security Threat Model — CRITICAL

Per the brief's list of attacks to attempt:

| Attack | Result |
|---|---|
| JWT forgery via hardcoded fallback secret | **Succeeds** — live PoC executed, Section 9. |
| Cross-tenant access via RLS bypass | **Succeeds structurally** — `rolbypassrls=true` confirmed live, Section 7. |
| Cross-tenant access via missing tx-context | **Would succeed** under a corrected DB role, until the 58-file `tx` pattern is fixed, Section 7.2. |
| IDOR — horizontal privilege escalation | **Succeeds** on `/api/student/reports` (Section 14); not found elsewhere in the routes sampled. |
| Vertical privilege escalation via edge SuperAdmin gate | **Succeeds** in combination with the JWT-forgery finding (Section 9). |
| Header spoofing (`x-user-id`, etc.) | **Fails to compromise the system** — middleware explicitly strips and re-injects these; correctly defended. |
| Query/body/route-ID manipulation | Not found to succeed in any route sampled (schoolId consistently re-derived server-side); not exhaustively tested across all 206 routes. |
| Duplicate webhook / webhook replay | Correctly idempotent for SMS/WhatsApp; **signature check is bypassed for Email** (Section 19). |
| Duplicate payment | No idempotency key exists on payment creation (Section 16) — a retried/double-submitted request is not currently guaranteed to be deduplicated, though invoice-level uniqueness limits some of the blast radius. |
| Duplicate enrollment | Correctly prevented via DB unique constraint + row locking. |
| Stale/revoked session reuse | Correctly blocked by live-status re-checks at the authorization-engine layer (Section 9) — but only because every route handler currently calls into that layer; not structurally guaranteed for future routes. |

---

## 30. Concurrency Audit

| Operation | Protection found | Verdict |
|---|---|---|
| Current academic session | Not specifically targeted in this pass | Not verified |
| Student code generation | `pg_advisory_xact_lock` + DB unique constraint | OK |
| Admission approval | Row lock (`FOR UPDATE`) on application | OK |
| Enrollment creation / promotion | Row lock + DB unique constraint | OK |
| Roll number | DB unique constraint | OK |
| Guardian primary assignment | App-layer row lock, no DB backstop | OK (no defense-in-depth) |
| Attendance creation | DB partial unique indexes | OK |
| Marks update | No workflow-status gate before generation (Section 15) | CONCERN |
| Payment allocation | `findFirst`, **not** actually row-locked despite comment | **CONCERN — real race** |
| Payroll generation/finalization | Real `FOR UPDATE` row locks | OK |
| Stock movement (Inventory) | Transactional but no row lock | **CONCERN — real race** |
| Vehicle capacity (Transport) | Two unlocked queries, no transaction context in effect | **FAIL — real race** |
| Library issue | DB partial unique index | OK — strongest in the system |
| Account invitation acceptance | No row lock, but backstopped by a separate unique constraint | OK (minor gap) |
| Webhook idempotency | Correct for SMS/WhatsApp | OK; Email unverified (Section 19) |

---

## 31. Audit Log Audit

`AuditLog` writes are wrapped so a logging failure never crashes the triggering request (`logAuditEvent` catches and logs to console instead). A redaction function (`sanitizeState` in `src/lib/audit/logger.ts`) strips `password`, `token`, `secret`, `credentials`, and `tracking_code`/`tracking_pin` keys before persisting `beforeState`/`afterState` — but this scan is **shallow, top-level-only** (`Object.keys(sanitized)`), unlike the better, genuinely recursive `sanitizeLogPayload` that already exists in `src/lib/security/credential-encryption.ts` and correctly walks nested objects. If any caller ever passes a nested object (e.g., `{ user: { password: '...' } }`) into `beforeState`/`afterState`, the nested secret would **not** be redacted by the audit logger's version. Recommend switching `audit/logger.ts` to reuse the existing recursive sanitizer rather than maintaining two inconsistent implementations. **P2.**

---

## 32. Privacy Audit

NID, birth-registration number, guardian NID, and medical/disability notes were checked against every response payload read in this pass (Student, Parent, Employee self-service, and Reports routes) and were not found being returned anywhere sampled. This was not exhaustively verified against all 206 routes' response shapes — recommended as a dedicated follow-up given the volume. No plaintext payment-card data, CVV, PIN, or OTP storage exists anywhere in the schema (Section 16). Device/API credentials are correctly AES-256-GCM encrypted at rest (`src/lib/security/credential-encryption.ts`) — but that same file's key-derivation function has the identical hardcoded-fallback-secret pattern as `AUTH_SECRET` (Section 9): if neither `DEVICE_CREDENTIAL_SECRET` nor `NEXTAUTH_SECRET` is set, it derives the encryption key from a hardcoded literal string, which would make the "encryption" of biometric-device credentials provide no real confidentiality in that configuration. **P1 — same root cause as Section 9, different surface.**

---

## 33. Performance Audit

No N+1 query pattern was found in the routes specifically checked (the analytics overview, the finance dashboard, and the parent-reports "per linked child" loop, the last of which is technically N+1-shaped but bounded by a guardian's small number of children — low real-world impact). The confirmed **unbounded `findMany` calls with no `take` limit** on several non-paginated aggregation reports (Section 23) is a real, if narrow, large-school performance risk. No systemic N+1 sweep across all 206 routes was performed — this audit does not claim the rest of the codebase is free of the pattern, only that it was not found in the routes examined.

---

## 34. Code Quality Audit

Grepped across `src/`, `scripts/`, and `tests/` (excluding `node_modules`, `.next`, `playwright-report`, `test-results`): **0** `TODO`/`FIXME` markers, **0** stray `console.log` calls in `src/`, **0** commented-out dead-code blocks (6 comment-like regex hits were manually reviewed and are all legitimate explanatory comments), **0** `hack`/`HACK` markers. The one `mock` hit in `src/` (`MockSmsProvider`/`MockEmailProvider`/`MockWhatsAppProvider`) is not leftover test scaffolding — it is wired as the actual, only, hardcoded default in the production provider registry (Section 19), which is a more serious finding than a stray debug artifact would have been. The hardcoded-fallback-secret pattern (`AUTH_SECRET`, `DEVICE_CREDENTIAL_SECRET`, `COMMUNICATION_WEBHOOK_SECRET`) recurs three times across the codebase and should be treated as a single systemic issue with one fix (fail closed / crash at startup if a required secret is unset, rather than silently falling back to a literal).

---

## 35. Test Quality Audit

Covered in depth in Section 26. Summary: the tests that exist and pass reliably (visual screenshots) prove the least; the tests that would prove the most (the 26 `scripts/test-phaseN-*.mjs` adversarial PGlite scripts) are not wired into any automated pipeline and don't touch the live database where the drift and RLS findings live. `role-navigation.spec.ts` is a clean example of the exact anti-pattern the brief warned about (hidden-nav-link-as-security-test).

---

## 36. Regression Matrix

| Phase | Tests found | Wired into CI/package.json | Passed (as recorded) | Notes |
|---|---|---|---|---|
| 1 (DB/RLS) | `scripts/test-database-integrity.mjs`, embedded in phase scripts | No | Not independently re-run against live DB in this audit | PGlite-only historically |
| 2 / 2.1 | `scripts/test-phase2-security.mjs`, `test-phase2-1-security-hardening.mjs` | No | Not re-run in this audit (read for logic only) | Real adversarial assertions present |
| 3.x | `scripts/test-phase3-*.mjs` (5 files) | No | Not re-run | Not deeply audited this pass |
| 4.0–4.4 | `scripts/test-phase4-*.mjs` (6 files) | No | Not re-run | Logic verified by direct code reading instead |
| 4.5 | `scripts/test-phase4-5-accounts.mjs` | No | Not re-run | — |
| 5 | `scripts/test-phase5-academics.mjs` | No | Not re-run | — |
| 6 | `scripts/test-phase6-finance.mjs` | No | Not re-run | Contains real cross-tenant leak assertion |
| 7 | `scripts/test-phase7-hr-payroll.mjs` | No | Not re-run | — |
| 8 | `scripts/test-phase8-attendance-communication.mjs` | No | Not re-run | — |
| 9 | `scripts/test-phase9-transport.mjs` | No | Not re-run | — |
| 10 | `scripts/test-phase10-library-inventory.mjs` | No | Not re-run | — |
| 11 | `scripts/test-phase11-reporting.mjs` | **Yes** (`npm run test:phase11`) | Not re-run in this audit | Only script wired into `package.json` |
| Playwright (11.5) | 7 spec files, 29 tests defined | Yes (`playwright.config.ts`) | **25/25 passed — but only the 5×5 visual spec ran**; the other 24 tests across 6 files were not part of the recorded run | See Section 26 |

**This audit did not re-execute the 26 ad-hoc `.mjs` scripts against a live environment** (they are throwaway-PGlite by design and would not have added live-database evidence beyond what direct SQL querying already provided); their logic was read and is summarized as evidence of *intended* coverage, not re-verified pass/fail counts. No historical test-count claims from prior phase documents were taken at face value — where a prior document's numeric claim could not be independently reproduced, it is not repeated here as fact.

---

## 37. Findings (Consolidated, Severity-Ranked)

**P0 — CRITICAL**

1. Live authentication bypass: `AUTH_SECRET` unset in `.env`; hardcoded fallback JWT secret in `middleware.ts`/`session.ts` allows forging any session, including SuperAdmin — demonstrated via PoC. (§9)
2. Postgres RLS is entirely bypassed for every query: the connecting DB role (`neondb_owner`) has `rolbypassrls=true`; the correctly-restricted `edusmart_app_user` role exists but is unused. (§7.1)
3. `withTenantContext`'s transaction client (`tx`) is ignored in 58 route files (Attendance-devices, Communication, Library, Transport, Inventory) — even a corrected DB role would not restore RLS enforcement there without a second, separate fix. (§7.2)
4. Cross-tenant/cross-student IDOR in `/api/student/reports`: no `schoolId` filter, matches by non-unique email/phone instead of the `StudentUser` link table used everywhere else. (§14)
5. Enrollment historical-integrity violation: Transfer (and same-session Readmission-reactivation) mutate the live Enrollment row's class/section/roll in place instead of creating a new Enrollment, corrupting the historical context of any attendance/marks/fee record already linked to it. (§12)
6. Fabricated data on the executive analytics dashboard, presented under a "Real-time" label: hardcoded collection-trend months, 100%-hardcoded attendance trend and grade distribution, fabricated admission-funnel stages, fabricated UI growth badge. (§23.1)
7. Live schema drift between `prisma/schema.prisma` and the actual Neon database, caused by a migration runner with no ledger: `school_subscriptions` columns don't match at all (runtime SQL errors on any query), `promotion_items` foreign-key columns are untyped `varchar(50)` instead of `UUID` (no referential integrity for promotion history), two enum values missing live. (§6)

**P1 — HIGH**

8. Every "Redis for production" security store (session revocation, login throttle, invitation throttle, tracking throttle, communication throttle) reads a `globalThis.__redisClient` that is never set anywhere in the codebase (no Redis package is even installed) — all of these degrade to per-instance memory regardless of `REDIS_URL`, breaking under any multi-instance/serverless deployment. (§9)
9. `user_roles` (the RBAC assignment table) has no RLS policy at all — sole protection is consistent but unbacked application-layer filtering. (§7)
10. Communication module ships with hardcoded Mock SMS/Email/WhatsApp providers as the only providers ever wired in — no real gateway integration exists; every "sent" notification is fake and reports success. (§19)
11. Vehicle-capacity check (Transport) is non-atomic — a real overbooking race; self-reported doc's "pessimistic locking" claim describes a function that does not exist in the codebase. (§20)
12. Payment-allocation over-allocation guard is not row-locked despite a comment claiming it is — a real TOCTOU race; Inventory stock-issue has the equivalent gap. (§16, §22)
13. Admission-application fees tracked via a client-trusted, unaudited parallel mechanism entirely outside the Finance ledger. (§13, §16)
14. Email webhook callbacks skip signature verification entirely; webhook secret has the same hardcoded-fallback-secret pattern as `AUTH_SECRET`. (§19)
15. `DEVICE_CREDENTIAL_SECRET` encryption-key derivation has the same hardcoded-fallback pattern as `AUTH_SECRET` — device/biometric credential encryption could be trivially reversible in a misconfigured deployment. (§32)
16. Recorded Playwright evidence (25/25 passed) covers only the assertion-free visual-screenshot spec; the security/auth/tenant-isolation/navigation specs were not part of that run and are shallow where they exist — the suite would not catch a cross-tenant leak or authz bypass today. (§26)
17. Marks can be approved/results generated without a workflow-status gate requiring prior teacher submission (publication gate to students/parents remains solid). (§15)
18. Paginated report exports silently truncate to 50 rows via a missing `limit` parameter in the export UI; several non-paginated reports have no `take` limit at all. (§23.2)
19. Migration process has no ledger/idempotency guarantee — root cause of Finding 7 and a standing risk for every future migration. (§6)

**P2 — MEDIUM**

20. Audit-log redaction (`audit/logger.ts`) is shallow/non-recursive, unlike the better recursive sanitizer that already exists elsewhere in the codebase. (§31)
21. `LibraryFine` status/paidAmount never syncs when the linked `StudentFee` is settled through Finance. (§21)
22. No DB-level partial-unique backstop for "one primary guardian per student" (functionally closed today via app-layer locking only). (§12)
23. In-memory report cache has no active invalidation, relying solely on a 60-second TTL. (§23.2)
24. `/api/employee/reports` omits a `schoolId` filter on its initial employee lookup (low risk, self-service scope only). (§8)

**P3 — LOW**

25. ESLint ignore list doesn't exclude `playwright-report/`/`test-results/`, producing 1,132 false errors if run unscoped at the repo root. (§25)
26. Multiple self-authored phase audit documents contain overstated or factually incorrect claims (banker's-rounding mislabel, Transport's nonexistent "AssignmentEngine," a self-contradicting historical-immutability claim, an understated fabricated-data disclosure) — a recurring pattern of self-certification exceeding what the code supports. (throughout)
27. No cross-browser Playwright coverage (Chromium only). (§26)
28. `library_book_copies`' real partial-unique index isn't mirrored back into `prisma/schema.prisma` (cosmetic; the migration is authoritative). (§21)

---

## 38. Fixes Applied

**None.** Per the audit brief's explicit instruction ("DO NOT START PHASE 12... perform a complete production-grade audit"), and given the nature and number of P0 findings — several of which require an infrastructure/deployment decision (which DB role to connect as, which secret-management approach to adopt) rather than a pure code change — no fixes were applied during this pass. Applying point-fixes to a subset of P0s without the user's explicit go-ahead on remediation scope and order risked either an incomplete fix (e.g., patching the `tx`-context bug in 58 files without also switching the DB role would trade a silent security gap for a silent outage) or exceeding the audit's own mandate to investigate before changing. This is a deliberate choice, not an oversight — see Section 39/41 for the recommended remediation order.

---

## 39. Remaining Risks

Every P0 and P1 in Section 37 remains open. In addition: no full two-tenant black-box penetration sweep with realistic data volume was performed (only 1 student and 2 mostly-empty schools exist in the live database today); no full ROLE × MODULE × ACTION × SCOPE matrix was mechanically enumerated; no axe-core accessibility scan was run; Secure/SameSite cookie attributes were not independently re-verified against the actual `Set-Cookie` emission code; a full N+1 sweep across all 206 routes was not performed.

---

## 40. Known Limitations

This audit used a real, live Neon PostgreSQL database (not PGlite) for every database-state claim in Sections 6, 7, and 8 — these are direct-query-verified facts, not inferred from documentation or from the disposable PGlite test scripts. Where this audit could not fully trace a code path (noted inline throughout, e.g. Section 10's partial RBAC-matrix verification, Section 27's accessibility scope), it says so explicitly rather than extrapolating. Six parallel forensic investigations were used to cover the codebase's breadth within this pass; their individual claims were spot-verified against the actual source and live database wherever a finding was severe enough to anchor this report's headline conclusions (the JWT-forgery PoC, the `rolbypassrls` query, the schema-diff, the `tx`-ignoring pattern, the fabricated-dashboard code, and the `student/reports` IDOR were all independently re-read directly, not taken on the sub-investigation's word alone).

---

## 41. Production Readiness Decision

**C. NOT PRODUCTION READY.**

Per the brief's own bar for "PRODUCTION READY" (zero P0, zero unresolved P1, tenant isolation verified, authorization verified, historical integrity verified, finance integrity verified, no fake/illustrative production analytics, no known critical security exposure): this system has seven confirmed, independently-reproduced P0 findings, including a live, demonstrated full-authentication-bypass condition and a completely inert database-level tenant-isolation layer. It also fails the brief's single most emphasized specific bar — "no fake/illustrative production analytics" — on the flagship executive dashboard. It cannot be called even "conditionally" production ready, because the open items are not narrow, well-understood, documented limitations; they are foundational trust boundaries (who you are, which tenant you're in, whether the numbers on screen are real) that are currently either broken or fabricated.

This is not a statement about the team's ability — the HR/Payroll module, the admission-approval flow, the Library concurrency control, and the NCTB grading engine are all genuinely well-built, correctly reasoned, and reflect real engineering care. The gap is entirely in the connective/deployment layer (which secret is actually loaded, which DB role is actually connected, which transaction client a callback actually uses) and in one dashboard component that was evidently shipped with placeholder numbers and never revisited.

---

## 42. Phase 12 Readiness

**PHASE 12 READINESS: NOT READY.**

**Blockers (must close before Phase 12 begins):**
1. Configure the application to connect as `edusmart_app_user` (or an equivalent non-`BYPASSRLS` role) instead of `neondb_owner`, and set a real, secret, sufficiently random `AUTH_SECRET` (and `DEVICE_CREDENTIAL_SECRET`) in every environment — with the code changed to **fail closed** (refuse to start) if these are unset, not silently fall back to a literal.
2. Fix the 58 files where `withTenantContext`'s `tx` client is ignored, so RLS enforcement actually reaches every query once (1) is done — sequence these two fixes together, not independently, per Section 7.2's warning.
3. Fix the `student/reports` IDOR and audit every other self-service route for the same email/phone-matching anti-pattern (`evaluateScope`'s `OWN_DATA` fallback uses the same weak logic).
4. Fix Transfer/Readmission-reactivation to create a new Enrollment rather than mutating history in place.
5. Remove or clearly, structurally flag the fabricated dashboard data — either wire in the real queries (the live equivalents already exist for at least the attendance trend) or replace the chart with an explicit "insufficient historical data" state. No middle ground.
6. Reconcile the live database against `prisma/schema.prisma` (the `school_subscriptions`, `promotion_items`, enum, and Transport time-column drifts) and put a real migration ledger in place so this cannot silently recur.

**Recommended before Phase 12:** wire the Redis-backed stores to an actual Redis client (or remove the dead code and clearly document single-instance-only as a real, disclosed limitation); row-lock the Finance allocation and Inventory stock-issue paths; wire a real SMS/Email/WhatsApp provider or clearly flag Communication as non-functional in any environment without one configured; add the missing `limit` parameter to report exports; correct the self-authored phase documents' factual errors so they stop being cited as ground truth.

**Items Phase 12 must not duplicate:** the existing single canonical communication architecture (provider abstraction, template engine, campaign engine) — build a real provider adapter into it, don't build a second notification system; the existing Finance `Payment`/`PaymentAllocation`/`Refund` ledger — route any new payment surface (including fixing the admission-fee gap) through it, not around it; the existing `withTenantContext`/RLS pattern — once actually fixed, extend it, don't invent a second tenant-scoping mechanism.

**Remaining technical debt:** the recurring hardcoded-fallback-secret pattern, the shallow vs. recursive audit-log sanitizer duplication, the ESLint ignore-list gap, the lack of any CI wiring for the 26 existing adversarial test scripts, and the absence of a mechanically-generated RBAC permission matrix.

---

**STOP. Awaiting explicit approval before any Phase 12 work begins**, per the audit brief's instruction.
