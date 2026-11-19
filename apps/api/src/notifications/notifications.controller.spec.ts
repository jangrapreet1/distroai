import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let pushService: {
        getVapidPublicKey: jest.Mock;
        subscribe: jest.Mock;
        unsubscribe: jest.Mock;
        sendToUser: jest.Mock;
    };
    let prisma: {
        notification: {
            findMany: jest.Mock;
            updateMany: jest.Mock;
        };
    };

    const mockUser: JwtPayload = {
        sub: 'user-123',
        orgId: 'org-456',
        role: 'OWNER',
        email: 'test@distroai.in',
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        pushService = {
            getVapidPublicKey: jest.fn().mockReturnValue('mock-vapid-key'),
            subscribe: jest.fn().mockResolvedValue({ id: 'sub-1' }),
            unsubscribe: jest.fn().mockResolvedValue({ count: 1 }),
            sendToUser: jest.fn().mockResolvedValue(undefined),
        };
        prisma = {
            notification: {
                findMany: jest.fn().mockResolvedValue([{ id: 'notif-1', title: 'Order' }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                { provide: PushService, useValue: pushService },
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
    });

    it('should return VAPID public key', () => {
        const res = controller.getVapidPublicKey();
        expect(res).toEqual({ publicKey: 'mock-vapid-key' });
        expect(pushService.getVapidPublicKey).toHaveBeenCalled();
    });

    it('should subscribe device push subscription with tenant scoping', async () => {
        const dto = {
            endpoint: 'https://web.push.apple.com/endpoint-1',
            keys: { p256dh: 'p256', auth: 'auth-key' },
            userAgent: 'Safari iOS',
        };

        const res = await controller.subscribe(mockUser, dto);
        expect(res).toEqual({ success: true });
        expect(pushService.subscribe).toHaveBeenCalledWith('org-456', 'user-123', dto);
    });

    it('should unsubscribe device push subscription', async () => {
        const res = await controller.unsubscribe(mockUser, { endpoint: 'https://web.push.apple.com/endpoint-1' });
        expect(res).toEqual({ success: true });
        expect(pushService.unsubscribe).toHaveBeenCalledWith('user-123', 'https://web.push.apple.com/endpoint-1');
    });

    it('should send test push notification', async () => {
        const res = await controller.testPush(mockUser);
        expect(res.success).toBe(true);
        expect(pushService.sendToUser).toHaveBeenCalledWith(
            'user-123',
            expect.stringContaining('DistroAI'),
            expect.any(String),
            expect.objectContaining({ type: 'test' }),
        );
    });

    it('should get tenant-scoped notifications', async () => {
        const list = await controller.getNotifications(mockUser, 10);
        expect(prisma.notification.findMany).toHaveBeenCalledWith({
            where: { orgId: 'org-456' },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        expect(list).toHaveLength(1);
    });

    it('should mark notification as read scoped by orgId', async () => {
        const res = await controller.markAsRead(mockUser, 'notif-1');
        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: { id: 'notif-1', orgId: 'org-456' },
            data: { isRead: true },
        });
        expect(res).toEqual({ count: 1 });
    });
});
