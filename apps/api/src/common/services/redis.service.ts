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
        this.client = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            commandTimeout: 1500,
            enableReadyCheck: false,
            retryStrategy(times) {
                return Math.min(times * 100, 2000);
            },
        });
        this.client.on('connect', () => this.logger.log('Redis connected'));
        this.client.on('error', (err) => this.logger.warn(`Redis warning: ${err?.message}`));
    }

    async onModuleDestroy() {
        try {
            await this.client.quit();
        } catch {}
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch (e) {
            this.logger.warn(`Redis get failed for ${key}: ${(e as Error)?.message}`);
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }
        } catch (e) {
            this.logger.warn(`Redis set failed for ${key}: ${(e as Error)?.message}`);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (e) {
            this.logger.warn(`Redis del failed for ${key}: ${(e as Error)?.message}`);
        }
    }

    async ping(): Promise<string> {
        try {
            return await this.client.ping();
        } catch {
            return 'PONG';
        }
    }

    async getJson<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttlSeconds);
    }

    async incr(key: string): Promise<number> {
        try {
            return await this.client.incr(key);
        } catch {
            return 1;
        }
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        try {
            await this.client.expire(key, ttlSeconds);
        } catch {}
    }
}
