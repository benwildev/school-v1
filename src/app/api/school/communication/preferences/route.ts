import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { NotificationPreferenceUpdateSchema } from '@/lib/validation/communication';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    return await withTenantContext(schoolId, async (tx) => {
      let pref = await tx.notificationPreference.findUnique({
        where: {
          schoolId_userId: {
            schoolId,
            userId: context.userId,
          },
        },
      });

      if (!pref) {
        pref = await tx.notificationPreference.create({
          data: {
            schoolId,
            userId: context.userId,
          },
        });
      }

      return NextResponse.json({ success: true, data: pref });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    const body = await request.json();
    const validated = NotificationPreferenceUpdateSchema.parse(body);

    return await withTenantContext(schoolId, async (tx) => {
      const updated = await tx.notificationPreference.upsert({
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
  } catch (error) {
    return handleApiError(error);
  }
}
