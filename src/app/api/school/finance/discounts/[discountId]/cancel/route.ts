import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';

const DiscountCancelSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required').max(500),
});

/**
 * POST /api/school/finance/discounts/[discountId]/cancel
 * Required Permission: DISCOUNTS_CANCEL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'DISCOUNTS_CANCEL',
    });
    const { discountId } = await params;

    const existing = await prisma.studentDiscount.findFirst({
      where: { id: discountId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Discount is already cancelled' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = DiscountCancelSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reason } = parseResult.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.studentDiscount.update({
        where: { id: discountId },
        data: {
          status: 'CANCELLED',
          cancelledById: context.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
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
      changeSummary: `Cancelled student discount ${discountId}. Reason: ${reason}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
