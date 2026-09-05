import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { CommunicationBulkSendSchema } from '@/lib/validation/communication';
import { checkBulkCampaignThrottle } from '@/lib/security/communication-throttle';
import { processBulkCampaign, CampaignRecipient } from '@/lib/communication/campaign-engine';

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_BULK_SEND' });

    const body = await request.json();
    const validated = CommunicationBulkSendSchema.parse(body);

    // 1. Rate limiting check
    const throttleRes = await checkBulkCampaignThrottle(schoolId);
    if (!throttleRes.isAllowed) {
      return NextResponse.json(
        { error: `Bulk campaign rate limit reached. Please retry in ${throttleRes.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    return await withTenantContext(schoolId, async () => {
      // 2. Idempotency safeguard
      const existingCampaign = await prisma.communicationCampaign.findUnique({
        where: {
          schoolId_idempotencyKey: {
            schoolId,
            idempotencyKey: validated.idempotencyKey,
          },
        },
      });

      if (existingCampaign) {
        return NextResponse.json(
          { error: `Campaign with idempotency key '${validated.idempotencyKey}' has already been created/processed.` },
          { status: 409 }
        );
      }

      // 3. Resolve template or custom body
      let templateText = validated.customBody || '';
      if (validated.templateId) {
        const tpl = await prisma.notificationTemplate.findFirst({
          where: { id: validated.templateId, schoolId },
        });
        if (tpl) {
          templateText = tpl.templateBn || tpl.templateEn;
        }
      }

      if (!templateText) {
        return NextResponse.json({ error: 'Either customBody or a valid templateId is required' }, { status: 400 });
      }

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      const schoolName = school?.nameEn || 'EduSmart BD';

      // 4. Resolve Recipients
      const recipients: CampaignRecipient[] = [];

      if (validated.targetAudience === 'ALL_STUDENTS') {
        const students = await prisma.student.findMany({
          where: { schoolId, status: 'ACTIVE', deletedAt: null },
          select: { id: true, fullNameEn: true, phone: true },
        });
        for (const s of students) {
          recipients.push({ recipientId: s.id, name: s.fullNameEn, phone: s.phone || undefined });
        }
      } else if (validated.targetAudience === 'ALL_GUARDIANS') {
        const guardians = await prisma.guardian.findMany({
          where: { schoolId },
          select: { id: true, fullNameEn: true, phone: true, email: true },
        });
        for (const g of guardians) {
          recipients.push({ recipientId: g.id, name: g.fullNameEn, phone: g.phone || undefined, email: g.email || undefined });
        }
      } else if (validated.targetAudience === 'ALL_STAFF') {
        const staff = await prisma.employee.findMany({
          where: { schoolId, status: 'ACTIVE', deletedAt: null },
          select: { id: true, fullNameEn: true, phone: true, email: true },
        });
        for (const e of staff) {
          recipients.push({ recipientId: e.id, name: e.fullNameEn, phone: e.phone || undefined, email: e.email || undefined });
        }
      } else if (validated.targetAudience === 'CLASS' && validated.targetFilter.classId) {
        const enrollments = await prisma.enrollment.findMany({
          where: { schoolId, classId: validated.targetFilter.classId, status: 'ACTIVE' },
          include: { student: { select: { id: true, fullNameEn: true, phone: true } } },
        });
        for (const enr of enrollments) {
          recipients.push({ recipientId: enr.student.id, name: enr.student.fullNameEn, phone: enr.student.phone || undefined });
        }
      } else if (validated.targetAudience === 'SECTION' && validated.targetFilter.sectionId) {
        const enrollments = await prisma.enrollment.findMany({
          where: { schoolId, sectionId: validated.targetFilter.sectionId, status: 'ACTIVE' },
          include: { student: { select: { id: true, fullNameEn: true, phone: true } } },
        });
        for (const enr of enrollments) {
          recipients.push({ recipientId: enr.student.id, name: enr.student.fullNameEn, phone: enr.student.phone || undefined });
        }
      } else if (validated.targetAudience === 'CUSTOM' && validated.targetFilter.recipientIds) {
        const students = await prisma.student.findMany({
          where: { schoolId, id: { in: validated.targetFilter.recipientIds } },
          select: { id: true, fullNameEn: true, phone: true },
        });
        for (const s of students) {
          recipients.push({ recipientId: s.id, name: s.fullNameEn, phone: s.phone || undefined });
        }
      }

      // 5. Create Campaign Record
      const campaign = await prisma.communicationCampaign.create({
        data: {
          schoolId,
          name: validated.name,
          channel: validated.channel,
          targetAudience: validated.targetAudience,
          targetFilter: validated.targetFilter,
          templateId: validated.templateId,
          customBody: validated.customBody,
          totalRecipients: recipients.length,
          status: 'PROCESSING',
          idempotencyKey: validated.idempotencyKey,
          createdById: context.userId,
        },
      });

      // 6. Execute Chunked Dispatch
      const dispatchResult = await processBulkCampaign({
        campaignId: campaign.id,
        schoolId,
        channel: validated.channel as any,
        recipients,
        templateText,
        schoolName,
        chunkSize: 50,
      });

      // 7. Insert Message Logs
      if (dispatchResult.logs.length > 0) {
        await prisma.messageLog.createMany({
          data: dispatchResult.logs.map((l) => ({
            schoolId,
            campaignId: campaign.id,
            channel: validated.channel,
            recipientPhone: l.phone,
            recipientEmail: l.email,
            messageBody: l.renderedText,
            messageType: 'GENERAL_NOTICE',
            provider: 'BULK_DISPATCHER',
            providerMessageId: l.providerMessageId,
            deliveryStatus: l.deliveryStatus as any,
            failureReason: l.failureReason,
            sentAt: l.deliveryStatus === 'SENT' ? new Date() : null,
          })),
        });
      }

      // 8. Finalize Campaign
      const updatedCampaign = await prisma.communicationCampaign.update({
        where: { id: campaign.id },
        data: {
          sentCount: dispatchResult.sent,
          failedCount: dispatchResult.failed,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: AuditAction.INSERT,
        entity: 'CommunicationCampaign',
        entityId: campaign.id,
        changeSummary: `Dispatched bulk campaign "${campaign.name}" to ${recipients.length} recipients. Sent: ${dispatchResult.sent}, Failed: ${dispatchResult.failed}`,
      });

      return NextResponse.json({
        success: true,
        data: {
          campaign: updatedCampaign,
          summary: {
            totalRecipients: recipients.length,
            sent: dispatchResult.sent,
            failed: dispatchResult.failed,
          },
        },
      });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
