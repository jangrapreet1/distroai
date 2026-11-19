import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { PushService } from './push.service';
import { EventsGateway } from './events.gateway';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Global()
@Module({
    imports: [WhatsAppModule],
    controllers: [EventsGateway, NotificationsController],
    providers: [NotificationsService, EmailService, SMSService, PushService, EventsGateway],
    exports: [NotificationsService, EmailService, SMSService, PushService, EventsGateway],
})
export class NotificationsModule { }
