import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp.webhook';
import { BotHandler } from './bot.handler';

@Module({
    controllers: [WhatsAppWebhookController],
    providers: [WhatsAppService, BotHandler],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }
