import { Controller, Post, Get, Req, Res, Logger, HttpCode, Query, Body, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { BotHandler } from './bot.handler';

@Controller('whatsapp')
export class WhatsAppWebhookController {
    private readonly logger = new Logger(WhatsAppWebhookController.name);
    private readonly webhookSecret: string;

    constructor(
        private config: ConfigService,
        private botHandler: BotHandler,
    ) {
        this.webhookSecret = config.get<string>('WHATSAPP_WEBHOOK_SECRET', '');
    }

    @Get('webhook')
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        if (mode === 'subscribe' && token === this.webhookSecret) {
            this.logger.log('Webhook verified');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
        // Verify HMAC signature
        const signature = req.headers['x-hub-signature-256'] as string;

        if (!this.webhookSecret) {
            // In production, the webhook secret MUST be configured
            if (this.config.get('NODE_ENV') === 'production') {
                this.logger.error('WHATSAPP_WEBHOOK_SECRET is not configured');
                return { status: 'error', message: 'Webhook secret not configured' };
            }
        } else {
            // Secret is configured — require and validate signature
            if (!signature) {
                this.logger.warn('Missing X-Hub-Signature-256 header');
                return { status: 'unauthorized' };
            }
            const rawBody = JSON.stringify(body);
            const expected = 'sha256=' + createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
            if (signature !== expected) {
                this.logger.warn('Invalid webhook signature');
                return { status: 'invalid_signature' };
            }
        }

        // Always return 200 immediately — process async
        try {
            const entry = (body as Record<string, unknown>).entry as Array<Record<string, unknown>>;
            if (!entry?.length) return { status: 'ok' };

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
        } catch (err) {
            this.logger.error('Error processing webhook', (err as Error).message);
        }

        return { status: 'ok' };
    }
}
