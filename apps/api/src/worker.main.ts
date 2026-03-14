import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { PaymentProcessor } from './queue/payment.processor';

/**
 * WorkerModule: A stripped-down NestJS module that bootstraps ONLY
 * the BullMQ queue processors. No HTTP server, no controllers.
 *
 * This runs as a separate Kubernetes deployment (infra/k8s/worker/)
 * consuming jobs from Redis queues enqueued by the API pods.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
                DATABASE_URL: Joi.string().required(),
                REDIS_URL: Joi.string().required(),
            }),
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: new URL(config.getOrThrow('REDIS_URL')).hostname,
                    port: parseInt(new URL(config.getOrThrow('REDIS_URL')).port || '6379', 10),
                },
            }),
        }),
        PrismaModule,
        QueueModule,
        NotificationsModule,
        AiModule,
    ],
})
class WorkerModule { }

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(WorkerModule);

    // Graceful shutdown
    const shutdown = async () => {
        console.log('[Worker] Shutting down gracefully...');
        await app.close();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    console.log('[Worker] BullMQ processors running. Waiting for jobs...');
}

bootstrap();
