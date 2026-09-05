import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { FeeStructureCreateSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/fee-structures
 * List fee structures filtered by session, class, fee type
 * Required Permission: FEES_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'FEES_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const academicSessionId = searchParams.get('academicSessionId');
    const classId = searchParams.get('classId');
    const feeTypeId = searchParams.get('feeTypeId');
    const status = searchParams.get('status') as any;

    const where: any = { schoolId };
    if (academicSessionId) where.academicSessionId = academicSessionId;
    if (classId) where.classId = classId;
    if (feeTypeId) where.feeTypeId = feeTypeId;
    if (status) where.status = status;

    const structures = await prisma.feeStructure.findMany({
      where,
      include: {
        feeType: true,
        class: true,
        group: true,
        academicSession: true,
      },
      orderBy: [{ class: { nameEn: 'asc' } }, { feeType: { nameEn: 'asc' } }],
    });

    return NextResponse.json({ success: true, data: structures });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/school/finance/fee-structures
 * Create a new fee structure
 * Required Permission: FEES_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'FEES_CREATE',
    });

    const body = await request.json();
    const parseResult = FeeStructureCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify session, class, feeType belong to school
    const [session, classObj, feeType] = await Promise.all([
      prisma.academicSession.findFirst({
        where: { id: data.academicSessionId, schoolId },
      }),
      prisma.class.findFirst({
        where: { id: data.classId, schoolId },
      }),
      prisma.feeType.findFirst({
        where: { id: data.feeTypeId, schoolId },
      }),
    ]);

    if (!session) {
      return NextResponse.json({ error: 'Academic session not found' }, { status: 404 });
    }
    if (!classObj) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (!feeType) {
      return NextResponse.json({ error: 'Fee type not found' }, { status: 404 });
    }

    // Check duplicate structure
    const existing = await prisma.feeStructure.findFirst({
      where: {
        schoolId,
        academicSessionId: data.academicSessionId,
        classId: data.classId,
        feeTypeId: data.feeTypeId,
        groupId: data.groupId || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A fee structure for this fee type, session, and class already exists.' },
        { status: 409 }
      );
    }

    const structure = await withTenantContext(schoolId, async (tx) => {
      return tx.feeStructure.create({
        data: {
          schoolId,
          academicSessionId: data.academicSessionId,
          feeTypeId: data.feeTypeId,
          classId: data.classId,
          groupId: data.groupId || null,
          amount: data.amount,
          frequency: data.frequency,
          dueDayOfMonth: data.dueDayOfMonth,
          lateFineAmount: data.lateFineAmount,
          status: data.status,
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
      action: AuditAction.INSERT,
      entity: 'FeeStructure',
      entityId: structure.id,
      afterState: structure,
      changeSummary: `Created fee structure ${feeType.nameEn} for ${classObj.nameEn}: ${data.amount} BDT`,
    });

    return NextResponse.json({ success: true, data: structure }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
