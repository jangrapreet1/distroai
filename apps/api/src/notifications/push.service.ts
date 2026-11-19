import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_VAPID_PUBLIC = 'BPlNUHZjrKP9m2v4ygVQoZXagv0ncFx727q-V1Ozl8pA1CM2saDoQN0YqVEU-DOAt6w-QQ_AIGZHqoJjLemniD0';
const DEFAULT_VAPID_PRIVATE = 'tUmcWPYlskBtcCGiTCRJHgbgh7v56I5hTxDHnPA0C2U';
const DEFAULT_VAPID_SUBJECT = 'mailto:support@distroai.in';

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private readonly isFirebaseConfigured: boolean;
    private readonly isWebPushConfigured: boolean;
    private readonly vapidPublicKey: string;
    private readonly vapidPrivateKey: string;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) {
        // 1. Firebase Admin Configuration
        const projectId = config.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY');
        this.isFirebaseConfigured = !!(projectId && clientEmail && privateKey);

        if (this.isFirebaseConfigured && !admin.apps.length) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        clientEmail,
                        privateKey: privateKey!.replace(/\\n/g, '\n'),
                    }),
                });
                this.logger.log('Firebase Admin initialized');
            } catch (err) {
                this.logger.warn(`Failed to initialize Firebase Admin: ${(err as Error).message}`);
            }
        }

        // 2. Web Push (VAPID) Configuration (iOS 16.4+ Safari PWA, Chrome, Edge, Firefox)
        this.vapidPublicKey = config.get<string>('VAPID_PUBLIC_KEY') || DEFAULT_VAPID_PUBLIC;
        this.vapidPrivateKey = config.get<string>('VAPID_PRIVATE_KEY') || DEFAULT_VAPID_PRIVATE;
        const vapidSubject = config.get<string>('VAPID_SUBJECT') || DEFAULT_VAPID_SUBJECT;

        try {
            webpush.setVapidDetails(vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
            this.isWebPushConfigured = true;
            this.logger.log('Web Push (VAPID) initialized successfully');
        } catch (err) {
            this.logger.warn(`Failed to configure Web Push VAPID: ${(err as Error).message}`);
            this.isWebPushConfigured = false;
        }
    }

    /**
     * Get the VAPID public key so client browsers / iOS PWAs can subscribe.
     */
    getVapidPublicKey(): string {
        return this.vapidPublicKey;
    }

    /**
     * Store or update a device's Web Push subscription.
     */
    async subscribe(
        orgId: string,
        userId: string,
        data: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string },
    ) {
        return this.prisma.pushSubscription.upsert({
            where: { endpoint: data.endpoint },
            create: {
                orgId,
                userId,
                endpoint: data.endpoint,
                p256dh: data.keys.p256dh,
                auth: data.keys.auth,
                userAgent: data.userAgent,
            },
            update: {
                orgId,
                userId,
                p256dh: data.keys.p256dh,
                auth: data.keys.auth,
                userAgent: data.userAgent,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Unsubscribe a device's Web Push subscription.
     */
    async unsubscribe(userId: string, endpoint: string) {
        return this.prisma.pushSubscription.deleteMany({
            where: { userId, endpoint },
        });
    }

    /**
     * Send Web Push notification to an individual device subscription.
     */
    async sendWebPush(
        sub: { id: string; endpoint: string; p256dh: string; auth: string },
        title: string,
        body: string,
        data?: Record<string, unknown>,
    ) {
        if (!this.isWebPushConfigured) return;

        const payload = JSON.stringify({
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            url: data?.url || (data?.orderId ? `/orders/${data.orderId}` : '/dashboard'),
            data: data ?? {},
        });

        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                },
                payload,
                {
                    TTL: 86400, // 24 hours
                    urgency: 'high',
                },
            );
        } catch (err: any) {
            const statusCode = err?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
                this.logger.log(`Subscription expired/unregistered (HTTP ${statusCode}). Removing dead subscription.`);
                await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            } else {
                this.logger.warn(`WebPush delivery error: ${err?.message || statusCode}`);
            }
        }
    }

    /**
     * Send a notification to a specific user across all their registered devices (FCM + Web Push).
     */
    async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        // 1. FCM (if user has native FCM tokens)
        const fcmTokens = (user as Record<string, unknown>)?.fcmTokens as string[] ?? [];
        if (fcmTokens.length > 0) {
            if (this.isFirebaseConfigured) {
                try {
                    const response = await admin.messaging().sendEachForMulticast({
                        tokens: fcmTokens,
                        notification: { title, body },
                        data: (data as any) ?? {},
                    });

                    const invalidIndices = response.responses
                        .map((r, i) => (!r.success ? i : -1))
                        .filter((i) => i >= 0);

                    if (invalidIndices.length > 0) {
                        const validTokens = fcmTokens.filter((_, i) => !invalidIndices.includes(i));
                        await this.prisma.user.update({
                            where: { id: userId },
                            data: { fcmTokens: validTokens } as Record<string, unknown>,
                        });
                    }
                } catch (err) {
                    this.logger.error(`Failed to send FCM to user ${userId}: ${(err as Error).message}`);
                }
            } else {
                this.logger.log(`[PUSH STUB FCM] To user ${userId}: ${title} — ${body}`);
            }
        }

        // 2. Web Push (iOS 16.4+ Safari PWA, Chrome, Edge, Firefox)
        if (this.isWebPushConfigured) {
            const webSubs = await this.prisma.pushSubscription.findMany({
                where: { userId },
            });

            for (const sub of webSubs) {
                await this.sendWebPush(sub, title, body, data);
            }
        }
    }

    /**
     * Send a notification to all users matching specific roles in an organization.
     */
    async sendToOrg(orgId: string, roles: string[], title: string, body: string, data?: Record<string, unknown>) {
        const users = await this.prisma.user.findMany({
            where: { orgId, role: { in: roles as any }, isActive: true },
            select: { id: true },
        });

        for (const user of users) {
            await this.sendToUser(user.id, title, body, data);
        }
    }
}
