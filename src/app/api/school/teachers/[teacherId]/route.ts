import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { TeacherUpdateSchema } from '@/lib/validation/teacher';

/**
 * GET /api/school/teachers/[teacherId]
 * Get teacher details
 * Required Permission: STAFF_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: (await params).teacherId,
        schoolId
      },
      include: {
        campus: true,
        user: {
          select: {
            id: true,
            status: true
          }
        },
        assignments: {
          include: {
            academicSession: true,
            class: true,
            section: true,
            subject: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    return NextResponse.json({ data: teacher });
  } catch (error) {
    console.error('Error fetching teacher:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/teachers/[teacherId]
 * Update a teacher
 * Required Permission: STAFF_UPDATE
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'STAFF_UPDATE' });
    const userId = context.userId;

    // Verify ownership
    const existingTeacher = await prisma.teacher.findFirst({
      where: {
        id: (await params).teacherId,
        schoolId
      }
    });

    if (!existingTeacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = TeacherUpdateSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validatedData.error.format() },
        { status: 400 }
      );
    }

    const data = validatedData.data;

    // Verify campus if provided
    if (data.campusId && data.campusId !== existingTeacher.campusId) {
      const campus = await prisma.campus.findUnique({
        where: { id: data.campusId }
      });
      if (!campus || campus.schoolId !== schoolId) {
        return NextResponse.json(
          { error: 'Invalid Campus or Campus does not belong to this school' },
          { status: 400 }
        );
      }
    }

    // Uniqueness checks if updating code or phone
    if (data.teacherCode && data.teacherCode !== existingTeacher.teacherCode) {
      const existingCode = await prisma.teacher.findUnique({
        where: {
          schoolId_teacherCode: { schoolId, teacherCode: data.teacherCode }
        }
      });
      if (existingCode) {
        return NextResponse.json({ error: 'Teacher code already exists in this school' }, { status: 409 });
      }
    }

    if (data.phone && data.phone !== existingTeacher.phone) {
      const existingPhone = await prisma.teacher.findUnique({
        where: {
          schoolId_phone: { schoolId, phone: data.phone }
        }
      });
      if (existingPhone) {
        return NextResponse.json({ error: 'Phone number already exists in this school' }, { status: 409 });
      }
    }

    const updatedTeacher = await withTenantContext(schoolId, async (tx) => {
      const teacher = await tx.teacher.update({
        where: { id: (await params).teacherId },
        data,
        include: {
          campus: true,
          user: true
        }
      });

      // Optional: sync phone/email to user account if updated
      if ((data.phone && data.phone !== existingTeacher.phone) || 
          (data.email && data.email !== existingTeacher.email) ||
          (data.fullNameEn && data.fullNameEn !== existingTeacher.fullNameEn)) {
        await tx.user.update({
          where: { id: existingTeacher.userId },
          data: {
            ...(data.phone && { phone: data.phone }),
            ...(data.email && { email: data.email }),
            ...(data.fullNameEn && { fullName: data.fullNameEn })
          }
        });
      }

      return teacher;
    });

    // Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'Teacher',
      entityId: updatedTeacher.id,
      beforeState: existingTeacher as unknown as Record<string, unknown>,
      afterState: updatedTeacher as unknown as Record<string, unknown>,
      changeSummary: `Updated teacher ${updatedTeacher.fullNameEn} (${updatedTeacher.teacherCode})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ data: updatedTeacher });
  } catch (error: any) {
    console.error('Error updating teacher:', error);
    if (error.code === 'P2002') {
       return NextResponse.json(
         { error: 'A record with this unique identifier already exists' },
         { status: 409 }
       );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
