import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client!: Redis;

    constructor(private readonly config: ConfigService) { }

    onModuleInit() {
        const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6380');
        this.client = new Redis(redisUrl);
        this.client.on('connect', () => this.logger.log('Redis connected'));
        this.client.on('error', (err) => this.logger.error('Redis error', err));
    }

    async onModuleDestroy() {
        await this.client.quit();
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async ping(): Promise<string> {
        return this.client.ping();
    }

    async getJson<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
    }

    async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttlSeconds);
    }

    async incr(key: string): Promise<number> {
        return this.client.incr(key);
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        await this.client.expire(key, ttlSeconds);
    }
}
