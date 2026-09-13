import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { FeeStructureUpdateSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';
import { handleApiError } from '@/lib/api/handle-api-error';

/**
 * GET /api/school/finance/fee-structures/[structureId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ structureId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });
    const { structureId } = await params;

    const structure = await withTenantContext(schoolId, async (tx) => {
      return tx.feeStructure.findFirst({
        where: { id: structureId, schoolId },
        include: {
          feeType: true,
          class: true,
          group: true,
          academicSession: true,
        },
      });
    });

    if (!structure) {
      return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: structure });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/school/finance/fee-structures/[structureId]
 * Update fee structure (amount, status, etc.).
 * Note: Historical invoices already generated remain untouched.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ structureId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'FEES_UPDATE',
    });
    const { structureId } = await params;

    const existing = await withTenantContext(schoolId, async (tx) => {
      return tx.feeStructure.findFirst({
        where: { id: structureId, schoolId },
      });
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = FeeStructureUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.feeStructure.update({
        where: { id: structureId },
        data: {
          amount: data.amount !== undefined ? data.amount : undefined,
          frequency: data.frequency || undefined,
          dueDayOfMonth: data.dueDayOfMonth !== undefined ? data.dueDayOfMonth : undefined,
          lateFineAmount: data.lateFineAmount !== undefined ? data.lateFineAmount : undefined,
          status: data.status || undefined,
        },
        include: {
          feeType: true,
          class: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.UPDATE,
      entity: 'FeeStructure',
      entityId: structureId,
      beforeState: existing,
      afterState: updated,
      changeSummary: `Updated fee structure ${updated.feeType.nameEn} for ${updated.class.nameEn}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
