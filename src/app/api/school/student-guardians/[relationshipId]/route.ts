import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentGuardianUpdateSchema } from '@/lib/validation/student-guardian';

interface RouteContext {
  params: Promise<{ relationshipId: string }>;
}

async function requireGuardianPermission(req: NextRequest, action: 'UPDATE' | 'DELETE') {
  try {
    return await requirePermission(req, { permission: `GUARDIANS_${action}` });
  } catch {
    return await requirePermission(req, { permission: `STUDENTS_${action}` });
  }
}

/**
 * PATCH /api/school/student-guardians/[relationshipId]
 * Update relationship flags (isPrimary, isFinancialPayer, canPickUp).
 * Required Permission: GUARDIANS_UPDATE or STUDENTS_UPDATE
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { relationshipId } = await params;
    const { context, schoolId } = await requireGuardianPermission(request, 'UPDATE');

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    // Explicitly reject tampering with foreign keys through PATCH
    if (body.studentId !== undefined || body.guardianId !== undefined || body.schoolId !== undefined) {
      return NextResponse.json(
        { success: false, error: 'শিক্ষার্থী বা অভিভাবক পরিবর্তনযোগ্য নয়। নতুন সংযোগ তৈরি করুন।' },
        { status: 400 }
      );
    }

    const validation = StudentGuardianUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'প্রদত্ত তথ্যে ভুল রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const data = validation.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.studentGuardian.findFirst({
        where: { id: relationshipId, schoolId },
        include: {
          student: { select: { id: true, studentCode: true } },
          guardian: { select: { id: true, fullNameEn: true } },
        },
      });

      if (!existing) {
        throw new Error('NOT_FOUND: সম্পর্ক পাওয়া যায়নি।');
      }

      // If setting isPrimary to true, acquire lock and demote any other primary guardian
      if (data.isPrimary) {
        await tx.$executeRaw`SELECT id FROM students WHERE id = ${existing.studentId}::uuid AND school_id = ${schoolId}::uuid FOR UPDATE`;

        await tx.studentGuardian.updateMany({
          where: {
            schoolId,
            studentId: existing.studentId,
            id: { not: relationshipId },
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      if (data.relationshipType) {
        await tx.guardian.update({
          where: { id: existing.guardianId },
          data: { relationType: data.relationshipType },
        });
      }

      return tx.studentGuardian.update({
        where: { id: relationshipId },
        data: {
          isPrimary: data.isPrimary !== undefined ? data.isPrimary : undefined,
          isFinancialPayer: data.isFinancialPayer !== undefined ? data.isFinancialPayer : undefined,
          canPickUp: data.canPickUp !== undefined ? data.canPickUp : undefined,
        },
        include: {
          student: {
            select: { id: true, studentCode: true, fullNameEn: true, fullNameBn: true },
          },
          guardian: {
            select: { id: true, fullNameEn: true, fullNameBn: true, relationType: true },
          },
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'StudentGuardian',
      entityId: updated.id,
      afterState: {
        isPrimary: updated.isPrimary,
        isFinancialPayer: updated.isFinancialPayer,
        canPickUp: updated.canPickUp,
      },
      changeSummary: `Updated relationship between student ${updated.student.studentCode} and guardian ${updated.guardian.fullNameEn}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'সম্পর্ক সফলভাবে হালনাগাদ করা হয়েছে।',
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত এক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('FORBIDDEN: ', '') },
        { status: 403 }
      );
    }
    if (err.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND: ', '') },
        { status: 404 }
      );
    }

    console.error('PATCH /api/school/student-guardians/[relationshipId] error:', error);
    return NextResponse.json(
      { success: false, error: 'সম্পর্ক হালনাগাদ করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/student-guardians/[relationshipId]
 * Safely remove a StudentGuardian relationship without affecting student or guardian records.
 * Required Permission: GUARDIANS_DELETE or STUDENTS_DELETE
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { relationshipId } = await params;
    const { context, schoolId } = await requireGuardianPermission(request, 'DELETE');

    const relationship = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.studentGuardian.findFirst({
        where: { id: relationshipId, schoolId },
        include: {
          student: { select: { id: true, studentCode: true, fullNameEn: true } },
          guardian: { select: { id: true, fullNameEn: true } },
        },
      });

      if (!existing) {
        throw new Error('NOT_FOUND: সম্পর্ক পাওয়া যায়নি।');
      }

      // Delete only the relationship record
      await tx.studentGuardian.delete({
        where: { id: relationshipId },
      });

      return existing;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'DELETE',
      entity: 'StudentGuardian',
      entityId: relationship.id,
      changeSummary: `Removed relationship between student ${relationship.student.studentCode} and guardian ${relationship.guardian.fullNameEn}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'সম্পর্ক সফলভাবে মুছে ফেলা হয়েছে।',
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত এক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('FORBIDDEN: ', '') },
        { status: 403 }
      );
    }
    if (err.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND: ', '') },
        { status: 404 }
      );
    }

    console.error('DELETE /api/school/student-guardians/[relationshipId] error:', error);
    return NextResponse.json(
      { success: false, error: 'সম্পর্ক মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
