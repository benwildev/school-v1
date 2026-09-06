import crypto from 'crypto';
import { normalizeBangladeshiPhone } from './phone-normalization';
import { secureTimingSafeCompare } from '../security/credential-encryption';

export interface SendMessageResult {
  success: boolean;
  deliveryStatus: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  status?: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  provider: string;
  providerMessageId: string;
  smsCount?: number;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface SmsSendOptions {
  to: string; // Recipient phone number
  message: string;
  schoolId?: string;
  senderId?: string; // Approved Masking/Sender ID in Bangladesh (e.g. EDUSMART)
  idempotencyKey?: string;
}

export interface SmsProvider {
  name: string;
  sendSms(options: SmsSendOptions): Promise<SendMessageResult>;
  getDeliveryStatus?(messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }>;
  verifyWebhookSignature?(signature: string, payload: string, secret: string): boolean;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  schoolId?: string;
  idempotencyKey?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(options: EmailSendOptions): Promise<SendMessageResult>;
  getDeliveryStatus?(messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }>;
  verifyWebhookSignature?(signature: string, payload: string, secret: string): boolean;
}

export interface WhatsAppSendOptions {
  to: string;
  templateName: string;
  languageCode: string; // 'bn' | 'en'
  parameters?: any;
  schoolId?: string;
  idempotencyKey?: string;
}

export interface WhatsAppProvider {
  name: string;
  sendWhatsApp(options: WhatsAppSendOptions): Promise<SendMessageResult>;
  getDeliveryStatus?(messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }>;
  verifyWebhookSignature?(signature: string, payload: string, secret: string): boolean;
}

export function verifyHmacSha256(signature: string, payload: string, secret: string): boolean {
  if (!signature || !payload || !secret) return false;
  const rawSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return secureTimingSafeCompare(rawSig, computed);
}

// ============================================================================
// Concrete Mock Implementations (Deterministic for Testing & Offline Execution)
// ============================================================================

export class MockSmsProvider implements SmsProvider {
  public readonly name = 'MOCK_SMS_PROVIDER';
  public sentMessages: Array<SmsSendOptions & { messageId: string; timestamp: Date }> = [];

  async sendSms(options: SmsSendOptions): Promise<SendMessageResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY ERROR: MockSmsProvider cannot be used in production environment. A real SMS gateway (e.g. SSL Wireless, Onnorokom, Greenweb) must be configured.');
    }
    const phoneRes = normalizeBangladeshiPhone(options.to);
    if (!phoneRes.isValid) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        status: 'FAILED',
        provider: this.name,
        providerMessageId: `mock_sms_err_${Date.now()}`,
        failureReason: phoneRes.error || 'Invalid phone number format',
      };
    }

    const messageId = `mock_sms_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const isUnicode = Array.from(options.message).some((char) => char.charCodeAt(0) > 127);
    const charLimit = isUnicode ? 70 : 160;
    const smsCount = Math.ceil(options.message.length / charLimit) || 1;

    this.sentMessages.push({
      ...options,
      to: phoneRes.normalizedPhone!,
      messageId,
      timestamp: new Date(),
    });

    return {
      success: true,
      deliveryStatus: 'SENT',
      status: 'SENT',
      provider: this.name,
      providerMessageId: messageId,
      smsCount,
      metadata: {
        operator: phoneRes.operator,
        isUnicode,
        charCount: options.message.length,
      },
    };
  }

  async getDeliveryStatus(_messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }> {
    return { status: 'DELIVERED', deliveredAt: new Date() };
  }

  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
    return verifyHmacSha256(signature, payload, secret);
  }
}

export class MockEmailProvider implements EmailProvider {
  public readonly name = 'MOCK_EMAIL_PROVIDER';
  public sentEmails: Array<EmailSendOptions & { messageId: string; timestamp: Date }> = [];

  async sendEmail(options: EmailSendOptions): Promise<SendMessageResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY ERROR: MockEmailProvider cannot be used in production environment. A real SMTP/SES/SendGrid gateway must be configured.');
    }
    if (!options.to || !options.to.includes('@')) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        status: 'FAILED',
        provider: this.name,
        providerMessageId: `mock_email_err_${Date.now()}`,
        failureReason: 'Invalid recipient email address',
      };
    }

    const messageId = `mock_email_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.sentEmails.push({
      ...options,
      messageId,
      timestamp: new Date(),
    });

    return {
      success: true,
      deliveryStatus: 'SENT',
      status: 'SENT',
      provider: this.name,
      providerMessageId: messageId,
    };
  }

  async getDeliveryStatus(_messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }> {
    return { status: 'DELIVERED', deliveredAt: new Date() };
  }

  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
    return verifyHmacSha256(signature, payload, secret);
  }
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  public readonly name = 'MOCK_WHATSAPP_PROVIDER';
  public sentWhatsApp: Array<WhatsAppSendOptions & { messageId: string; timestamp: Date }> = [];

  async sendWhatsApp(options: WhatsAppSendOptions): Promise<SendMessageResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY ERROR: MockWhatsAppProvider cannot be used in production environment. A real WhatsApp Business Cloud API gateway must be configured.');
    }
    const phoneRes = normalizeBangladeshiPhone(options.to);
    if (!phoneRes.isValid) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        status: 'FAILED',
        provider: this.name,
        providerMessageId: `mock_wa_err_${Date.now()}`,
        failureReason: phoneRes.error || 'Invalid WhatsApp recipient phone',
      };
    }

    const messageId = `mock_wa_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.sentWhatsApp.push({
      ...options,
      to: phoneRes.normalizedPhone!,
      messageId,
      timestamp: new Date(),
    });

    return {
      success: true,
      deliveryStatus: 'SENT',
      status: 'SENT',
      provider: this.name,
      providerMessageId: messageId,
      metadata: {
        template: options.templateName,
        language: options.languageCode,
      },
    };
  }

  async getDeliveryStatus(_messageId: string): Promise<{ status: string; deliveredAt?: Date; error?: string }> {
    return { status: 'DELIVERED', deliveredAt: new Date() };
  }

  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
    return verifyHmacSha256(signature, payload, secret);
  }
}

// ============================================================================
// Unified Communication Provider Registry & Resolver
// ============================================================================

export class CommunicationProviderRegistry {
  private static defaultSmsProvider: SmsProvider = new MockSmsProvider();
  private static defaultEmailProvider: EmailProvider = new MockEmailProvider();
  private static defaultWhatsAppProvider: WhatsAppProvider = new MockWhatsAppProvider();

  public static getSmsProvider(): SmsProvider {
    return this.defaultSmsProvider;
  }

  public static setSmsProvider(provider: SmsProvider) {
    this.defaultSmsProvider = provider;
  }

  public static getEmailProvider(): EmailProvider {
    return this.defaultEmailProvider;
  }

  public static setEmailProvider(provider: EmailProvider) {
    this.defaultEmailProvider = provider;
  }

  public static getWhatsAppProvider(): WhatsAppProvider {
    return this.defaultWhatsAppProvider;
  }

  public static setWhatsAppProvider(provider: WhatsAppProvider) {
    this.defaultWhatsAppProvider = provider;
  }
}

// Global provider registry object for test suite
export const providerRegistry = {
  getSmsProvider: () => CommunicationProviderRegistry.getSmsProvider(),
  registerSmsProvider: (p: any) => CommunicationProviderRegistry.setSmsProvider(p),
  getEmailProvider: () => CommunicationProviderRegistry.getEmailProvider(),
  registerEmailProvider: (p: any) => CommunicationProviderRegistry.setEmailProvider(p),
  getWhatsAppProvider: () => CommunicationProviderRegistry.getWhatsAppProvider(),
  registerWhatsAppProvider: (p: any) => CommunicationProviderRegistry.setWhatsAppProvider(p),
};

