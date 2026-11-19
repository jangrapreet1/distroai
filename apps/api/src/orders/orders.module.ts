import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersImportService } from './orders-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommonModule } from '../common/common.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { EventsModule } from '../events/events.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [
        PrismaModule,
        AnalyticsModule,
        CommonModule,
        InvoicesModule,
        EventsModule,
        WhatsAppModule,
        PaymentsModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService, OrdersImportService],
    exports: [OrdersService, OrdersImportService],
})
export class OrdersModule { }
