import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/utils/crypto.util';
import axios, { AxiosInstance } from 'axios';

const GRAPH_API_DEFAULT = 'https://graph.facebook.com/v19.0';

/** Cached per-org WhatsApp client */
interface OrgClient {
    client: AxiosInstance;
    phoneNumberId: string;
    expiresAt: number; // cache TTL
}

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly clientCache = new Map<string, OrgClient>();
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    // Env-var fallback (single-tenant legacy)
    private readonly fallbackClient: AxiosInstance | null;
    private readonly fallbackPhoneNumberId: string;
    private readonly hasFallback: boolean;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) {
        const apiUrl = config.get<string>('WHATSAPP_API_URL', GRAPH_API_DEFAULT);
        const accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN');
        this.fallbackPhoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
        this.hasFallback = !!(accessToken && this.fallbackPhoneNumberId);

        if (this.hasFallback) {
            this.fallbackClient = axios.create({
                baseURL: `${apiUrl}/${this.fallbackPhoneNumberId}`,
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            });
        } else {
            this.fallbackClient = null;
        }

        if (!this.hasFallback) {
            this.logger.warn('No env-level WhatsApp config — relying on per-tenant DB credentials');
        }
    }

    /**
     * Resolve an Axios client for the given orgId.
     * Priority: DB credentials → env-var fallback → null (stub mode)
     */
    private async getClient(orgId: string): Promise<{ client: AxiosInstance; phoneNumberId: string } | null> {
        // Check cache first
        const cached = this.clientCache.get(orgId);
        if (cached && Date.now() < cached.expiresAt) {
            return { client: cached.client, phoneNumberId: cached.phoneNumberId };
        }

        // Look up DB
        const waConfig = await this.prisma.whatsAppConfig.findUnique({
            where: { orgId },
            select: { accessToken: true, phoneNumberId: true, isActive: true },
        });

        if (waConfig && waConfig.isActive && waConfig.accessToken && waConfig.phoneNumberId) {
            try {
                const token = decrypt(waConfig.accessToken);
                const client = axios.create({
                    baseURL: `${GRAPH_API_DEFAULT}/${waConfig.phoneNumberId}`,
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });

                const entry: OrgClient = {
                    client,
                    phoneNumberId: waConfig.phoneNumberId,
                    expiresAt: Date.now() + this.CACHE_TTL_MS,
                };
                this.clientCache.set(orgId, entry);
                return { client, phoneNumberId: waConfig.phoneNumberId };
            } catch (err) {
                this.logger.error(`Failed to decrypt WA token for org ${orgId}`, (err as Error).message);
            }
        }

        // Fallback to env-var config
        if (this.hasFallback && this.fallbackClient) {
            return { client: this.fallbackClient, phoneNumberId: this.fallbackPhoneNumberId };
        }

        return null;
    }

    /** Invalidate cached client for an org (call after disconnect/reconnect) */
    invalidateCache(orgId: string): void {
        this.clientCache.delete(orgId);
    }

    private async logOutbound(orgId: string, phone: string, messageType: string, content: string, mediaUrl?: string) {
        try {
            await this.prisma.whatsAppMessage.create({
                data: {
                    orgId,
                    direction: 'OUTBOUND',
                    phone,
                    messageType,
                    content,
                    mediaUrl,
                    status: 'SENT',
                },
            });
        } catch (e) {
            this.logger.warn(`Failed to log outbound WA message to org ${orgId}: ${(e as Error).message}`);
        }
    }

    async sendText(orgId: string, to: string, body: string): Promise<void> {
        await this.logOutbound(orgId, to, 'text', body);
        const resolved = await this.getClient(orgId);
        if (!resolved) {
            this.logger.log(`[WA STUB] sendText org=${orgId} to=${to}: ${body}`);
            return;
        }
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', to,
                type: 'text', text: { body },
            });
        } catch (err) {
            this.logger.error(`Failed to send text to ${to} (org ${orgId})`, (err as Error).message);
        }
    }

    async sendButtons(
        orgId: string, to: string, body: string,
        buttons: Array<{ id: string; title: string }>,
    ): Promise<void> {
        await this.logOutbound(orgId, to, 'interactive', body);
        const resolved = await this.getClient(orgId);
        if (!resolved) {
            this.logger.log(`[WA STUB] sendButtons org=${orgId} to=${to}: ${body}`);
            return;
        }
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'interactive',
                interactive: {
                    type: 'button', body: { text: body },
                    action: {
                        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
                    },
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send buttons to ${to} (org ${orgId})`, (err as Error).message);
        }
    }

    async sendList(
        orgId: string, to: string, header: string, body: string, buttonText: string,
        sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    ): Promise<void> {
        await this.logOutbound(orgId, to, 'interactive', `${header}: ${body}`);
        const resolved = await this.getClient(orgId);
        if (!resolved) {
            this.logger.log(`[WA STUB] sendList org=${orgId} to=${to}: ${header}`);
            return;
        }
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'interactive',
                interactive: {
                    type: 'list', header: { type: 'text', text: header }, body: { text: body },
                    action: { button: buttonText, sections },
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send list to ${to} (org ${orgId})`, (err as Error).message);
        }
    }

    async sendDocument(orgId: string, to: string, documentUrl: string, filename: string, caption?: string): Promise<void> {
        await this.logOutbound(orgId, to, 'document', caption || filename, documentUrl);
        const resolved = await this.getClient(orgId);
        if (!resolved) {
            this.logger.log(`[WA STUB] sendDocument org=${orgId} to=${to}: ${filename}`);
            return;
        }
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'document',
                document: { link: documentUrl, filename, ...(caption && { caption }) },
            });
        } catch (err) {
            this.logger.error(`Failed to send document to ${to} (org ${orgId})`, (err as Error).message);
        }
    }

    async sendTemplate(
        orgId: string, to: string, templateName: string, languageCode: string,
        components?: Record<string, unknown>[],
    ): Promise<void> {
        await this.logOutbound(orgId, to, 'template', `Template: ${templateName}`);
        const resolved = await this.getClient(orgId);
        if (!resolved) {
            this.logger.log(`[WA STUB] sendTemplate org=${orgId} to=${to}: ${templateName}`);
            return;
        }
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', to, type: 'template',
                template: {
                    name: templateName, language: { code: languageCode },
                    ...(components && { components }),
                },
            });
        } catch (err) {
            this.logger.error(`Failed to send template to ${to} (org ${orgId})`, (err as Error).message);
        }
    }

    async markRead(orgId: string, messageId: string): Promise<void> {
        const resolved = await this.getClient(orgId);
        if (!resolved) return;
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp', status: 'read', message_id: messageId,
            });
        } catch (err) {
            this.logger.error(`Failed to mark read: ${messageId} (org ${orgId})`, (err as Error).message);
        }
    }

    async sendAction(orgId: string, to: string, action: 'typing_on' | 'typing_off'): Promise<void> {
        const resolved = await this.getClient(orgId);
        if (!resolved) return;
        try {
            await resolved.client.post('/messages', {
                messaging_product: 'whatsapp',
                to,
                action,
            });
        } catch (err) {
            this.logger.error(`Failed to send ${action} to ${to} (org ${orgId})`, (err as Error).message);
        }
    }
}
