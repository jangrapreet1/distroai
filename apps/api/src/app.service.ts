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

    private lastQueueMetrics: Record<string, any> = {};
    private lastQueueMetricsTime = 0;

    async getHealth(includeQueues = false) {
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

        // Cache queue metrics for 60s so healthcheck probes don't flood Redis
        const now = Date.now();
        let queues = this.lastQueueMetrics;
        if (includeQueues || (now - this.lastQueueMetricsTime > 60000)) {
            const queueMetrics: Record<string, any> = {};
            for (const [name, q] of this.queueService.getAllQueues()) {
                try {
                    const counts = await q.getJobCounts();
                    queueMetrics[name] = counts;
                } catch {
                    queueMetrics[name] = 'unreachable';
                }
            }
            this.lastQueueMetrics = queueMetrics;
            this.lastQueueMetricsTime = now;
            queues = queueMetrics;
        }

        const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';
        const response = {
            status: isHealthy ? 'ok' : 'degraded',
            db: dbStatus,
            redis: redisStatus,
            queues,
            timestamp: new Date().toISOString(),
        };

        if (!isHealthy) {
            throw new ServiceUnavailableException(response);
        }

        return response;
    }
}
