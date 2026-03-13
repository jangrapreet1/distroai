import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { ShelfAuditController } from './shelf-audit.controller';
import { AiService } from './ai.service';
import { StorageModule } from '../storage/storage.module';
import { AiProcessor } from './ai.processor';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
    imports: [StorageModule, WhatsAppModule],
    controllers: [AiController],
    providers: [AiService, AiProcessor],
    exports: [AiService],
})
export class AiModule { }
