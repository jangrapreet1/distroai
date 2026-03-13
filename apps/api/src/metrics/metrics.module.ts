import { Module, NestMiddleware, Injectable, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as client from 'prom-client';

// ─── Counters ────────────────────────────────────────────
export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status'] as const,
});

export const ordersCreatedTotal = new client.Counter({
    name: 'orders_created_total',
    help: 'Total orders created',
    labelNames: ['source', 'org_plan'] as const,
});

export const whatsappMessagesTotal = new client.Counter({
    name: 'whatsapp_messages_total',
    help: 'Total WhatsApp messages',
    labelNames: ['direction', 'type'] as const,
});

export const aiQueriesTotal = new client.Counter({
    name: 'ai_queries_total',
    help: 'Total AI queries',
    labelNames: ['model', 'language'] as const,
});

// ─── Histograms ──────────────────────────────────────────
export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'path'] as const,
    buckets: [50, 100, 200, 300, 500, 1000, 2000, 5000],
});

export const aiQueryDuration = new client.Histogram({
    name: 'ai_query_duration_ms',
    help: 'AI query duration in milliseconds',
    buckets: [500, 1000, 2000, 5000, 10000, 30000],
});

// ─── Gauges ──────────────────────────────────────────────
export const activeOrgs = new client.Gauge({
    name: 'active_orgs_total',
    help: 'Number of active organizations',
});

export const queueDepth = new client.Gauge({
    name: 'bullmq_queue_depth',
    help: 'BullMQ queue depth',
    labelNames: ['queue'] as const,
});

// ─── Default metrics (CPU, memory, event loop, etc.) ─────
client.collectDefaultMetrics({ prefix: 'distroai_' });

// ─── Middleware to track HTTP requests ───────────────────
@Injectable()
class MetricsMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const start = Date.now();
        const path = this.normalizePath(req.path);

        res.on('finish', () => {
            const duration = Date.now() - start;
            httpRequestsTotal.inc({
                method: req.method,
                path,
                status: String(res.statusCode),
            });
            httpRequestDuration.observe({ method: req.method, path }, duration);
        });

        next();
    }

    private normalizePath(path: string): string {
        // Collapse UUIDs and numeric IDs to reduce cardinality
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:id');
    }
}

// ─── Controller to expose /metrics ───────────────────────
import { Controller, Get, Header } from '@nestjs/common';

@Controller()
class MetricsController {
    @Get('metrics')
    @Header('Content-Type', client.register.contentType)
    async getMetrics(): Promise<string> {
        return client.register.metrics();
    }
}

@Module({
    controllers: [MetricsController],
})
export class MetricsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MetricsMiddleware).forRoutes('*');
    }
}
