import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WebhookCallbackSchema } from '@/lib/validation/communication';
import { CommunicationProviderRegistry } from '@/lib/communication/provider-abstraction';
import { checkWebhookThrottle } from '@/lib/security/communication-throttle';
import { getCommunicationWebhookSecret } from '@/lib/env';

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

    const upperProvider = provider.toUpperCase();
    if (process.env.NODE_ENV === 'production' && upperProvider.startsWith('MOCK_')) {
      return NextResponse.json(
        { error: 'Mock communication providers are disabled in production environment.' },
        { status: 403 }
      );
    }

    // 2. Signature verification
    const webhookSecret = getCommunicationWebhookSecret();
    let isSignatureValid = false;
    if (upperProvider === 'SMS' || upperProvider === 'MOCK_SMS') {
      const smsProvider = CommunicationProviderRegistry.getSmsProvider();
      if (smsProvider.verifyWebhookSignature) {
        isSignatureValid = smsProvider.verifyWebhookSignature(signature, rawBodyText, webhookSecret);
      } else {
        isSignatureValid = process.env.NODE_ENV !== 'production';
      }
    } else if (upperProvider === 'WHATSAPP' || upperProvider === 'MOCK_WHATSAPP') {
      const waProvider = CommunicationProviderRegistry.getWhatsAppProvider();
      if (waProvider.verifyWebhookSignature) {
        isSignatureValid = waProvider.verifyWebhookSignature(signature, rawBodyText, webhookSecret);
      } else {
        isSignatureValid = process.env.NODE_ENV !== 'production';
      }
    } else if (upperProvider === 'EMAIL' || upperProvider === 'MOCK_EMAIL') {
      const emailProvider = CommunicationProviderRegistry.getEmailProvider();
      if (emailProvider.verifyWebhookSignature) {
        isSignatureValid = emailProvider.verifyWebhookSignature(signature, rawBodyText, webhookSecret);
      } else {
        isSignatureValid = process.env.NODE_ENV !== 'production';
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
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
