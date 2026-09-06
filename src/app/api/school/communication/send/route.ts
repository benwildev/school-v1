import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CommunicationSendSchema } from '@/lib/validation/communication';
import { CommunicationProviderRegistry } from '@/lib/communication/provider-abstraction';
import { checkMessageSendThrottle } from '@/lib/security/communication-throttle';
import { normalizeBangladeshiPhone } from '@/lib/communication/phone-normalization';

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_SEND' });

    const body = await request.json();
    const validated = CommunicationSendSchema.parse(body);

    // 1. Rate limiting check
    const throttleRes = await checkMessageSendThrottle(schoolId, validated.channel);
    if (!throttleRes.isAllowed) {
      return NextResponse.json(
        { error: `Communication rate limit exceeded. Please retry in ${throttleRes.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    return await withTenantContext(schoolId, async (tx) => {
      // 2. Idempotency safeguard
      if (validated.idempotencyKey) {
        const existingLog = await tx.messageLog.findFirst({
          where: { schoolId, idempotencyKey: validated.idempotencyKey },
        });

        if (existingLog) {
          return NextResponse.json({
            success: true,
            data: existingLog,
            isIdempotentReplay: true,
          });
        }
      }

      let deliveryStatus: 'SENT' | 'FAILED' | 'QUEUED' = 'SENT';
      let providerName = 'SYSTEM_IN_APP';
      let providerMessageId: string | undefined;
      let failureReason: string | undefined;
      let smsCount = 1;

      // 3. Dispatch through provider abstraction
      if (validated.channel === 'SMS') {
        if (!validated.recipientPhone) {
          return NextResponse.json({ error: 'recipientPhone is required for SMS channel' }, { status: 400 });
        }

        const phoneRes = normalizeBangladeshiPhone(validated.recipientPhone);
        if (!phoneRes.isValid) {
          return NextResponse.json({ error: phoneRes.error }, { status: 400 });
        }

        const provider = CommunicationProviderRegistry.getSmsProvider();
        providerName = provider.name;

        const sendRes = await provider.sendSms({
          to: phoneRes.normalizedPhone!,
          message: validated.messageBody,
          schoolId,
          idempotencyKey: validated.idempotencyKey || undefined,
        });

        deliveryStatus = sendRes.deliveryStatus === 'SENT' ? 'SENT' : 'FAILED';
        providerMessageId = sendRes.providerMessageId;
        failureReason = sendRes.failureReason;
        smsCount = sendRes.smsCount || 1;
      } else if (validated.channel === 'EMAIL') {
        if (!validated.recipientEmail) {
          return NextResponse.json({ error: 'recipientEmail is required for EMAIL channel' }, { status: 400 });
        }

        const provider = CommunicationProviderRegistry.getEmailProvider();
        providerName = provider.name;

        const sendRes = await provider.sendEmail({
          to: validated.recipientEmail,
          subject: 'School Notification',
          html: `<p>${validated.messageBody}</p>`,
          text: validated.messageBody,
          schoolId,
          idempotencyKey: validated.idempotencyKey || undefined,
        });

        deliveryStatus = sendRes.deliveryStatus === 'SENT' ? 'SENT' : 'FAILED';
        providerMessageId = sendRes.providerMessageId;
        failureReason = sendRes.failureReason;
      } else if (validated.channel === 'WHATSAPP') {
        if (!validated.recipientPhone) {
          return NextResponse.json({ error: 'recipientPhone is required for WHATSAPP channel' }, { status: 400 });
        }

        const provider = CommunicationProviderRegistry.getWhatsAppProvider();
        providerName = provider.name;

        const sendRes = await provider.sendWhatsApp({
          to: validated.recipientPhone,
          templateName: 'general_notice',
          languageCode: 'bn',
          parameters: [{ type: 'text', text: validated.messageBody }],
          schoolId,
          idempotencyKey: validated.idempotencyKey || undefined,
        });

        deliveryStatus = sendRes.deliveryStatus === 'SENT' ? 'SENT' : 'FAILED';
        providerMessageId = sendRes.providerMessageId;
        failureReason = sendRes.failureReason;
      } else if (validated.channel === 'IN_APP') {
        if (validated.userId) {
          await tx.notification.create({
            data: {
              schoolId,
              userId: validated.userId,
              title: 'Institutional Notice',
              message: validated.messageBody,
              type: validated.messageType,
              metadata: validated.metadata,
            },
          });
        }
      }

      // 4. Log message dispatch in message_logs
      const log = await tx.messageLog.create({
        data: {
          schoolId,
          channel: validated.channel,
          recipientPhone: validated.recipientPhone,
          recipientEmail: validated.recipientEmail,
          studentId: validated.studentId,
          guardianId: validated.guardianId,
          messageBody: validated.messageBody,
          messageType: validated.messageType,
          smsCount,
          provider: providerName,
          providerMessageId,
          deliveryStatus: deliveryStatus as any,
          failureReason,
          sentAt: deliveryStatus === 'SENT' ? new Date() : null,
          templateId: validated.templateId,
          idempotencyKey: validated.idempotencyKey,
          metadata: validated.metadata,
        },
      });

      return NextResponse.json({
        success: deliveryStatus === 'SENT',
        data: log,
      }, { status: deliveryStatus === 'SENT' ? 200 : 502 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
