import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { QueueService } from './queue/queue.service';

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1, // 10% of requests traced
        integrations: [
            Sentry.httpIntegration(),
        ],
        beforeSend(event) {
            // Strip sensitive headers
            if (event.request?.headers?.authorization) {
                delete event.request.headers.authorization;
            }
            if (event.request?.headers?.cookie) {
                delete event.request.headers.cookie;
            }
            return event;
        },
    });
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);

    // Security
    app.use(helmet());

    // CORS
    const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3001');
    app.enableCors({
        origin: corsOrigins.split(',').map((o) => o.trim()),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
    });

    // Bull Board Setup
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queueService = app.get(QueueService);
    const queues = Array.from(queueService.getAllQueues().values()).map((q) => new BullMQAdapter(q));

    createBullBoard({
        queues,
        serverAdapter,
    });

    const adminKey = config.get<string>('ADMIN_KEY', 'distroai-admin');
    app.use('/admin/queues', (req: any, res: any, next: any) => {
        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

        if (login === 'admin' && password === adminKey) {
            return next();
        }

        res.set('WWW-Authenticate', 'Basic realm="Bull Board Admin"');
        res.status(401).send('Authentication required.');
    }, serverAdapter.getRouter());

    // Global prefix
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'api/docs'] });

    // Global pipes
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    // Global filters
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global interceptors
    app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

    // Swagger
    const swaggerConfig = new DocumentBuilder()
        .setTitle('DistroAI API')
        .setDescription('Production-grade backend for Indian distributors and traders')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = config.get<number>('PORT', 3000);
    await app.listen(port);
    console.log(`DistroAI API running on http://localhost:${port}`);
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
