import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { PushService } from './push.service';

export type NotificationEvent =
    | { type: 'NEW_WHATSAPP_ORDER'; orgId: string; orderId: string; customerId: string }
    | { type: 'ORDER_STATUS_CHANGED'; orgId: string; orderId: string; newStatus: string; customerId: string }
    | { type: 'INVOICE_CREATED'; orgId: string; invoiceId: string; customerId: string }
    | { type: 'PAYMENT_RECEIVED'; orgId: string; paymentId: string; customerId: string; amount: number }
    | { type: 'PAYMENT_OVERDUE'; orgId: string; invoiceId: string; customerId: string; daysOverdue: number }
    | { type: 'LOW_STOCK'; orgId: string; productId: string; currentQty: number; minQty: number }
    | { type: 'SALESMAN_CHECKIN'; orgId: string; salesmanId: string; customerId: string }
    | { type: 'DAILY_BRIEFING'; orgId: string; briefingMessage: string; targetUserIds: string[] }
    | { type: 'USER_INVITED'; orgId: string; userId: string; tempPassword: string };

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private prisma: PrismaService,
        private queueService: QueueService,
        private wa: WhatsAppService,
        private email: EmailService,
        private sms: SMSService,
        private push: PushService,
    ) { }

    async notify(orgId: string, event: NotificationEvent): Promise<void> {
        // 1. Always create Notification record in DB
        const notification = await this.prisma.notification.create({
            data: {
                orgId,
                userId: (event as any).userId ?? 'system',
                type: event.type,
                title: this.getTitle(event),
                body: this.getMessage(event),
                data: event as any,
                isRead: false,
                channel: [],
            },
        });

        // 2. Queue channel-specific sends
        try {
            switch (event.type) {
                case 'NEW_WHATSAPP_ORDER':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId, type: 'new_order', orderId: event.orderId,
                        title: 'New WhatsApp Order', body: `Order received from customer`,
                    });
                    break;

                case 'ORDER_STATUS_CHANGED':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId, type: 'order_status', orderId: event.orderId,
                        title: 'Order Updated', body: `Order status changed to ${event.newStatus}`,
                    });
                    break;

                case 'PAYMENT_RECEIVED':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId, type: 'payment_received',
                        title: 'Payment Received', body: `₹${event.amount.toLocaleString('en-IN')} received`,
                    });
                    break;

                case 'PAYMENT_OVERDUE':
                    await this.queueService.addToQueue('notification', 'send-whatsapp', {
                        orgId, invoiceId: event.invoiceId, customerId: event.customerId,
                        daysOverdue: event.daysOverdue,
                    });
                    break;

                case 'LOW_STOCK':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId, type: 'low_stock', productId: event.productId,
                        title: 'Low Stock Alert', body: `Only ${event.currentQty} units left (min: ${event.minQty})`,
                    });
                    break;

                case 'DAILY_BRIEFING':
                    for (const userId of event.targetUserIds) {
                        await this.queueService.addToQueue('notification', 'send-whatsapp-briefing', {
                            orgId, userId, message: event.briefingMessage,
                        });
                    }
                    break;

                case 'USER_INVITED': {
                    const user = await this.prisma.user.findUnique({ where: { id: event.userId } });
                    if (user?.email) {
                        await this.email.sendWelcome(user.email, user.firstName, orgId, event.tempPassword);
                    }
                    break;
                }
            }
        } catch (err) {
            this.logger.error(`Failed to queue notifications for ${event.type}`, (err as Error).message);
        }
    }

    private getTitle(event: NotificationEvent): string {
        const titles: Record<string, string> = {
            NEW_WHATSAPP_ORDER: 'New WhatsApp Order',
            ORDER_STATUS_CHANGED: 'Order Status Updated',
            INVOICE_CREATED: 'Invoice Created',
            PAYMENT_RECEIVED: 'Payment Received',
            PAYMENT_OVERDUE: 'Payment Overdue',
            LOW_STOCK: 'Low Stock Alert',
            SALESMAN_CHECKIN: 'Salesman Check-in',
            DAILY_BRIEFING: 'Daily Briefing',
            USER_INVITED: 'User Invited',
        };
        return titles[event.type] ?? event.type;
    }

    private getMessage(event: NotificationEvent): string {
        switch (event.type) {
            case 'PAYMENT_RECEIVED': return `₹${event.amount.toLocaleString('en-IN')} payment received`;
            case 'LOW_STOCK': return `${event.currentQty} units remaining (min: ${event.minQty})`;
            case 'PAYMENT_OVERDUE': return `Invoice overdue by ${event.daysOverdue} days`;
            default: return event.type;
        }
    }
}
