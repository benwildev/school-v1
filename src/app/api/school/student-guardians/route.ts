import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentGuardianCreateSchema } from '@/lib/validation/student-guardian';
import { Prisma } from '@prisma/client';

async function requireGuardianPermission(req: NextRequest, action: 'CREATE') {
  try {
    return await requirePermission(req, { permission: `GUARDIANS_${action}` });
  } catch {
    return await requirePermission(req, { permission: `STUDENTS_${action}` });
  }
}

/**
 * POST /api/school/student-guardians
 * Create an explicit Student ↔ Guardian relationship.
 * Required Permission: GUARDIANS_CREATE or STUDENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requireGuardianPermission(request, 'CREATE');

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    const validation = StudentGuardianCreateSchema.safeParse(body);
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

    const relationship = await withTenantContext(schoolId, async (tx) => {
      // Step 15: Explicit Student & Guardian Verification within the active school
      // Cross-tenant attempts will return null here and be strictly rejected.
      const student = await tx.student.findFirst({
        where: {
          id: data.studentId,
          schoolId,
          deletedAt: null,
        },
        select: { id: true, studentCode: true, fullNameEn: true, fullNameBn: true },
      });

      if (!student) {
        throw new Error('NOT_FOUND_STUDENT: শিক্ষার্থী পাওয়া যায়নি বা এই স্কুলের অন্তর্ভুক্ত নয়।');
      }

      const guardian = await tx.guardian.findFirst({
        where: {
          id: data.guardianId,
          schoolId,
        },
        select: { id: true, fullNameEn: true, fullNameBn: true },
      });

      if (!guardian) {
        throw new Error('NOT_FOUND_GUARDIAN: অভিভাবক পাওয়া যায়নি বা এই স্কুলের অন্তর্ভুক্ত নয়।');
      }

      // Step 17 & 18: Atomic Primary Guardian Concurrency Serialization
      // Acquire row lock on the student row to prevent concurrent race conditions
      if (data.isPrimary) {
        await tx.$executeRaw`SELECT id FROM students WHERE id = ${data.studentId}::uuid AND school_id = ${schoolId}::uuid FOR UPDATE`;

        // Demote existing primary guardian(s) for this student
        await tx.studentGuardian.updateMany({
          where: {
            schoolId,
            studentId: data.studentId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Optional: sync relationshipType on guardian if provided and desired
      if (data.relationshipType) {
        await tx.guardian.update({
          where: { id: data.guardianId },
          data: { relationType: data.relationshipType },
        });
      }

      // Create relationship
      const created = await tx.studentGuardian.create({
        data: {
          schoolId,
          studentId: data.studentId,
          guardianId: data.guardianId,
          isPrimary: data.isPrimary,
          isFinancialPayer: data.isFinancialPayer,
          canPickUp: data.canPickUp,
        },
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              fullNameEn: true,
              fullNameBn: true,
            },
          },
          guardian: {
            select: {
              id: true,
              fullNameEn: true,
              fullNameBn: true,
              relationType: true,
              phone: true,
            },
          },
        },
      });

      return created;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'INSERT',
      entity: 'StudentGuardian',
      entityId: relationship.id,
      afterState: {
        studentId: relationship.studentId,
        guardianId: relationship.guardianId,
        isPrimary: relationship.isPrimary,
        isFinancialPayer: relationship.isFinancialPayer,
        canPickUp: relationship.canPickUp,
      },
      changeSummary: `Linked student ${relationship.student.studentCode} with guardian ${relationship.guardian.fullNameEn} (Primary: ${relationship.isPrimary})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: relationship,
        message: 'শিক্ষার্থীর সাথে অভিভাবক সফলভাবে সংযুক্ত করা হয়েছে।',
      },
      { status: 201 }
    );
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
    if (err.message?.startsWith('NOT_FOUND_STUDENT')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND_STUDENT: ', '') },
        { status: 404 }
      );
    }
    if (err.message?.startsWith('NOT_FOUND_GUARDIAN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND_GUARDIAN: ', '') },
        { status: 404 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'এই শিক্ষার্থীর সাথে এই অভিভাবক ইতিমধ্যে সংযুক্ত রয়েছে।' },
        { status: 409 }
      );
    }

    console.error('POST /api/school/student-guardians error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী-অভিভাবক সংযোগ তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
