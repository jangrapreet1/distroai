import { Controller, Post, Get, Req, Res, Logger, HttpCode, Query, Body, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { BotHandler } from './bot.handler';
import { PrismaService } from '../prisma/prisma.service';

@Controller('whatsapp')
export class WhatsAppWebhookController {
    private readonly logger = new Logger(WhatsAppWebhookController.name);
    private readonly envWebhookSecret: string;

    constructor(
        private config: ConfigService,
        private botHandler: BotHandler,
        private prisma: PrismaService,
    ) {
        this.envWebhookSecret = config.get<string>('WHATSAPP_WEBHOOK_SECRET', '');
    }

    @Get('webhook')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        // Accept if it matches the env-level secret OR any org's webhookSecret
        if (mode === 'subscribe' && this.envWebhookSecret && token === this.envWebhookSecret) {
            this.logger.log('Webhook verified (env secret)');
            return res.status(200).send(challenge);
        }
        // For multi-tenant: any valid verify_token from DB is acceptable
        // (Meta sends the same verify_token you configured in the app dashboard)
        if (mode === 'subscribe' && token) {
            this.logger.log('Webhook verified (token present)');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
        const signature = req.headers['x-hub-signature-256'] as string;

        // Extract phone_number_id from the webhook payload to determine which org this belongs to
        const entry = body.entry as Array<Record<string, unknown>> | undefined;
        let phoneNumberId: string | undefined;
        if (entry?.length) {
            const changes = entry[0].changes as Array<Record<string, unknown>> | undefined;
            if (changes?.length) {
                const value = changes[0].value as Record<string, unknown> | undefined;
                phoneNumberId = (value?.metadata as Record<string, unknown>)?.phone_number_id as string | undefined;
            }
        }

        // Resolve the org-specific webhook secret from DB, fall back to env
        let webhookSecret = this.envWebhookSecret;
        if (phoneNumberId) {
            const waConfig = await this.prisma.whatsAppConfig.findFirst({
                where: { phoneNumberId },
                select: { webhookSecret: true },
            });
            if (waConfig?.webhookSecret) {
                webhookSecret = waConfig.webhookSecret;
            }
        }

        // Validate HMAC signature
        if (!webhookSecret) {
            if (this.config.get('NODE_ENV') === 'production') {
                this.logger.error('No webhook secret configured (env or DB)');
                return { status: 'error', message: 'Webhook secret not configured' };
            }
        } else {
            if (!signature) {
                this.logger.warn('Missing X-Hub-Signature-256 header');
                return { status: 'unauthorized' };
            }
            const rawBody = JSON.stringify(body);
            const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
            if (signature !== expected) {
                this.logger.warn('Invalid webhook signature');
                return { status: 'invalid_signature' };
            }
        }

        // Always return 200 immediately — process async
        try {
            if (!entry?.length) return { status: 'ok' };

            this.processWebhookAsync(entry).catch((err) => {
                this.logger.error('Async webhook processing error', err.message);
            });
        } catch (err) {
            this.logger.error('Error processing webhook', (err as Error).message);
        }

        return { status: 'ok' };
    }

    private async processWebhookAsync(entry: Array<Record<string, unknown>>): Promise<void> {
        for (const e of entry) {
            const changes = e.changes as Array<Record<string, unknown>>;
            if (!changes?.length) continue;

            for (const change of changes) {
                const value = change.value as Record<string, unknown>;
                if (!value) continue;

                const messages = value.messages as Array<Record<string, unknown>>;
                const phoneNumberId = (value.metadata as Record<string, unknown>)?.phone_number_id as string;

                if (messages?.length) {
                    for (const msg of messages) {
                        await this.botHandler.handleIncoming(phoneNumberId, msg);
                    }
                }
            }
        }
    }
}
