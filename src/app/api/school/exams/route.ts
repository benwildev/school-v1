import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ExamCreateSchema } from '@/lib/validation/exam';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/exams
 * List exams for the authenticated school
 * Required Permission: ACADEMICS_VIEW or MARKS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const academicSessionId = searchParams.get('academicSessionId');
    const status = searchParams.get('status') as any;

    const where: any = { schoolId };
    if (academicSessionId) where.academicSessionId = academicSessionId;
    if (status) where.status = status;

    const exams = await prisma.exam.findMany({
      where,
      include: {
        academicSession: { select: { id: true, name: true } },
        _count: {
          select: {
            schedules: true,
            marks: true,
            results: true,
          },
        },
      },
      orderBy: [
        { startDate: 'desc' },
        { nameEn: 'asc' },
      ],
    });

    return NextResponse.json({ data: exams });
  } catch (error: any) {
    console.error('Error fetching exams:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school/exams
 * Create a new examination
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_CREATE',
    });

    const body = await request.json();
    const parseResult = ExamCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify session belongs to this school
    const session = await prisma.academicSession.findFirst({
      where: { id: data.academicSessionId, schoolId },
    });
    if (!session) {
      return NextResponse.json({ error: 'Academic session not found in this school' }, { status: 404 });
    }

    // Uniqueness check: nameEn in session
    const existing = await prisma.exam.findFirst({
      where: {
        schoolId,
        academicSessionId: data.academicSessionId,
        nameEn: { equals: data.nameEn, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An exam with this name already exists in this academic session' },
        { status: 409 }
      );
    }

    const exam = await withTenantContext(schoolId, async (tx) => {
      return await tx.exam.create({
        data: {
          schoolId,
          academicSessionId: data.academicSessionId,
          nameEn: data.nameEn,
          nameBn: data.nameBn,
          examType: data.examType,
          term: data.term,
          weightagePercentage: data.weightagePercentage,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status: data.status,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'Exam',
      entityId: exam.id,
      afterState: {
        nameEn: exam.nameEn,
        examType: exam.examType,
        term: exam.term,
        status: exam.status,
      },
      changeSummary: `Created exam "${exam.nameEn}" (${exam.nameBn})`,
    });

    return NextResponse.json({ success: true, data: exam }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating exam:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
