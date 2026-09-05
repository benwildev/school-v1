import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { FeeTypeCreateSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/fee-types
 * List configurable fee categories/types for the school
 * Required Permission: FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });

    const feeTypes = await prisma.feeType.findMany({
      where: { schoolId },
      orderBy: { nameEn: 'asc' },
    });

    return NextResponse.json({ success: true, data: feeTypes });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/school/finance/fee-types
 * Create a new fee type/category (e.g. TUITION_FEE, EXAM_FEE)
 * Required Permission: FEES_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'FEES_CREATE',
    });

    const body = await request.json();
    const parseResult = FeeTypeCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Check duplicate code
    const existing = await prisma.feeType.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code: data.code,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Fee type with code "${data.code}" already exists in this school.` },
        { status: 409 }
      );
    }

    const feeType = await withTenantContext(schoolId, async (tx) => {
      return tx.feeType.create({
        data: {
          schoolId,
          code: data.code,
          nameEn: data.nameEn,
          nameBn: data.nameBn,
          description: data.description,
          isRecurring: data.isRecurring,
          isRefundable: data.isRefundable,
          status: data.status,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'FeeType',
      entityId: feeType.id,
      afterState: feeType,
      changeSummary: `Created fee type ${feeType.nameEn} (${feeType.code})`,
    });

    return NextResponse.json({ success: true, data: feeType }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
