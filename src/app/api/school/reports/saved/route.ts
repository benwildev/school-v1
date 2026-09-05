import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SaveReportSchema = z.object({
  reportId: z.string().min(1),
  name: z.string().min(1).max(200),
  nameBn: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  filters: z.record(z.string(), z.any()).default({}),
  columns: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
  isPinned: z.boolean().default(false),
});


/**
 * GET /api/school/reports/saved
 * Retrieves saved report presets for the authenticated user and active school.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    const savedReports = await prisma.savedReport.findMany({
      where: {
        schoolId,
        userId: context.userId,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      data: savedReports,
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school/reports/saved
 * Saves a customized report preset.
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);
    const body = await request.json();

    const parsed = SaveReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { reportId, name, nameBn, description, filters, columns, sortBy, sortOrder, isPinned } = parsed.data;

    const savedReport = await prisma.savedReport.create({
      data: {
        schoolId,
        userId: context.userId,
        reportId,
        name,
        nameBn: nameBn || null,
        description: description || null,
        filters: filters as any,
        columns: columns ? columns : undefined,
        sortBy: sortBy || null,
        sortOrder,
        isPinned,
      },
    });


    return NextResponse.json({
      success: true,
      data: savedReport,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
