import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateLibrarySettingsSchema } from '@/lib/validation/library';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const settings = await withTenantContext(schoolId, async (tx) => {
      let current = await tx.librarySetting.findUnique({
        where: { schoolId },
      });

      if (!current) {
        current = await tx.librarySetting.create({
          data: { schoolId },
        });
      }

      return current;
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_UPDATE' });

    const body = await request.json();
    const parsed = UpdateLibrarySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.librarySetting.upsert({
        where: { schoolId },
        create: {
          schoolId,
          ...parsed.data,
        },
        update: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
