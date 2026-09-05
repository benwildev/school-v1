import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateLibraryAuthorSchema } from '@/lib/validation/library';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const authors = await withTenantContext(schoolId, async () => {
      return prisma.libraryAuthor.findMany({
        where: { schoolId },
        include: {
          _count: { select: { books: true } },
        },
        orderBy: { nameEn: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: authors });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });

    const body = await request.json();
    const parsed = CreateLibraryAuthorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { nameEn, nameBn, bio } = parsed.data;

    const author = await withTenantContext(schoolId, async () => {
      return prisma.libraryAuthor.create({
        data: {
          schoolId,
          nameEn,
          nameBn: nameBn || null,
          bio: bio || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: author }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
