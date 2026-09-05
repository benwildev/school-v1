import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentDiscountUpdateSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/discounts/[discountId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'DISCOUNTS_VIEW',
    });
    const { discountId } = await params;

    const discount = await prisma.studentDiscount.findFirst({
      where: { id: discountId, schoolId },
      include: {
        student: true,
        feeType: true,
        authorizedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!discount) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: discount });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/school/finance/discounts/[discountId]
 * Required Permission: DISCOUNTS_UPDATE
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'DISCOUNTS_UPDATE',
    });
    const { discountId } = await params;

    const existing = await prisma.studentDiscount.findFirst({
      where: { id: discountId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = StudentDiscountUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    if (data.discountType === 'PERCENTAGE' && data.discountValue && data.discountValue > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.studentDiscount.update({
        where: { id: discountId },
        data: {
          discountCategory: data.discountCategory || undefined,
          discountType: data.discountType || undefined,
          discountValue: data.discountValue !== undefined ? data.discountValue : undefined,
          frequency: data.frequency || undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          reason: data.reason || undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.UPDATE,
      entity: 'StudentDiscount',
      entityId: discountId,
      beforeState: existing,
      afterState: updated,
      changeSummary: `Updated student discount ${discountId}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
