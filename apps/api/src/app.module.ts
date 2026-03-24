import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrgModule } from './org/org.module';
import { CommonModule } from './common/common.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { CronModule } from './cron/cron.module';
import { TallyModule } from './tally/tally.module';
import { AiModule } from './ai/ai.module';
import { PaymentProcessor } from './queue/payment.processor';
import { MetricsModule } from './metrics/metrics.module';
import { PublicModule } from './public/public.module';
import { ReportsModule } from './reports/reports.module';
import { SyncModule } from './sync/sync.module';
import { BillingModule } from './billing/billing.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PortalModule } from './portal/portal.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
                PORT: Joi.number().default(3000),
                DATABASE_URL: Joi.string().required(),
                REDIS_URL: Joi.string().required(),
                JWT_ACCESS_SECRET: Joi.string().required(),
                JWT_REFRESH_SECRET: Joi.string().required(),
                JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
                JWT_REFRESH_EXPIRY: Joi.string().default('30d'),
                CORS_ORIGINS: Joi.string().default('http://localhost:3001'),
            }),
        }),
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: () => ({
                throttlers: [{ ttl: 60000, limit: 100 }],
            }),
        }),
        CommonModule,
        PrismaModule,
        AuthModule,
        UsersModule,
        ProductsModule,
        InventoryModule,
        CustomersModule,
        SuppliersModule,
        OrdersModule,
        InvoicesModule,
        PaymentsModule,
        AnalyticsModule,
        PurchaseOrdersModule,
        AuditModule,
        NotificationsModule,
        OrgModule,
        QueueModule,
        StorageModule,
        WhatsAppModule,
        CronModule,
        TallyModule,
        AiModule,
        MetricsModule,
        PublicModule,
        ReportsModule,
        SyncModule,
        BillingModule,
        ExpensesModule,
        PortalModule,
    ],
    controllers: [AppController],
    providers: [AppService, PaymentProcessor],
})
export class AppModule { }
