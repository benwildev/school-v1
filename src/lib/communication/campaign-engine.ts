import { CommunicationProviderRegistry } from './provider-abstraction';
import { renderTemplate } from './template-engine';

export interface CampaignRecipient {
  recipientId: string; // studentId, guardianId, or employeeId
  name: string;
  phone?: string;
  email?: string;
  variables?: Record<string, any>;
}

export interface ProcessCampaignOptions {
  campaignId: string;
  schoolId: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';
  recipients: CampaignRecipient[];
  templateText: string;
  schoolName: string;
  chunkSize?: number;
}

export interface ProcessCampaignResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ recipientId: string; reason: string }>;
  logs: Array<{
    recipientId: string;
    phone?: string;
    email?: string;
    deliveryStatus: 'SENT' | 'FAILED' | 'QUEUED';
    providerMessageId?: string;
    failureReason?: string;
    renderedText: string;
  }>;
}

/**
 * Splits an array into chunks of given size.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Executes a chunked bulk campaign dispatch without hanging a single HTTP call.
 */
export async function processBulkCampaign(
  options: ProcessCampaignOptions
): Promise<ProcessCampaignResult> {
  const {
    channel,
    recipients,
    templateText,
    schoolId,
    schoolName,
    chunkSize = 50,
  } = options;

  let sent = 0;
  let failed = 0;
  const errors: Array<{ recipientId: string; reason: string }> = [];
  const logs: ProcessCampaignResult['logs'] = [];

  const chunks = chunkArray(recipients, chunkSize);

  const smsProvider = CommunicationProviderRegistry.getSmsProvider();
  const emailProvider = CommunicationProviderRegistry.getEmailProvider();
  const whatsAppProvider = CommunicationProviderRegistry.getWhatsAppProvider();

  for (const chunk of chunks) {
    // Process chunk items concurrently
    await Promise.all(
      chunk.map(async (recipient) => {
        const vars = {
          recipientName: recipient.name,
          schoolName,
          ...(recipient.variables || {}),
        };

        const renderedText = renderTemplate(templateText, vars);

        try {
          if (channel === 'SMS') {
            if (!recipient.phone) {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: 'Missing phone number' });
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'FAILED',
                failureReason: 'Missing phone number',
                renderedText,
              });
              return;
            }

            const sendRes = await smsProvider.sendSms({
              to: recipient.phone,
              message: renderedText,
              schoolId,
            });

            if (sendRes.success) {
              sent++;
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'SENT',
                providerMessageId: sendRes.providerMessageId,
                renderedText,
              });
            } else {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: sendRes.failureReason || 'SMS send failed' });
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'FAILED',
                failureReason: sendRes.failureReason,
                renderedText,
              });
            }
          } else if (channel === 'EMAIL') {
            if (!recipient.email) {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: 'Missing email address' });
              logs.push({
                recipientId: recipient.recipientId,
                email: recipient.email,
                deliveryStatus: 'FAILED',
                failureReason: 'Missing email address',
                renderedText,
              });
              return;
            }

            const sendRes = await emailProvider.sendEmail({
              to: recipient.email,
              subject: `Notice from ${schoolName}`,
              html: `<p>${renderedText}</p>`,
              schoolId,
            });

            if (sendRes.success) {
              sent++;
              logs.push({
                recipientId: recipient.recipientId,
                email: recipient.email,
                deliveryStatus: 'SENT',
                providerMessageId: sendRes.providerMessageId,
                renderedText,
              });
            } else {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: sendRes.failureReason || 'Email send failed' });
              logs.push({
                recipientId: recipient.recipientId,
                email: recipient.email,
                deliveryStatus: 'FAILED',
                failureReason: sendRes.failureReason,
                renderedText,
              });
            }
          } else if (channel === 'WHATSAPP') {
            if (!recipient.phone) {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: 'Missing phone number for WhatsApp' });
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'FAILED',
                failureReason: 'Missing phone number for WhatsApp',
                renderedText,
              });
              return;
            }

            const sendRes = await whatsAppProvider.sendWhatsApp({
              to: recipient.phone,
              templateName: 'general_school_notice',
              languageCode: 'bn',
              parameters: [{ type: 'text', text: renderedText }],
              schoolId,
            });

            if (sendRes.success) {
              sent++;
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'SENT',
                providerMessageId: sendRes.providerMessageId,
                renderedText,
              });
            } else {
              failed++;
              errors.push({ recipientId: recipient.recipientId, reason: sendRes.failureReason || 'WhatsApp send failed' });
              logs.push({
                recipientId: recipient.recipientId,
                phone: recipient.phone,
                deliveryStatus: 'FAILED',
                failureReason: sendRes.failureReason,
                renderedText,
              });
            }
          } else {
            // IN_APP or others
            sent++;
            logs.push({
              recipientId: recipient.recipientId,
              deliveryStatus: 'SENT',
              renderedText,
            });
          }
        } catch (err: any) {
          failed++;
          errors.push({ recipientId: recipient.recipientId, reason: err.message || 'Unknown processing error' });
          logs.push({
            recipientId: recipient.recipientId,
            deliveryStatus: 'FAILED',
            failureReason: err.message || 'Unknown processing error',
            renderedText,
          });
        }
      })
    );
  }

  return {
    total: recipients.length,
    sent,
    failed,
    errors,
    logs,
  };
}
