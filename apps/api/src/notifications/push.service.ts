import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private readonly isConfigured: boolean;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) {
        const projectId = config.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY');
        this.isConfigured = !!(projectId && clientEmail && privateKey);

        if (this.isConfigured && !admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId, clientEmail,
                    privateKey: privateKey!.replace(/\\n/g, '\n'),
                }),
            });
            this.logger.log('Firebase Admin configured');
        } else if (!this.isConfigured) {
            this.logger.warn('Firebase not configured — push notifications will be logged to console');
        }
    }

    async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        const tokens = (user as Record<string, unknown>)?.fcmTokens as string[] ?? [];

        if (!tokens.length) {
            this.logger.log(`No FCM tokens for user ${userId}`);
            return;
        }

        if (!this.isConfigured) {
            this.logger.log(`[PUSH STUB] To user ${userId}: ${title} — ${body}`);
            return;
        }

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data: data ?? {},
            });

            // Remove invalid tokens
            const invalidIndices = response.responses
                .map((r, i) => (!r.success ? i : -1))
                .filter((i) => i >= 0);

            if (invalidIndices.length > 0) {
                const validTokens = tokens.filter((_, i) => !invalidIndices.includes(i));
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { fcmTokens: validTokens } as Record<string, unknown>,
                });
            }
        } catch (err) {
            this.logger.error(`Failed to send push to user ${userId}`, (err as Error).message);
        }
    }

    async sendToOrg(orgId: string, roles: string[], title: string, body: string, data?: Record<string, string>) {
        const users = await this.prisma.user.findMany({
            where: { orgId, role: { in: roles as any } },
            select: { id: true },
        });

        for (const user of users) {
            await this.sendToUser(user.id, title, body, data);
        }
    }
}
