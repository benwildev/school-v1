import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { TeacherAssignmentCreateSchema } from '@/lib/validation/teacher';
import { TeacherAssignmentRole } from '@prisma/client';

/**
 * GET /api/school/teacher-assignments
 * List assignments
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const academicSessionId = searchParams.get('academicSessionId');
    const teacherId = searchParams.get('teacherId');
    const classId = searchParams.get('classId');

    const where: any = { schoolId };
    
    if (academicSessionId) where.academicSessionId = academicSessionId;
    if (teacherId) where.teacherId = teacherId;
    if (classId) where.classId = classId;

    const assignments = await prisma.teacherAssignment.findMany({
      where,
      include: {
        teacher: true,
        academicSession: true,
        class: true,
        section: true,
        subject: true,
      },
      orderBy: [
        { teacher: { fullNameEn: 'asc' } },
        { class: { numericLevel: 'asc' } },
        { section: { nameEn: 'asc' } }
      ]
    });

    return NextResponse.json({ data: assignments });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/teacher-assignments
 * Create a new teacher assignment
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_CREATE',
    });
    const userId = context.userId;

    const body = await request.json();
    const validatedData = TeacherAssignmentCreateSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validatedData.error.format() },
        { status: 400 }
      );
    }

    const data = validatedData.data;

    // VALIDATION 1: Teacher belongs to this school
    const teacher = await prisma.teacher.findFirst({
      where: { id: data.teacherId, schoolId }
    });
    if (!teacher) return NextResponse.json({ error: 'Teacher not found or does not belong to this school' }, { status: 400 });

    // VALIDATION 2: Academic Session belongs to this school
    const session = await prisma.academicSession.findFirst({
      where: { id: data.academicSessionId, schoolId }
    });
    if (!session) return NextResponse.json({ error: 'Academic Session not found or does not belong to this school' }, { status: 400 });

    // VALIDATION 3: Class belongs to this school
    const classInfo = await prisma.class.findFirst({
      where: { id: data.classId, schoolId }
    });
    if (!classInfo) return NextResponse.json({ error: 'Class not found or does not belong to this school' }, { status: 400 });

    // VALIDATION 4: Section belongs to this class and school
    const section = await prisma.section.findFirst({
      where: { id: data.sectionId, classId: data.classId, schoolId }
    });
    if (!section) return NextResponse.json({ error: 'Section not found, does not belong to this class, or does not belong to this school' }, { status: 400 });

    // VALIDATION 5: Subject belongs to this class and school (if provided)
    if (data.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: data.subjectId, classId: data.classId, schoolId }
      });
      if (!subject) return NextResponse.json({ error: 'Subject not found, does not belong to this class, or does not belong to this school' }, { status: 400 });
      
      // If subject is provided, ensure role is SUBJECT_TEACHER
      if (data.role !== TeacherAssignmentRole.SUBJECT_TEACHER && data.role !== TeacherAssignmentRole.EXAM_COORDINATOR) {
          // You might allow this depending on specific business rules, but generally Subject is for Subject Teacher
      }
    } else {
      if (data.role === TeacherAssignmentRole.SUBJECT_TEACHER) {
          return NextResponse.json({ error: 'Subject must be provided for a Subject Teacher' }, { status: 400 });
      }
    }

    // UNIQUE CHECK: avoid duplicate assignment
    // The DB constraint is @@unique([schoolId, academicSessionId, sectionId, subjectId, role])
    // Note: subjectId might be null for class teachers. Prisma @@unique handles nulls differently in Postgres depending on version. 
    // We will do a manual check to be safe and clear in our error.
    const duplicate = await prisma.teacherAssignment.findFirst({
      where: {
        schoolId,
        academicSessionId: data.academicSessionId,
        sectionId: data.sectionId,
        subjectId: data.subjectId || null,
        role: data.role,
        teacherId: data.teacherId // Ensure this specific teacher isn't assigned to this twice
      }
    });

    if (duplicate) {
      return NextResponse.json({ error: 'This teacher already has this exact assignment.' }, { status: 409 });
    }
    
    // Check if the role is already fulfilled by someone else for this exact section/subject (if applicable)
    // E.g., Only one CLASS_TEACHER per section
    if (data.role === TeacherAssignmentRole.CLASS_TEACHER) {
        const existingClassTeacher = await prisma.teacherAssignment.findFirst({
            where: {
                schoolId,
                academicSessionId: data.academicSessionId,
                sectionId: data.sectionId,
                role: TeacherAssignmentRole.CLASS_TEACHER,
                status: 'ACTIVE'
            }
        });
        if (existingClassTeacher) {
            return NextResponse.json({ error: 'This section already has an active Class Teacher.' }, { status: 409 });
        }
    }

    const assignment = await withTenantContext(schoolId, async (tx) => {
      const created = await tx.teacherAssignment.create({
        data: {
          ...data,
          schoolId
        },
        include: {
          teacher: true,
          class: true,
          section: true,
          subject: true,
        }
      });

      return created;
    });

    // Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'INSERT',
      entity: 'TeacherAssignment',
      entityId: assignment.id,
      afterState: {
        teacherId: assignment.teacherId,
        role: assignment.role,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
      },
      changeSummary: `Assigned teacher ${assignment.teacher?.fullNameEn || assignment.teacherId} to class ${assignment.class?.nameEn || assignment.classId}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating assignment:', error);
    
    if (error.code === 'P2002') {
       return NextResponse.json(
         { error: 'An assignment for this role in this section/subject already exists.' },
         { status: 409 }
       );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
