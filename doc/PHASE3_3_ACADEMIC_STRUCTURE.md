# Phase 3.3 — Academic Structure (Class / Section / Shift / Group)

## 1. Executive Summary

Phase 3.3 establishes the foundational Academic Structure for **EduSmart BD**, enabling educational institutions to configure and manage:
1. **Class (শ্রেণি)**: Standard educational levels (e.g., Play, KG, Class 1 to Class 12).
2. **Section (শাখা)**: Classroom cohorts linked to classes, shifts, optional campuses, and optional groups.
3. **Shift (শিফট)**: Academic shifts (Morning, Day, Evening) configured at the institutional level and enforced per section.
4. **Group (গ্রুপ / বিভাগ)**: Curricular specializations (Science, Commerce / Business Studies, Humanities) applied to secondary and higher secondary sections and subjects.

All operations strictly enforce multi-tenant isolation with PostgreSQL Row-Level Security (RLS), RBAC permissions, forensic audit logging, and historical data safety invariants across academic sessions.

---

## 2. Existing Database Schema Discovered & Reused

A thorough analysis of `prisma/schema.prisma` and PostgreSQL migration files (`migrations/0001` through `migrations/0010`) confirmed that the canonical database schema already models the full academic structure.

### Discovered Models & Constraints:

1. **`Class` Model (`classes` table)**:
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Key: `school_id UUID REFERENCES schools(id) ON DELETE RESTRICT`
   - Fields: `name_en` (VARCHAR 100), `name_bn` (VARCHAR 100), `numeric_level` (INT), `category` (`ClassCategory`), `status` (`RecordStatus`), timestamps.
   - Enums:
     - `ClassCategory`: `PRE_PRIMARY`, `PRIMARY`, `JUNIOR_SECONDARY`, `SECONDARY`, `HIGHER_SECONDARY`
     - `RecordStatus`: `ACTIVE`, `INACTIVE`, `ARCHIVED`
   - Constraints:
     - `uq_class_id_school UNIQUE (id, school_id)`
     - `uq_class_school_level_name UNIQUE (school_id, numeric_level, name_en)`
   - RLS Policy: `school_id = current_setting('app.current_school_id')`

2. **`Section` Model (`sections` table)**:
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Keys:
     - `school_id UUID REFERENCES schools(id) ON DELETE RESTRICT`
     - `campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL` (nullable, supports campus-wide or branch-specific sections)
     - `class_id UUID REFERENCES classes(id) ON DELETE RESTRICT`
     - `group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL` (nullable, optional grouping)
   - Fields: `name_en` (VARCHAR 100), `name_bn` (VARCHAR 100), `shift` (`AcademicShift`), `gender_type` (`GenderRestriction`), `max_capacity` (INT, default 50), `status` (`RecordStatus`), timestamps.
   - Enums:
     - `AcademicShift`: `MORNING`, `DAY`, `EVENING`
     - `GenderRestriction`: `BOYS`, `GIRLS`, `CO_ED`
   - Constraints:
     - `uq_section_id_school UNIQUE (id, school_id)`
     - `uq_section_school_class_shift UNIQUE (school_id, class_id, name_en, shift)`
   - RLS Policy: `school_id = current_setting('app.current_school_id')`

3. **`AcademicGroup` Model (`academic_groups` table)**:
   - Primary Key: `id UUID DEFAULT gen_random_uuid()`
   - Foreign Key: `school_id UUID REFERENCES schools(id) ON DELETE RESTRICT`
   - Fields: `code` (VARCHAR 50), `name_en` (VARCHAR 100), `name_bn` (VARCHAR 100), `status` (`RecordStatus`), `created_at`
   - Constraints:
     - `uq_group_id_school UNIQUE (id, school_id)`
     - `uq_group_school_code UNIQUE (school_id, code)`
   - RLS Policy: `school_id = current_setting('app.current_school_id')`

4. **Institutional Shift Configuration**:
   - Stored cleanly in `school_settings.custom_attributes.supportedShifts`, maintaining the canonical `AcademicShift` enum without duplicating or fracturing schema tables.

### Schema Changes:
- **Zero Schema Changes Required**: Existing schema and migration tables completely cover all requirements. No new migrations were created.

---

## 3. Session & Campus Dependency Architecture

### Session Independence & Historical Invariance:
- Academic Structure (Class, Section, Group) defines the school's structural blueprint.
- Operational records (`enrollments`, `routines`, `marks`, `fee_structures`) link to `academic_session_id` along with `class_id`, `section_id`, and `group_id`.
- Transitions across academic sessions (e.g., from Session 2026 to Session 2027) preserve historical session records.
- If an administrator discontinues a class or section, the system enforces **deactivation** (`status = INACTIVE`) rather than destructive deletion.
- If operational records or student enrollments reference a class, section, or group, hard DELETE is rejected with a `409 Conflict` (HISTORICAL_SAFETY_VIOLATION).

### Campus Dependency:
- `Section` has an optional `campus_id` foreign key.
- A section can be campus-wide (`campus_id = null`) or dedicated to a specific branch (`campus_id = <uuid>`).
- API verifies that any supplied `campus_id` belongs strictly to the tenant's `school_id` and is not marked as deleted. Cross-campus tenant leakage is prohibited.

---

## 4. RBAC & Permission Matrix

Reused the existing permissions defined in `src/lib/authorization/permissions.ts`:

| Permission Code | Module | Action | Description | Scope |
|---|---|---|---|---|
| `ACADEMICS_VIEW` | `ACADEMICS` | `VIEW` | View academic structure, sessions, classes, sections, shifts, groups | `ENTIRE_SCHOOL` |
| `ACADEMICS_CREATE` | `ACADEMICS` | `CREATE` | Create classes, sections, groups | `ENTIRE_SCHOOL` |
| `ACADEMICS_UPDATE` | `ACADEMICS` | `UPDATE` | Modify classes, sections, shifts configuration, groups | `ENTIRE_SCHOOL` |
| `ACADEMICS_DELETE` | `ACADEMICS` | `DELETE` | Safely remove unreferenced classes, sections, groups | `ENTIRE_SCHOOL` |

---

## 5. API Endpoints

All endpoints use `withTenantContext()`, verify JWT session credentials, derive `schoolId` solely from the verified authentication context, validate inputs with Zod, and log forensic audits with `logAuditEvent()`.

### 1. Classes (`/api/school/academic-structure/classes`)
- `GET /api/school/academic-structure/classes`
  - Query Params: `status` (`ACTIVE`, `INACTIVE`, `ALL`)
  - Response: Ordered classes by `numericLevel ASC`, with section counts and user permission flags (`canCreate`, `canUpdate`, `canDelete`).
- `POST /api/school/academic-structure/classes`
  - Body: `{ nameEn, nameBn, numericLevel, category, status }`
  - Duplicate Check: `(schoolId, numericLevel, nameEn)`
- `GET /api/school/academic-structure/classes/[classId]`
  - Response: Class details including nested sections and counts.
- `PATCH /api/school/academic-structure/classes/[classId]`
  - Body: Partial update with duplicate validation on modified fields.
- `DELETE /api/school/academic-structure/classes/[classId]`
  - Enforces dependency check. Blocks deletion if sections, enrollments, routines, or subjects exist.

### 2. Sections (`/api/school/academic-structure/sections`)
- `GET /api/school/academic-structure/sections`
  - Query Params: `classId`, `campusId`, `status`
  - Response: Sections with related `class`, `campus`, and `group`.
- `POST /api/school/academic-structure/sections`
  - Body: `{ classId, campusId, groupId, nameEn, nameBn, shift, genderType, maxCapacity, status }`
  - Verification: Ensures `classId`, `campusId`, and `groupId` belong to the same `schoolId`.
  - Duplicate Check: `(schoolId, classId, nameEn, shift)`
- `GET /api/school/academic-structure/sections/[sectionId]`
  - Response: Single section details.
- `PATCH /api/school/academic-structure/sections/[sectionId]`
  - Body: Partial update with tenant cross-reference validation.
- `DELETE /api/school/academic-structure/sections/[sectionId]`
  - Dependency check: Blocks deletion if referenced in enrollments, routines, or exams.

### 3. Shifts (`/api/school/academic-structure/shifts`)
- `GET /api/school/academic-structure/shifts`
  - Response: Canonical `AcademicShift` enum values (`MORNING`, `DAY`, `EVENING`) with Bangla labels, operating hours, active status, and real-time section usage counts.
- `PATCH /api/school/academic-structure/shifts`
  - Body: `{ shifts: [{ shift, isEnabled, startTime, endTime, labelBn }] }`
  - Persists configuration in `school_settings.custom_attributes.supportedShifts`.

### 4. Groups (`/api/school/academic-structure/groups`)
- `GET /api/school/academic-structure/groups`
  - Response: List of groups (`SCIENCE`, `COMMERCE`, `HUMANITIES`) with section counts.
- `POST /api/school/academic-structure/groups`
  - Body: `{ code, nameEn, nameBn, status }`
  - Duplicate Check: `(schoolId, code)`
- `GET /api/school/academic-structure/groups/[groupId]`
  - Response: Single group details.
- `PATCH /api/school/academic-structure/groups/[groupId]`
  - Body: Partial update with duplicate code validation.
- `DELETE /api/school/academic-structure/groups/[groupId]`
  - Dependency check: Blocks deletion if referenced by sections, subjects, or enrollments.

---

## 6. Bangla-First User Interface

- **Route**: `/dashboard/settings/academic-structure`
- **Page Title**: "শিক্ষাগত কাঠামো (Academic Structure)"
- **Tabs**:
  1. **শ্রেণি (Classes)**: Displays Bangla & English names, numeric level, category badge, section count, active/inactive badge, Add/Edit modal.
  2. **শাখা (Sections)**: Filterable by class; displays shift, gender type, campus branch, group, capacity, active/inactive status, Add/Edit modal.
  3. **শিফট (Shifts)**: Institutional shifts overview (`প্রভাতী / মর্নিং`, `দিবা / ডে`, `সান্ধ্য / ইভনিং`), operational time ranges, active section counts.
  4. **গ্রুপ / বিভাগ (Groups)**: Code, Bangla/English name, attached sections, Add/Edit modal.
- Responsive design with empty states, loading indicators, field-level error messages, and permission guards.

---

## 7. Security Controls & Audit Logging

- **No Client Tenant Selection**: `schoolId` is derived exclusively from verified JWT token context.
- **Tenant Boundary Enforcement**: `classId`, `campusId`, and `groupId` cross-references must belong strictly to the same `schoolId`.
- **PostgreSQL Row-Level Security**: Direct tenant tables (`classes`, `sections`, `academic_groups`) enforce RLS policies.
- **Forensic Audit Logs**: All mutations (INSERT, UPDATE, DELETE) log actor ID, school ID, entity name, entity ID, before/after states (sanitizing sensitive keys), client IP, and user-agent into `audit_logs`.
