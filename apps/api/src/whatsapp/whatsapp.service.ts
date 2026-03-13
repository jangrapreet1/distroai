import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly client: AxiosInstance;
    private readonly phoneNumberId: string;
    private readonly isConfigured: boolean;

    constructor(private config: ConfigService) {
        const apiUrl = config.get<string>('WHATSAPP_API_URL', 'https://graph.facebook.com/v19.0');
        const accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN');
        this.phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
        this.isConfigured = !!(accessToken && this.phoneNumberId);

        this.client = axios.create({
            baseURL: `${apiUrl}/${this.phoneNumberId}`,
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });

        if (!this.isConfigured) {
            this.logger.warn('WhatsApp not configured — messages will be logged to console');
        }
    }

    async sendText(to: string, body: string): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[WA STUB] sendText to=${to}: ${body}`);
            return;
        }
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', to,
                type: 'text', text: { body },
            });
        } catch (err) {
            this.logger.error(`Failed to send text to ${to}`, (err as Error).message);
        }
    }

    async sendButtons(
        to: string, body: string,
        buttons: Array<{ id: string; title: string }>,
    ): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[WA STUB] sendButtons to=${to}: ${body} | buttons=${JSON.stringify(buttons)}`);
            return;
        }
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'interactive',
                interactive: {
                    type: 'button', body: { text: body },
                    action: {
                        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
                    },
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send buttons to ${to}`, (err as Error).message);
        }
    }

    async sendList(
        to: string, header: string, body: string, buttonText: string,
        sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    ): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[WA STUB] sendList to=${to}: ${header}`);
            return;
        }
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'interactive',
                interactive: {
                    type: 'list', header: { type: 'text', text: header }, body: { text: body },
                    action: { button: buttonText, sections },
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send list to ${to}`, (err as Error).message);
        }
    }

    async sendDocument(to: string, documentUrl: string, filename: string, caption?: string): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[WA STUB] sendDocument to=${to}: ${filename}`);
            return;
        }
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'document',
                document: { link: documentUrl, filename, ...(caption && { caption }) },
            });
        } catch (err) {
            this.logger.error(`Failed to send document to ${to}`, (err as Error).message);
        }
    }

    async sendTemplate(
        to: string, templateName: string, languageCode: string,
        components?: Record<string, unknown>[],
    ): Promise<void> {
        if (!this.isConfigured) {
            this.logger.log(`[WA STUB] sendTemplate to=${to}: ${templateName}`);
            return;
        }
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'template',
                template: {
                    name: templateName, language: { code: languageCode },
                    ...(components && { components }),
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send template to ${to}`, (err as Error).message);
        }
    }

    async markRead(messageId: string): Promise<void> {
        if (!this.isConfigured) return;
        try {
            await this.client.post('/messages', {
                messaging_product: 'whatsapp', status: 'read', message_id: messageId,
            });
        } catch (err) {
            this.logger.error(`Failed to mark read: ${messageId}`, (err as Error).message);
        }
    }
}
