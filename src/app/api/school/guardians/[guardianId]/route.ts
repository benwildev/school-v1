import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { GuardianUpdateSchema } from '@/lib/validation/guardian';
import { Prisma } from '@prisma/client';

interface RouteContext {
  params: Promise<{ guardianId: string }>;
}

async function requireGuardianPermission(req: NextRequest, action: 'VIEW' | 'UPDATE' | 'DELETE') {
  try {
    return await requirePermission(req, { permission: `GUARDIANS_${action}` });
  } catch {
    return await requirePermission(req, { permission: `STUDENTS_${action}` });
  }
}

/**
 * GET /api/school/guardians/[guardianId]
 * Retrieve detailed guardian profile and safe info for linked students.
 * Required Permission: GUARDIANS_VIEW or STUDENTS_VIEW
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { guardianId } = await params;
    const { schoolId } = await requireGuardianPermission(request, 'VIEW');

    const guardian = await withTenantContext(schoolId, async (tx) => {
      return tx.guardian.findFirst({
        where: {
          id: guardianId,
          schoolId,
        },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          fullNameEn: true,
          fullNameBn: true,
          relationType: true,
          nationalId: true,
          phone: true,
          alternatePhone: true,
          email: true,
          occupation: true,
          monthlyIncome: true,
          educationLevel: true,
          photoUrl: true,
          address: true,
          createdAt: true,
          updatedAt: true,
          students: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              isPrimary: true,
              isFinancialPayer: true,
              canPickUp: true,
              createdAt: true,
              student: {
                select: {
                  id: true,
                  studentCode: true,
                  fullNameEn: true,
                  fullNameBn: true,
                  gender: true,
                  status: true,
                  phone: true,
                },
              },
            },
          },
        },
      });
    });

    if (!guardian) {
      return NextResponse.json(
        { success: false, error: 'অভিভাবক পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: guardian,
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

    console.error('GET /api/school/guardians/[guardianId] error:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবকের তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/guardians/[guardianId]
 * Update guardian demographic or contact information.
 * Required Permission: GUARDIANS_UPDATE or STUDENTS_UPDATE
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { guardianId } = await params;
    const { context, schoolId } = await requireGuardianPermission(request, 'UPDATE');

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    // Do NOT allow mutating schoolId or id directly through payload
    if (body.schoolId !== undefined || body.id !== undefined) {
      return NextResponse.json(
        { success: false, error: 'স্কুল আইডি বা অভিভাবক আইডি অপরিবর্তনযোগ্য।' },
        { status: 400 }
      );
    }

    const validation = GuardianUpdateSchema.safeParse(body);
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

    const updatedGuardian = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.guardian.findFirst({
        where: { id: guardianId, schoolId },
      });

      if (!existing) {
        throw new Error('NOT_FOUND: অভিভাবক পাওয়া যায়নি।');
      }

      return tx.guardian.update({
        where: { id: guardianId },
        data: {
          fullNameEn: data.fullNameEn,
          fullNameBn: data.fullNameBn,
          relationType: data.relationType,
          nationalId: data.nationalId !== undefined ? (data.nationalId || null) : undefined,
          phone: data.phone,
          alternatePhone: data.alternatePhone !== undefined ? (data.alternatePhone || null) : undefined,
          email: data.email !== undefined ? (data.email || null) : undefined,
          occupation: data.occupation !== undefined ? (data.occupation || null) : undefined,
          monthlyIncome: data.monthlyIncome !== undefined ? (data.monthlyIncome !== null ? new Prisma.Decimal(data.monthlyIncome) : null) : undefined,
          educationLevel: data.educationLevel !== undefined ? (data.educationLevel || null) : undefined,
          photoUrl: data.photoUrl !== undefined ? (data.photoUrl || null) : undefined,
          address: data.address !== undefined ? (data.address || null) : undefined,
        },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          fullNameEn: true,
          fullNameBn: true,
          relationType: true,
          nationalId: true,
          phone: true,
          alternatePhone: true,
          email: true,
          occupation: true,
          monthlyIncome: true,
          educationLevel: true,
          photoUrl: true,
          address: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'Guardian',
      entityId: updatedGuardian.id,
      afterState: {
        fullNameEn: updatedGuardian.fullNameEn,
        fullNameBn: updatedGuardian.fullNameBn,
        relationType: updatedGuardian.relationType,
        phone: updatedGuardian.phone,
      },
      changeSummary: `Updated guardian ${updatedGuardian.fullNameEn} (${updatedGuardian.phone})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updatedGuardian,
      message: 'অভিভাবকের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।',
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

    console.error('PATCH /api/school/guardians/[guardianId] error:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবকের তথ্য হালনাগাদ করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/guardians/[guardianId]
 * Safe deletion of guardian profile.
 * Required Permission: GUARDIANS_DELETE or STUDENTS_DELETE
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { guardianId } = await params;
    const { context, schoolId } = await requireGuardianPermission(request, 'DELETE');

    const result = await withTenantContext(schoolId, async (tx) => {
      const guardian = await tx.guardian.findFirst({
        where: { id: guardianId, schoolId },
      });

      if (!guardian) {
        throw new Error('NOT_FOUND: অভিভাবক পাওয়া যায়নি।');
      }

      // Check dependencies
      const linkedStudentsCount = await tx.studentGuardian.count({
        where: { guardianId, schoolId },
      });

      if (linkedStudentsCount > 0) {
        return {
          blocked: true,
          guardian,
          reason: `ঐতিহাসিক রেকর্ড বিদ্যমান (${linkedStudentsCount} শিক্ষার্থীর সাথে সংযুক্ত)। সম্পর্ক অপসারণ করার পূর্বে অভিভাবক মোছা যাবে না।`,
        };
      }

      await tx.guardian.delete({
        where: { id: guardianId },
      });

      return {
        blocked: false,
        guardian,
      };
    });

    if (result.blocked) {
      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName || context.user.phone || 'User',
        actorRole: 'ADMIN',
        action: 'DELETE',
        entity: 'Guardian',
        entityId: result.guardian.id,
        changeSummary: `Attempted delete blocked for guardian ${result.guardian.fullNameEn} due to active student links`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.reason,
        },
        { status: 409 }
      );
    }

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'DELETE',
      entity: 'Guardian',
      entityId: result.guardian.id,
      changeSummary: `Deleted guardian ${result.guardian.fullNameEn} (${result.guardian.phone})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'অভিভাবক সফলভাবে মুছে ফেলা হয়েছে।',
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

    console.error('DELETE /api/school/guardians/[guardianId] error:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবক মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
