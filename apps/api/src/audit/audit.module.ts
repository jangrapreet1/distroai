import { Module, Global } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit.service';

@Global()
@Module({ controllers: [AuditController], providers: [AuditLogService], exports: [AuditLogService] })
export class AuditModule { }
