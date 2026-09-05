import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { NotificationPreferenceUpdateSchema } from '@/lib/validation/communication';

export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    return await withTenantContext(schoolId, async () => {
      let pref = await prisma.notificationPreference.findUnique({
        where: {
          schoolId_userId: {
            schoolId,
            userId: context.userId,
          },
        },
      });

      if (!pref) {
        pref = await prisma.notificationPreference.create({
          data: {
            schoolId,
            userId: context.userId,
          },
        });
      }

      return NextResponse.json({ success: true, data: pref });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    const body = await request.json();
    const validated = NotificationPreferenceUpdateSchema.parse(body);

    return await withTenantContext(schoolId, async () => {
      const updated = await prisma.notificationPreference.upsert({
        where: {
          schoolId_userId: {
            schoolId,
            userId: context.userId,
          },
        },
        create: {
          schoolId,
          userId: context.userId,
          ...validated,
        },
        update: validated,
      });

      return NextResponse.json({ success: true, data: updated });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
