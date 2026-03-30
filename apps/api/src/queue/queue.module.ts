import { Module, Global, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { InvoiceProcessor } from './invoice.processor';
import { PaymentProcessor } from './payment.processor';
import { NotificationProcessor } from './notification.processor';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';

const QUEUES = ['notification', 'invoice', 'ai', 'payment-reminder', 'report', 'sync'];

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
};

@Global()
@Module({
    imports: [
        forwardRef(() => WhatsAppModule),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const url = new URL(config.get<string>('REDIS_URL', 'redis://localhost:6380'));
                return {
                    connection: {
                        host: url.hostname,
                        port: parseInt(url.port || '6379'),
                        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
                    },
                    defaultJobOptions,
                };
            },
        }),
        ...QUEUES.map((name) => BullModule.registerQueue({ name })),
    ],
    providers: [QueueService, PaymentProcessor, InvoiceProcessor, NotificationProcessor, InvoicePdfService],
    exports: [QueueService, BullModule],
})
export class QueueModule { }



