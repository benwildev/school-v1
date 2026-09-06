import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateLibraryPublisherSchema } from '@/lib/validation/library';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const publishers = await withTenantContext(schoolId, async (tx) => {
      return tx.libraryPublisher.findMany({
        where: { schoolId },
        include: {
          _count: { select: { books: true } },
        },
        orderBy: { nameEn: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: publishers });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });

    const body = await request.json();
    const parsed = CreateLibraryPublisherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { nameEn, nameBn, address, contactPhone } = parsed.data;

    const publisher = await withTenantContext(schoolId, async (tx) => {
      return tx.libraryPublisher.create({
        data: {
          schoolId,
          nameEn,
          nameBn: nameBn || null,
          address: address || null,
          contactPhone: contactPhone || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: publisher }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
