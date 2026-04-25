import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp.webhook';
import { WhatsAppConnectController } from './whatsapp-connect.controller';
import { BotHandler } from './bot.handler';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [PrismaModule, forwardRef(() => AiModule)],
    controllers: [WhatsAppWebhookController, WhatsAppConnectController],
    providers: [WhatsAppService, BotHandler],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }

