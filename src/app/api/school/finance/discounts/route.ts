import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentDiscountCreateSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/discounts
 * List student discounts & scholarships
 * Required Permission: DISCOUNTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'DISCOUNTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const feeTypeId = searchParams.get('feeTypeId');
    const status = searchParams.get('status') as any;

    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    if (feeTypeId) where.feeTypeId = feeTypeId;
    if (status) where.status = status;

    const discounts = await prisma.studentDiscount.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
        feeType: true,
        authorizedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: discounts });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/school/finance/discounts
 * Authorize and create a student-specific discount or scholarship
 * Required Permission: DISCOUNTS_CREATE (Accountant is VIEW ONLY; blocked from creating)
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'DISCOUNTS_CREATE',
    });

    const body = await request.json();
    const parseResult = StudentDiscountCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Bounds check for percentage
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    // Verify student and enrollment belong to the school
    const [student, enrollment] = await Promise.all([
      prisma.student.findFirst({
        where: { id: data.studentId, schoolId },
      }),
      prisma.enrollment.findFirst({
        where: { id: data.enrollmentId, schoolId, studentId: data.studentId },
      }),
    ]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }
    if (!enrollment) {
      return NextResponse.json(
        { error: 'Enrollment record not found for this student in this school' },
        { status: 404 }
      );
    }

    if (data.feeTypeId) {
      const feeType = await prisma.feeType.findFirst({
        where: { id: data.feeTypeId, schoolId },
      });
      if (!feeType) {
        return NextResponse.json({ error: 'Fee type not found' }, { status: 404 });
      }
    }

    const discount = await withTenantContext(schoolId, async (tx) => {
      return tx.studentDiscount.create({
        data: {
          schoolId,
          studentId: data.studentId,
          enrollmentId: data.enrollmentId,
          feeTypeId: data.feeTypeId || null,
          discountCategory: data.discountCategory,
          discountType: data.discountType,
          discountValue: data.discountValue,
          frequency: data.frequency,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          reason: data.reason,
          notes: data.notes || null,
          status: 'ACTIVE',
          authorizedById: context.userId,
          authorizedAt: new Date(),
        },
        include: {
          student: true,
          feeType: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'StudentDiscount',
      entityId: discount.id,
      afterState: discount,
      changeSummary: `Authorized ${discount.discountCategory} (${discount.discountValue}${discount.discountType === 'PERCENTAGE' ? '%' : ' BDT'}) for student ${student.studentCode}`,
    });

    return NextResponse.json({ success: true, data: discount }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
