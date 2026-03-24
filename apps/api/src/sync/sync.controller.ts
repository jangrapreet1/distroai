import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
    constructor(private readonly syncService: SyncService) { }

    @Get('products')
    async syncProducts(
        @Req() req: Request,
        @Query('lastSyncTimestamp') lastSyncTimestamp?: string
    ) {
        const orgId = (req.user as any).orgId;
        const timestamp = lastSyncTimestamp ? parseInt(lastSyncTimestamp, 10) : 0;
        return this.syncService.getSyncProducts(orgId, timestamp);
    }
}
