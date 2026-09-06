import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_VIEW' });

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const deliveryStatus = searchParams.get('status');
    const campaignId = searchParams.get('campaignId');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    return await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (channel) where.channel = channel;
      if (deliveryStatus) where.deliveryStatus = deliveryStatus;
      if (campaignId) where.campaignId = campaignId;

      const [total, deliveries] = await Promise.all([
        tx.messageLog.count({ where }),
        tx.messageLog.findMany({
          where,
          include: {
            student: { select: { id: true, studentCode: true, fullNameEn: true } },
            guardian: { select: { id: true, fullNameEn: true, phone: true } },
            campaign: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          total,
          limit,
          offset,
          deliveries,
        },
      });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
