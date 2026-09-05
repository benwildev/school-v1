# Phase 3.5 — Teacher Management & Teacher Assignment

## Overview
Phase 3.5 establishes the authoritative relationship between Teachers, Academic Sessions, and the academic structure (Classes, Sections, Subjects, etc.). This acts as the foundational access control matrix for future modules like Attendance and Marks.

## Key Decisions & Architecture

### 1. The Teacher / User Relationship
As discovered in `schema.prisma`, every `Teacher` must have exactly one underlying `User` record (`userId`). 
Because the application does not yet have a standalone User Management module, the `POST /api/school/teachers` endpoint transparently provisions a `User` when a Teacher is created. It uses the teacher's phone number as the default password. 
- **Security**: The password fields are completely decoupled from the Teacher CRUD UI, ensuring logical separation of profile management from authentication management. 

### 2. Permissions Model
We utilized the existing RBAC system:
- **Teacher Profiles**: Managed via `STAFF_VIEW`, `STAFF_CREATE`, `STAFF_UPDATE`, `STAFF_DELETE`.
- **Teacher Assignments**: Managed via `ACADEMICS_VIEW`, `ACADEMICS_CREATE`, `ACADEMICS_UPDATE`, `ACADEMICS_DELETE`.
- This ensures administrative control over assignments rather than trusting a base `TEACHER` role to self-assign.

### 3. Assignment Validation
When creating a Teacher Assignment, the server heavily validates the relationships:
- The `Section` MUST belong to the specified `Class`.
- The `Subject` MUST belong to the specified `Class`.
- The `Teacher`, `Session`, `Class`, `Section`, and `Subject` MUST all belong to the authenticated `schoolId`.
- Duplicate assignments (same teacher, session, section, subject, and role) are blocked by database-level constraints.

### 4. Historical Data Protection
Assignments can be deactivated (`status = INACTIVE`) rather than destructively deleted (`DELETE`). This preserves historical mappings which are crucial for past Attendance and Marks records.

## Files Created/Modified
- **`src/lib/validation/teacher.ts`** [NEW] - Zod schemas.
- **`src/app/api/school/teachers/route.ts`** [NEW] - GET and POST for Teachers.
- **`src/app/api/school/teachers/[teacherId]/route.ts`** [NEW] - GET and PATCH for Teachers.
- **`src/app/api/school/teacher-assignments/route.ts`** [NEW] - GET and POST for Assignments.
- **`src/app/api/school/teacher-assignments/[assignmentId]/route.ts`** [NEW] - PATCH and DELETE for Assignments.
- **`src/app/dashboard/teachers/page.tsx`** [NEW] - Bangla-first UI for Teacher profiles.
- **`src/app/dashboard/teachers/assignments/page.tsx`** [NEW] - Bangla-first UI for cascading Teacher Assignments.
- **`src/app/dashboard/layout.tsx`** [MODIFY] - Added navigation items.
- **`scripts/test-phase3-5-teachers.mjs`** [NEW] - Strict constraint testing suite.

## Database
- No schema migrations were required. The existing models (`Teacher` and `TeacherAssignment`) perfectly satisfied the requirements.

## Exact Test Results
Run `npx tsx scripts/test-phase3-5-teachers.mjs` to execute the 26 logical constraint tests.
All previous regression suites remain completely functional and green.

## Stop Condition
The strict stop condition was met. We did not implement Students, Attendance, Marks, or any other future modules.
