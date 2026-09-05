import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireActiveSchool, requirePermission } from '@/lib/authorization/engine';
import { z } from 'zod';
import { MessageType } from '@prisma/client';

const MarkReadSchema = z.object({
  notificationId: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

const CreateNotificationSchema = z.object({
  recipientUserId: z.string().uuid(),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  linkUrl: z.string().max(500).optional().nullable(),
  type: z.nativeEnum(MessageType).default(MessageType.GENERAL_NOTICE),
  metadata: z.record(z.string(), z.any()).default({}),
});

export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    return await withTenantContext(schoolId, async () => {
      const where: any = {
        schoolId,
        userId: context.userId,
      };
      if (unreadOnly) where.isRead = false;

      const [unreadCount, notifications] = await Promise.all([
        prisma.notification.count({ where: { schoolId, userId: context.userId, isRead: false } }),
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          unreadCount,
          notifications,
        },
      });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    const body = await request.json();
    const validated = MarkReadSchema.parse(body);

    return await withTenantContext(schoolId, async () => {
      if (validated.markAll) {
        const res = await prisma.notification.updateMany({
          where: { schoolId, userId: context.userId, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        return NextResponse.json({ success: true, updatedCount: res.count });
      }

      if (validated.notificationId) {
        const notif = await prisma.notification.findFirst({
          where: { id: validated.notificationId, schoolId, userId: context.userId },
        });

        if (!notif) {
          return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }

        const updated = await prisma.notification.update({
          where: { id: notif.id },
          data: { isRead: true, readAt: new Date() },
        });

        return NextResponse.json({ success: true, data: updated });
      }

      return NextResponse.json({ error: 'Either notificationId or markAll is required' }, { status: 400 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_CREATE' });

    const body = await request.json();
    const validated = CreateNotificationSchema.parse(body);

    return await withTenantContext(schoolId, async () => {
      const notif = await prisma.notification.create({
        data: {
          schoolId,
          userId: validated.recipientUserId,
          title: validated.title,
          message: validated.message,
          linkUrl: validated.linkUrl,
          type: validated.type,
          metadata: validated.metadata,
          actorId: context.userId,
        },
      });

      return NextResponse.json({ success: true, data: notif }, { status: 201 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
