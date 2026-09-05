import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WebhookCallbackSchema } from '@/lib/validation/communication';
import { CommunicationProviderRegistry } from '@/lib/communication/provider-abstraction';
import { checkWebhookThrottle } from '@/lib/security/communication-throttle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // 1. IP extraction & rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const throttleRes = await checkWebhookThrottle(ip);
    if (!throttleRes.isAllowed) {
      return NextResponse.json(
        { error: 'Webhook rate limit exceeded.' },
        { status: 429 }
      );
    }

    const rawBodyText = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || request.headers.get('x-provider-signature') || '';

    // 2. Signature verification
    const webhookSecret = process.env.COMMUNICATION_WEBHOOK_SECRET || 'edusmart-webhook-secret-salt-2026';
    let isSignatureValid = false;

    if (provider.toUpperCase() === 'SMS' || provider.toUpperCase() === 'MOCK_SMS') {
      const smsProvider = CommunicationProviderRegistry.getSmsProvider();
      if (smsProvider.verifyWebhookSignature) {
        isSignatureValid = smsProvider.verifyWebhookSignature(signature, rawBodyText, webhookSecret);
      } else {
        isSignatureValid = true; // Provider does not enforce HMAC
      }
    } else if (provider.toUpperCase() === 'WHATSAPP' || provider.toUpperCase() === 'MOCK_WHATSAPP') {
      const waProvider = CommunicationProviderRegistry.getWhatsAppProvider();
      if (waProvider.verifyWebhookSignature) {
        isSignatureValid = waProvider.verifyWebhookSignature(signature, rawBodyText, webhookSecret);
      } else {
        isSignatureValid = true;
      }
    } else {
      isSignatureValid = true;
    }

    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // 3. Parse payload
    let body: any = {};
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validated = WebhookCallbackSchema.parse(body);

    // 4. Look up message log by providerMessageId
    const messageLog = await prisma.messageLog.findFirst({
      where: { providerMessageId: validated.providerMessageId },
    });

    if (!messageLog) {
      // Return 200 OK so provider stops retrying unknown message IDs
      return NextResponse.json({ success: true, message: 'Message ID not found in system logs; ignored' });
    }

    // 5. Idempotency safeguard: if already in final state (DELIVERED), skip
    if (messageLog.deliveryStatus === 'DELIVERED') {
      return NextResponse.json({
        success: true,
        message: 'Message already marked as delivered; idempotent skip',
        deliveryStatus: messageLog.deliveryStatus,
      });
    }

    // 6. Update message delivery status
    const updated = await prisma.messageLog.update({
      where: { id: messageLog.id },
      data: {
        deliveryStatus: validated.deliveryStatus,
        failureReason: validated.failureReason || messageLog.failureReason,
        metadata: {
          ...((messageLog.metadata as Record<string, any>) || {}),
          webhookCallbackReceivedAt: new Date().toISOString(),
          webhookRaw: validated.rawEvent || {},
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery status updated',
      data: {
        id: updated.id,
        deliveryStatus: updated.deliveryStatus,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
