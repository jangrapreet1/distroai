import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommonModule } from '../common/common.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
    imports: [PrismaModule, AnalyticsModule, CommonModule, InvoicesModule],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
