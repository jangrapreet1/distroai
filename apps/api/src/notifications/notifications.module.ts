import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { PushService } from './push.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Global()
@Module({
    imports: [WhatsAppModule],
    providers: [NotificationsService, EmailService, SMSService, PushService],
    exports: [NotificationsService, EmailService, SMSService, PushService],
})
export class NotificationsModule { }
