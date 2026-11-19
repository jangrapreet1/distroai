import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

jest.mock('web-push');

describe('PushService', () => {
    let service: PushService;
    let prisma: {
        pushSubscription: {
            upsert: jest.Mock;
            deleteMany: jest.Mock;
            delete: jest.Mock;
            findMany: jest.Mock;
        };
        user: {
            findUnique: jest.Mock;
            findMany: jest.Mock;
            update: jest.Mock;
        };
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        prisma = {
            pushSubscription: {
                upsert: jest.fn(),
                deleteMany: jest.fn(),
                delete: jest.fn(),
                findMany: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PushService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'VAPID_PUBLIC_KEY') return 'test-public-key';
                            if (key === 'VAPID_PRIVATE_KEY') return 'test-private-key';
                            if (key === 'VAPID_SUBJECT') return 'mailto:test@distroai.in';
                            return null;
                        }),
                    },
                },
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<PushService>(PushService);
    });

    it('should be defined and return vapid public key', () => {
        expect(service).toBeDefined();
        expect(service.getVapidPublicKey()).toBe('test-public-key');
    });

    it('should upsert push subscription', async () => {
        const dto = {
            endpoint: 'https://web.push.apple.com/test-endpoint',
            keys: {
                p256dh: 'test-p256dh',
                auth: 'test-auth',
            },
            userAgent: 'Mozilla/5.0 iPhone',
        };

        prisma.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1', ...dto });

        const result = await service.subscribe('org-1', 'user-1', dto);
        expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
            where: { endpoint: dto.endpoint },
            create: {
                orgId: 'org-1',
                userId: 'user-1',
                endpoint: dto.endpoint,
                p256dh: dto.keys.p256dh,
                auth: dto.keys.auth,
                userAgent: dto.userAgent,
            },
            update: expect.objectContaining({
                orgId: 'org-1',
                userId: 'user-1',
                p256dh: dto.keys.p256dh,
                auth: dto.keys.auth,
            }),
        });
        expect(result.id).toBe('sub-1');
    });

    it('should delete push subscription on unsubscribe', async () => {
        prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

        const res = await service.unsubscribe('user-1', 'https://web.push.apple.com/test-endpoint');
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', endpoint: 'https://web.push.apple.com/test-endpoint' },
        });
        expect(res.count).toBe(1);
    });

    it('should handle 410 expired subscription during sendWebPush by deleting it', async () => {
        (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({ statusCode: 410 });
        prisma.pushSubscription.delete.mockResolvedValueOnce({ id: 'sub-expired' });

        await service.sendWebPush(
            { id: 'sub-expired', endpoint: 'https://web.push.apple.com/expired', p256dh: 'p', auth: 'a' },
            'Test Title',
            'Test Body',
            { orderId: 'ord-123' },
        );

        expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-expired' } });
    });

    it('should send web push to all user subscriptions', async () => {
        (webpush.sendNotification as jest.Mock).mockResolvedValue({});
        prisma.user.findUnique.mockResolvedValue({ id: 'user-1', fcmTokens: [] });
        prisma.pushSubscription.findMany.mockResolvedValue([
            { id: 'sub-1', endpoint: 'https://web.push.apple.com/1', p256dh: 'p1', auth: 'a1' },
            { id: 'sub-2', endpoint: 'https://web.push.apple.com/2', p256dh: 'p2', auth: 'a2' },
        ]);

        await service.sendToUser('user-1', 'New Order', 'Order #123 placed', { orderId: 'ord-123' });

        expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });
});
