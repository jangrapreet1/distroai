import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { PushService } from './push.service';
import { EventsGateway } from './events.gateway';

export type NotificationEvent =
    | { type: 'NEW_ORDER'; orgId: string; orderId: string; orderNumber: string; customerName?: string; netAmount: number; source?: string; userId?: string }
    | { type: 'NEW_WHATSAPP_ORDER'; orgId: string; orderId: string; customerId: string; orderNumber?: string; customerName?: string; netAmount?: number; userId?: string }
    | { type: 'ORDER_STATUS_CHANGED'; orgId: string; orderId: string; newStatus: string; customerId: string; userId?: string }
    | { type: 'INVOICE_CREATED'; orgId: string; invoiceId: string; customerId: string; userId?: string }
    | { type: 'PAYMENT_RECEIVED'; orgId: string; paymentId: string; customerId: string; amount: number; userId?: string }
    | { type: 'PAYMENT_OVERDUE'; orgId: string; invoiceId: string; customerId: string; daysOverdue: number; userId?: string }
    | { type: 'LOW_STOCK'; orgId: string; productId: string; currentQty: number; minQty: number; userId?: string }
    | { type: 'SALESMAN_CHECKIN'; orgId: string; salesmanId: string; customerId: string; userId?: string }
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
        private events: EventsGateway,
    ) { }

    async notify(orgId: string, event: NotificationEvent): Promise<void> {
        // 1. Always create Notification record in DB
        const notification = await this.prisma.notification.create({
            data: {
                orgId,
                userId: (event as any).userId ?? null,
                type: event.type,
                title: this.getTitle(event),
                body: this.getMessage(event),
                data: event as any,
                isRead: false,
                channel: [],
            },
        });

        // Push to SSE stream for real-time dashboard updates
        this.events.emit(orgId, event.type, { notificationId: notification.id, ...event });

        // 2. Queue channel-specific sends
        try {
            switch (event.type) {
                case 'NEW_ORDER':
                case 'NEW_WHATSAPP_ORDER': {
                    const isWa = event.type === 'NEW_WHATSAPP_ORDER';
                    const num = (event as any).orderNumber ? `#${(event as any).orderNumber}` : '';
                    const name = (event as any).customerName ? ` from ${(event as any).customerName}` : '';
                    const amt = (event as any).netAmount ? ` (₹${Number((event as any).netAmount).toLocaleString('en-IN')})` : '';
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId,
                        type: 'new_order',
                        orderId: event.orderId,
                        title: isWa ? `📲 New WhatsApp Order ${num}` : `🛍️ New Order ${num}`,
                        body: `Order received${name}${amt}`,
                        url: `/orders/${event.orderId}`,
                    });
                    break;
                }

                case 'ORDER_STATUS_CHANGED':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId,
                        type: 'order_status',
                        orderId: event.orderId,
                        title: 'Order Updated',
                        body: `Order status changed to ${event.newStatus}`,
                        url: `/orders/${event.orderId}`,
                    });
                    break;

                case 'PAYMENT_RECEIVED':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId,
                        type: 'payment_received',
                        title: 'Payment Received',
                        body: `₹${event.amount.toLocaleString('en-IN')} received`,
                        url: `/payments`,
                    });
                    break;

                case 'PAYMENT_OVERDUE':
                    await this.queueService.addToQueue('notification', 'send-whatsapp', {
                        orgId,
                        invoiceId: event.invoiceId,
                        customerId: event.customerId,
                        daysOverdue: event.daysOverdue,
                    });
                    break;

                case 'LOW_STOCK':
                    await this.queueService.addToQueue('notification', 'send-push', {
                        orgId,
                        type: 'low_stock',
                        productId: event.productId,
                        title: 'Low Stock Alert',
                        body: `Only ${event.currentQty} units left (min: ${event.minQty})`,
                        url: `/inventory`,
                    });
                    break;

                case 'DAILY_BRIEFING':
                    for (const userId of event.targetUserIds) {
                        await this.queueService.addToQueue('notification', 'send-whatsapp-briefing', {
                            orgId,
                            userId,
                            message: event.briefingMessage,
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
        switch (event.type) {
            case 'NEW_ORDER':
                return (event as any).orderNumber ? `New Order #${(event as any).orderNumber}` : 'New Order';
            case 'NEW_WHATSAPP_ORDER':
                return (event as any).orderNumber ? `New WhatsApp Order #${(event as any).orderNumber}` : 'New WhatsApp Order';
            case 'ORDER_STATUS_CHANGED':
                return 'Order Status Updated';
            case 'INVOICE_CREATED':
                return 'Invoice Created';
            case 'PAYMENT_RECEIVED':
                return 'Payment Received';
            case 'PAYMENT_OVERDUE':
                return 'Payment Overdue';
            case 'LOW_STOCK':
                return 'Low Stock Alert';
            case 'SALESMAN_CHECKIN':
                return 'Salesman Check-in';
            case 'DAILY_BRIEFING':
                return 'Daily Briefing';
            case 'USER_INVITED':
                return 'User Invited';
            default:
                return (event as any).type ?? 'Notification';
        }
    }

    private getMessage(event: NotificationEvent): string {
        switch (event.type) {
            case 'NEW_ORDER':
            case 'NEW_WHATSAPP_ORDER': {
                const name = (event as any).customerName ? ` from ${(event as any).customerName}` : '';
                const amt = (event as any).netAmount ? ` (₹${Number((event as any).netAmount).toLocaleString('en-IN')})` : '';
                return `Order received${name}${amt}`;
            }
            case 'PAYMENT_RECEIVED':
                return `₹${event.amount.toLocaleString('en-IN')} payment received`;
            case 'LOW_STOCK':
                return `${event.currentQty} units remaining (min: ${event.minQty})`;
            case 'PAYMENT_OVERDUE':
                return `Invoice overdue by ${event.daysOverdue} days`;
            default:
                return (event as any).type ?? '';
        }
    }
}
