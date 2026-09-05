import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateLibraryCategorySchema } from '@/lib/validation/library';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const categories = await withTenantContext(schoolId, async () => {
      return prisma.libraryCategory.findMany({
        where: { schoolId },
        include: {
          _count: { select: { books: true } },
        },
        orderBy: { nameEn: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });

    const body = await request.json();
    const parsed = CreateLibraryCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { code, nameEn, nameBn, description } = parsed.data;

    const category = await withTenantContext(schoolId, async () => {
      const existing = await prisma.libraryCategory.findFirst({
        where: { schoolId, code },
      });
      if (existing) {
        throw new Error(`Category code "${code}" already exists in this school.`);
      }

      return prisma.libraryCategory.create({
        data: {
          schoolId,
          code,
          nameEn,
          nameBn,
          description: description || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
