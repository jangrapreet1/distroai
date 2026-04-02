import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp.webhook';
import { WhatsAppConnectController } from './whatsapp-connect.controller';
import { BotHandler } from './bot.handler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [WhatsAppWebhookController, WhatsAppConnectController],
    providers: [WhatsAppService, BotHandler],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }

