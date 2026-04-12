import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './common/services/redis.service';
import { QueueService } from './queue/queue.service';

@Injectable()
export class AppService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly queueService: QueueService,
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

        // Gather Queue Depths
        const queueMetrics: Record<string, any> = {};
        for (const [name, q] of this.queueService.getAllQueues()) {
            try {
                const counts = await q.getJobCounts();
                queueMetrics[name] = counts;
            } catch {
                queueMetrics[name] = 'unreachable';
            }
        }

        const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';
        const response = {
            status: isHealthy ? 'ok' : 'degraded',
            db: dbStatus,
            redis: redisStatus,
            queues: queueMetrics,
            timestamp: new Date().toISOString(),
        };

        if (!isHealthy) {
            throw new ServiceUnavailableException(response);
        }

        return response;
    }
}
