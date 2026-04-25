import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { CreativeService } from './creative.service';
import { AudienceService } from './audience.service';
import { MetricsSyncProcessor } from './jobs/sync-metrics.processor';

@Module({
    imports: [
        PrismaModule,
        WhatsAppModule,
        BullModule.registerQueue({
            name: 'marketing',
        }),
    ],
    controllers: [MarketingController],
    providers: [MarketingService, CreativeService, AudienceService, MetricsSyncProcessor],
    exports: [MarketingService],
})
export class MarketingModule { }
