import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './common/services/redis.service';

@Injectable()
export class AppService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async getHealth() {
        let dbStatus = 'connected';
        let redisStatus = 'connected';

        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            dbStatus = 'disconnected';
        }

        try {
            await this.redis.ping();
        } catch {
            redisStatus = 'disconnected';
        }

        return {
            status: dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded',
            db: dbStatus,
            redis: redisStatus,
            timestamp: new Date().toISOString(),
        };
    }
}
