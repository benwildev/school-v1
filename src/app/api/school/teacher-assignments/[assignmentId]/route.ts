import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { TeacherAssignmentUpdateSchema } from '@/lib/validation/teacher';

/**
 * PATCH /api/school/teacher-assignments/[assignmentId]
 * Update an assignment (e.g., activate/deactivate)
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ACADEMICS_UPDATE' });
    const userId = context.userId;

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        id: (await params).assignmentId,
        schoolId
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = TeacherAssignmentUpdateSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validatedData.error.format() },
        { status: 400 }
      );
    }

    const data = validatedData.data;

    // We restrict updating the core relationships (teacher, session, class, section, subject, role) 
    // to avoid complex constraint violations or historical corruption.
    // If they need to change the class/subject/teacher entirely, they should delete/deactivate and create a new assignment.
    if (
        data.teacherId !== undefined ||
        data.academicSessionId !== undefined ||
        data.classId !== undefined ||
        data.sectionId !== undefined ||
        data.subjectId !== undefined ||
        data.role !== undefined
    ) {
        return NextResponse.json({ error: 'Cannot update core assignment relationships. Please create a new assignment instead.' }, { status: 400 });
    }

    const updatedAssignment = await withTenantContext(schoolId, async (tx) => {
      return await tx.teacherAssignment.update({
        where: { id: (await params).assignmentId },
        data,
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'TeacherAssignment',
      entityId: updatedAssignment.id,
      beforeState: assignment as unknown as Record<string, unknown>,
      afterState: updatedAssignment as unknown as Record<string, unknown>,
      changeSummary: `Updated teacher assignment ${updatedAssignment.id}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ data: updatedAssignment });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/teacher-assignments/[assignmentId]
 * Delete an assignment safely
 * Required Permission: ACADEMICS_DELETE
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ACADEMICS_DELETE' });
    const userId = context.userId;

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        id: (await params).assignmentId,
        schoolId
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // In a real system, you would check if this assignment is referenced by Marks or Attendance.
    // If referenced, you would throw an error and ask the user to deactivate instead.
    // Since Marks/Attendance are out of scope for Phase 3.5, we can safely delete it if there are no constraints.

    await withTenantContext(schoolId, async (tx) => {
      await tx.teacherAssignment.delete({
        where: { id: (await params).assignmentId }
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'DELETE',
      entity: 'TeacherAssignment',
      entityId: (await params).assignmentId,
      beforeState: assignment as unknown as Record<string, unknown>,
      changeSummary: `Deleted teacher assignment ${(await params).assignmentId}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ message: 'Assignment deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting assignment:', error);
    if (error.code === 'P2003') {
        return NextResponse.json({ error: 'Cannot delete assignment because it is referenced by other records (e.g. attendance, marks). Please deactivate it instead.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
