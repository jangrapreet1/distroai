import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@distroai/db';
import { AsyncLocalStorage } from 'async_hooks';

export const orgStorage = new AsyncLocalStorage<{ orgId: string }>();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor(config: ConfigService) {
        const isDev = config.get('NODE_ENV') === 'development';
        const logLevels: any[] = isDev
            ? ['query', 'info', 'warn', 'error']
            : ['warn', 'error'];

        super({ log: logLevels });
    }

    async onModuleInit() {
        await this.$connect();
        this.logger.log('Prisma connected');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Prisma disconnected');
    }
}
