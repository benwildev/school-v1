# EduSmart BD — Phase 4.2 Guardian / Parent Management Architecture Audit

**Document Version:** 1.0  
**Author:** DeepMind / Antigravity Agent  
**Date:** September 2026  
**Status:** COMPLETE & VERIFIED (100% Tests Passing)

---

## 1. Existing Guardian Architecture
- **Prisma Model:** `model Guardian` (`prisma/schema.prisma` lines 1034–1062)
- **Database Table:** `guardians` (`migrations/0004_create_student_faculty_tables.sql` lines 46–65)
- **Columns & Data Model:**
  - `id`: UUID Primary Key (`gen_random_uuid()`)
  - `schoolId`: UUID foreign key (`REFERENCES schools(id) ON DELETE RESTRICT`)
  - `userId`: Nullable UUID foreign key (`REFERENCES users(id) ON DELETE SET NULL`)
  - `fullNameEn`: VARCHAR(150)
  - `fullNameBn`: VARCHAR(150)
  - `relationType`: Enum `GuardianRelation` (`FATHER`, `MOTHER`, `PATERNAL_UNCLE`, `MATERNAL_UNCLE`, `BROTHER`, `SISTER`, `GRANDFATHER`, `GRANDMOTHER`, `LEGAL_GUARDIAN`)
  - `nationalId`: VARCHAR(50), nullable
  - `phone`: VARCHAR(30) (normalized to Bangladesh standard `01XXXXXXXXX`)
  - `alternatePhone`: VARCHAR(30), nullable
  - `email`: VARCHAR(255), lowercase trimmed, nullable
  - `occupation`: VARCHAR(100), nullable
  - `monthlyIncome`: DECIMAL(12, 2), nullable
  - `educationLevel`: VARCHAR(100), nullable
  - `photoUrl`: TEXT, nullable
  - `address`: TEXT, nullable
  - `createdAt` / `updatedAt`: TIMESTAMPTZ

## 2. Existing StudentGuardian Architecture
- **Prisma Model:** `model StudentGuardian` (`prisma/schema.prisma` lines 1064–1080)
- **Database Table:** `student_guardians` (`migrations/0004_create_student_faculty_tables.sql` lines 67–77)
- **Join Semantics:** Explicit many-to-many join model linking `students` and `guardians`.
- **Columns:**
  - `id`: UUID Primary Key (`gen_random_uuid()`)
  - `schoolId`: UUID foreign key (`REFERENCES schools(id) ON DELETE RESTRICT`)
  - `studentId`: UUID foreign key (`REFERENCES students(id) ON DELETE CASCADE`)
  - `guardianId`: UUID foreign key (`REFERENCES guardians(id) ON DELETE CASCADE`)
  - `isPrimary`: BOOLEAN (default `false`)
  - `isFinancialPayer`: BOOLEAN (default `false`)
  - `canPickUp`: BOOLEAN (default `true`)
  - `createdAt`: TIMESTAMPTZ
- **Database Constraint:** `CONSTRAINT uq_student_guardian UNIQUE (student_id, guardian_id)`
  - Guarantees at the PostgreSQL level that a student and guardian cannot be linked more than once.

## 3. API Architecture
Four dedicated REST API endpoints:
1. `GET /api/school/guardians`:
   - Paginated list with search (`fullNameEn`, `fullNameBn`, `phone`, `email`, `nationalId`).
   - Returns safe projection with linked student counts (`_count: { students: true }`).
   - Server-side pagination (`page`, `pageSize`, `total`, `totalPages`).
2. `POST /api/school/guardians`:
   - Creates a new Guardian profile within active school context.
   - Normalizes Bangladesh phone number and validates input with Zod.
   - Logs `INSERT` in audit log.
3. `GET /api/school/guardians/[guardianId]`:
   - Retrieves full demographic details and linked students (`studentCode`, `fullNameEn`, `fullNameBn`, `gender`, `status`, `phone`, `isPrimary`, `isFinancialPayer`, `canPickUp`).
   - Strict projection: no internal marks, fees, or medical documents exposed.
4. `PATCH /api/school/guardians/[guardianId]`:
   - Updates guardian demographics and contact info.
   - Strictly blocks mutating `id` or `schoolId`.
   - Logs `UPDATE` in audit log.
5. `DELETE /api/school/guardians/[guardianId]`:
   - Enforces dependency guard: if active student links exist (`student_guardians > 0`), rejects deletion with status 409 and descriptive Bangla error message.
6. `POST /api/school/student-guardians`:
   - Links student and guardian within active school.
   - Explicitly verifies both student and guardian belong to `activeSchoolId`.
   - Atomic primary guardian assignment with row locking.
   - Logs `INSERT` in audit log.
7. `PATCH /api/school/student-guardians/[relationshipId]`:
   - Updates relationship flags (`isPrimary`, `isFinancialPayer`, `canPickUp`).
   - Rejects tampering with `studentId` or `guardianId`.
8. `DELETE /api/school/student-guardians/[relationshipId]`:
   - Safely removes only the relationship row.
   - Preserves `students`, `guardians`, `enrollments`, and academic records intact.

## 4. Permission Model
- Registered permissions in `src/lib/authorization/permissions.ts` under module `'STUDENTS'`:
  - `GUARDIANS_VIEW`: View guardian profiles and student links
  - `GUARDIANS_CREATE`: Create guardian records and relationships
  - `GUARDIANS_UPDATE`: Modify guardian records and relationships
  - `GUARDIANS_DELETE`: Remove guardian records and relationships
- **Dual-Permission Fallback:** All route handlers accept either `GUARDIANS_*` or existing `STUDENTS_*` permissions, ensuring existing School Owner, Principal, and Admin roles continue to have immediate access without privilege disruption.

## 5. Tenant Isolation
- Zero trust in client headers (`x-user-id`, `x-active-school-id`, or client payload `schoolId`).
- School identity is extracted and cryptographically verified from the authenticated JWT session.
- All database queries run through `withTenantContext(schoolId, async (tx) => ...)`.
- Cross-tenant requests (e.g. School A user attempting to link a School B student or guardian) are explicitly blocked and return 404/403.

## 6. Row-Level Security (RLS)
- Enabled on both `guardians` and `student_guardians` tables via migration `0010_enable_tenant_rls_policies.sql`.
- Direct policy `tenant_isolation_policy`:
  ```sql
  CREATE POLICY tenant_isolation_policy ON %I
  FOR ALL
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
  ```
- Verified via automated tests:
  - SELECT across tenants: 0 rows returned.
  - UPDATE across tenants: 0 rows affected.
  - DELETE across tenants: 0 rows affected.
  - INSERT across tenants: RLS check error thrown.

## 7. Primary Guardian Rule
- Invariant: A student must have **AT MOST ONE** primary guardian (`isPrimary = true`).
- Behavioral policy: **Option A** (Assigning a guardian as primary automatically demotes any previously assigned primary guardian for that student).
- Atomicity: Handled within a single transaction under `withTenantContext`.

## 8. Concurrency Strategy
- To prevent race conditions where two simultaneous transactions assign different guardians as primary for the same student, the transaction executes:
  ```sql
  SELECT id FROM students WHERE id = $studentId AND school_id = $schoolId FOR UPDATE;
  ```
- This acquires an exclusive row-level lock on the parent `Student` record across database connections.
- The second transaction queues until the first commits, ensuring it sees the committed state, demotes the earlier primary guardian, and sets its target as primary.
- Concurrency test (Scenario L) verifies that racing concurrent updates guarantee that exactly one guardian retains `isPrimary = true`.

## 9. Delete Behavior
1. **StudentGuardian Relationship Delete:**
   - Deleting a relationship row via `DELETE /api/school/student-guardians/[relationshipId]` removes ONLY the join record.
   - The `Student` record remains completely untouched.
   - The `Guardian` record remains completely untouched.
   - Enrollment, attendance, marks, fees, and payments are 100% unaffected.
2. **Guardian Profile Delete:**
   - Deleting a guardian via `DELETE /api/school/guardians/[guardianId]` checks if any student links exist in `student_guardians`.
   - If links exist, deletion is **rejected (409 Conflict)** with error: `ঐতিহাসিক রেকর্ড বিদ্যমান (... শিক্ষার্থী সংযুক্ত)। সম্পর্ক অপসারণ করার পূর্বে অভিভাবক মোছা যাবে না।`
   - If unlinked, the guardian record is deleted cleanly.

## 10. User Account Relationship
- `Guardian` connects to `User` via optional `userId UUID NULL REFERENCES users(id) ON DELETE SET NULL`.
- In this phase, `Guardian != User`.
- No automatic user accounts, passwords, or temporary credentials are created for guardians.
- Documented as a future parent portal onboarding workflow.

## 11. Historical Data Protection
- Deleting or updating guardian relationships has zero side-effects on:
  - `students`
  - `enrollments`
  - `marks`
  - `student_attendances`
  - `payments`
- Verified in Scenarios R, S, AL, AM, AN.

## 12. Audit Logging
- Every mutation logs an entry to `audit_logs` using `logAuditEvent`:
  - `INSERT` on `Guardian` (`GUARDIAN_CREATED`)
  - `UPDATE` on `Guardian` (`GUARDIAN_UPDATED`)
  - `DELETE` on `Guardian` (`GUARDIAN_DELETE_ATTEMPTED` / `DELETED`)
  - `INSERT` on `StudentGuardian` (`STUDENT_GUARDIAN_CREATED`)
  - `UPDATE` on `StudentGuardian` (`STUDENT_GUARDIAN_UPDATED`)
  - `DELETE` on `StudentGuardian` (`STUDENT_GUARDIAN_REMOVED`)
- Zero sensitive credentials, passwords, JWT tokens, or hashes are ever logged.

## 13. Validation
- `GuardianCreateSchema`:
  - `fullNameEn`: 1–150 characters, trimmed.
  - `fullNameBn`: 1–150 characters, preserves Unicode Bangla script.
  - `relationType`: valid `GuardianRelation` enum.
  - `phone`: BD regex, normalized to `01XXXXXXXXX`.
  - `email`: valid format, converted to lowercase.
- `StudentGuardianCreateSchema`:
  - `studentId`: UUID.
  - `guardianId`: UUID.
  - `isPrimary`, `isFinancialPayer`, `canPickUp`: Booleans.
- Rejection of invalid inputs tested in Scenario AH.

## 14. Test Results
- **Test File:** `scripts/test-phase4-2-guardians.mjs`
- **Result:** **100% PASS** (All 40 Scenarios A through AN).

| Scenario | Description | Result |
|---|---|---|
| A | Guardian creation with validation & phone normalization | PASS |
| B | Guardian list under authenticated school context | PASS |
| C | Server-side guardian pagination | PASS |
| D | Guardian search (Bangla name, English name, phone) | PASS |
| E | Guardian detail retrieval | PASS |
| F | Guardian demographic update | PASS |
| G | Guardian ↔ Student relationship creation | PASS |
| H | Duplicate relationship blocked by database unique constraint | PASS |
| I | One guardian linked to multiple students (siblings) | PASS |
| J | One student linked to multiple guardians | PASS |
| K | Primary guardian enforcement (Option A atomic demote-and-assign) | PASS |
| L | Primary guardian concurrency serialization | PASS |
| M | Emergency contact metadata verification | PASS |
| N | Financial payer metadata verification | PASS |
| O | Pickup authorization metadata verification | PASS |
| P | Relationship update | PASS |
| Q | Relationship removal | PASS |
| R | Relationship removal preserves Student | PASS |
| S | Relationship removal preserves Enrollment | PASS |
| T | Cross-tenant Guardian SELECT blocked | PASS |
| U | Cross-tenant Guardian UPDATE blocked | PASS |
| V | Cross-tenant Guardian DELETE blocked | PASS |
| W | Cross-tenant StudentGuardian INSERT blocked | PASS |
| X | Cross-tenant StudentGuardian SELECT blocked | PASS |
| Y | Cross-tenant StudentGuardian UPDATE blocked | PASS |
| Z | Cross-tenant StudentGuardian DELETE blocked | PASS |
| AA | Guardian cannot access unrelated student | PASS |
| AB | PostgreSQL RLS rowsecurity active on guardians | PASS |
| AC | PostgreSQL RLS rowsecurity active on student_guardians | PASS |
| AD | PostgreSQL RLS UPDATE protection | PASS |
| AE | PostgreSQL RLS DELETE protection | PASS |
| AF | Missing authentication blocked | PASS |
| AG | Missing permission blocked | PASS |
| AH | Invalid inputs safely rejected by Zod schemas | PASS |
| AI | Concurrent duplicate relationship handled cleanly via unique constraint | PASS |
| AJ | Zero sensitive credentials or tokens in Guardian data structure | PASS |
| AK | Audit logging verified | PASS |
| AL | Student academic marks unaffected by guardian operations | PASS |
| AM | Enrollment history unaffected | PASS |
| AN | Student permanent record cannot be deleted through relationship removal | PASS |

## 15. Known Limitations
- Guardians currently do not have automated login credentials (`userId` is null by design for this phase).
- Parent Portal access and parent-level portal authorization will be introduced in a dedicated future portal phase.

## 16. Future Parent Portal Compatibility
- The data model cleanly supports future Parent Portal functionality:
  - When a user logs in as a `PARENT`, their `userId` resolves to their `Guardian` record.
  - From `Guardian`, their authorized students are queried exclusively through `StudentGuardian` (`WHERE guardian.userId = auth.userId`).
  - Scopes in `src/lib/authorization/scopes.ts` already support `OWN_CHILDREN` filtering by joining through `StudentGuardian`.
