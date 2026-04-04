import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { QueueService } from '../queue/queue.service';

// Bot states
type BotState =
    | 'IDLE'
    | 'MAIN_MENU'
    | 'ORDER_PRODUCT_SELECT'
    | 'ORDER_QTY_INPUT'
    | 'ORDER_ADD_MORE'
    | 'ORDER_CONFIRM'
    | 'ORDER_AWAITING_CONFIRM'
    | 'ORDER_TRACK_INPUT';

interface OrderItem {
    productId: string;
    name: string;
    qty: number;
    price: number;
    total: number;
}

interface SessionContext {
    items?: OrderItem[];
    currentProduct?: { productId: string; name: string; price: number; unit: string };
    customerId?: string;
    orgId?: string;
}

function formatINR(n: number): string {
    return '₹' + n.toLocaleString('en-IN');
}

const ORDER_KEYWORDS = ['order', 'order karni', 'order chahiye', 'mujhe order', 'hi', 'hello', 'help', 'menu'];

@Injectable()
export class BotHandler {
    private readonly logger = new Logger(BotHandler.name);

    constructor(
        private prisma: PrismaService,
        private wa: WhatsAppService,
        private queueService: QueueService,
    ) { }

    async handleIncoming(phoneNumberId: string, msg: Record<string, unknown>) {
        const from = msg.from as string;
        const msgId = msg.id as string;
        const msgType = msg.type as string;

        // Mark as read (we need orgId, but resolve it first below)
        // Moved after orgId resolution

        // Find org by phoneNumberId
        const waConfig = await this.prisma.whatsAppConfig.findFirst({
            where: { phoneNumberId },
            include: { organization: true },
        });
        const orgId = waConfig?.orgId;
        if (!orgId) {
            this.logger.warn(`No org found for phoneNumberId ${phoneNumberId}`);
            return;
        }

        // Mark as read (now that we have orgId)
        await this.wa.markRead(orgId, msgId);

        // Load or create session (persisted in DB)
        let session = await this.prisma.whatsAppSession.findFirst({
            where: { orgId, phone: from },
        });
        if (!session) {
            session = await this.prisma.whatsAppSession.create({
                data: { orgId, phone: from, state: 'IDLE', context: {} },
            });
        }

        const state = session.state as BotState;
        const context = (session.context ?? {}) as SessionContext;

        // Extract message text / button reply / list reply
        let text = '';
        let buttonId = '';
        let listRowId = '';

        if (msgType === 'text') {
            text = ((msg.text as Record<string, unknown>)?.body as string ?? '').trim();
        } else if (msgType === 'interactive') {
            const interactive = msg.interactive as Record<string, unknown>;
            const iType = interactive.type as string;
            if (iType === 'button_reply') {
                buttonId = (interactive.button_reply as Record<string, unknown>)?.id as string ?? '';
                text = (interactive.button_reply as Record<string, unknown>)?.title as string ?? '';
            } else if (iType === 'list_reply') {
                listRowId = (interactive.list_reply as Record<string, unknown>)?.id as string ?? '';
                text = (interactive.list_reply as Record<string, unknown>)?.title as string ?? '';
            }
        } else if (msgType === 'audio') {
            // Voice orders — stub for now, will integrate OpenAI Whisper in Phase 5
            await this.wa.sendText(orgId, from, "Voice orders will be supported soon! Please type your order or use the menu. Send 'order' to start.");
            return;
        }

        const lowerText = text.toLowerCase();

        // State machine
        try {
            switch (state) {
                case 'IDLE':
                    if (ORDER_KEYWORDS.some((k) => lowerText.includes(k))) {
                        await this.wa.sendButtons(orgId, from, 'Welcome! What would you like to do?', [
                            { id: 'place_order', title: 'Place Order' },
                            { id: 'check_balance', title: 'Check Balance' },
                            { id: 'track_order', title: 'Track Order' },
                        ]);
                        await this.updateSession(session.id, 'MAIN_MENU', { ...context, orgId });
                    } else {
                        await this.wa.sendText(orgId, from, "Hi! I'm the DistroAI ordering assistant. Type 'order' to get started or say 'hi' for the menu.");
                    }
                    break;

                case 'MAIN_MENU':
                    if (buttonId === 'place_order') {
                        await this.sendProductList(orgId, from);
                        await this.updateSession(session.id, 'ORDER_PRODUCT_SELECT', { ...context, items: [] });
                    } else if (buttonId === 'check_balance') {
                        await this.handleBalanceCheck(orgId, from);
                        await this.updateSession(session.id, 'IDLE', {});
                    } else if (buttonId === 'track_order') {
                        await this.wa.sendText(orgId, from, 'Enter your order number (e.g. ORD-2025-00123):');
                        await this.updateSession(session.id, 'ORDER_TRACK_INPUT', context);
                    } else {
                        await this.wa.sendButtons(orgId, from, 'Please select an option:', [
                            { id: 'place_order', title: 'Place Order' },
                            { id: 'check_balance', title: 'Check Balance' },
                            { id: 'track_order', title: 'Track Order' },
                        ]);
                    }
                    break;

                case 'ORDER_PRODUCT_SELECT':
                    if (listRowId) {
                        const product = await this.prisma.product.findFirst({
                            where: { id: listRowId, orgId },
                        });
                        if (product) {
                            await this.wa.sendButtons(orgId, from, `How many ${product.name}? (Price: ${formatINR(Number(product.sellingPrice))} per ${product.unit})`, [
                                { id: 'qty_1', title: '1' },
                                { id: 'qty_5', title: '5' },
                                { id: 'qty_10', title: '10' },
                            ]);
                            await this.updateSession(session.id, 'ORDER_QTY_INPUT', {
                                ...context,
                                currentProduct: {
                                    productId: product.id,
                                    name: product.name,
                                    price: Number(product.sellingPrice),
                                    unit: product.unit,
                                },
                            });
                        }
                    } else {
                        await this.wa.sendText(orgId, from, 'Please select a product from the list.');
                    }
                    break;

                case 'ORDER_QTY_INPUT': {
                    let qty = 0;
                    if (buttonId === 'qty_1') qty = 1;
                    else if (buttonId === 'qty_5') qty = 5;
                    else if (buttonId === 'qty_10') qty = 10;
                    else qty = parseInt(text, 10);

                    if (!qty || qty <= 0 || isNaN(qty)) {
                        await this.wa.sendText(orgId, from, 'Please enter a valid quantity (positive number).');
                        break;
                    }

                    const cp = context.currentProduct!;
                    const newItem: OrderItem = {
                        productId: cp.productId, name: cp.name, qty, price: cp.price, total: cp.price * qty,
                    };
                    const items = [...(context.items ?? []), newItem];

                    const summary = items.map((it: OrderItem) => `• ${it.name} x${it.qty} — ${formatINR(it.total)}`).join('\n');
                    const grandTotal = items.reduce((s: number, it: OrderItem) => s + it.total, 0);

                    await this.wa.sendButtons(orgId, from, `📦 Current order:\n${summary}\nSubtotal: ${formatINR(grandTotal)}\n\nAdd more items?`, [
                        { id: 'add_more', title: 'Add More' },
                        { id: 'confirm_order', title: 'Confirm Order' },
                        { id: 'cancel_order', title: 'Cancel' },
                    ]);
                    await this.updateSession(session.id, 'ORDER_ADD_MORE', { ...context, items, currentProduct: undefined });
                    break;
                }

                case 'ORDER_ADD_MORE':
                    if (buttonId === 'add_more') {
                        await this.sendProductList(orgId, from);
                        await this.updateSession(session.id, 'ORDER_PRODUCT_SELECT', context);
                    } else if (buttonId === 'confirm_order') {
                        const items = context.items ?? [];
                        const total = items.reduce((s: number, it: OrderItem) => s + it.total, 0);
                        const summary = items.map((it: OrderItem) => `• ${it.name} x${it.qty} — ${formatINR(it.total)}`).join('\n');

                        await this.wa.sendButtons(orgId, from, `📦 Order Summary:\n${summary}\n\nTotal: ${formatINR(total)} + GST\n\nConfirm this order?`, [
                            { id: 'yes_confirm', title: 'Yes, Confirm' },
                            { id: 'no_cancel', title: 'No, Cancel' },
                        ]);
                        await this.updateSession(session.id, 'ORDER_AWAITING_CONFIRM', context);
                    } else if (buttonId === 'cancel_order') {
                        await this.wa.sendText(orgId, from, "Order cancelled. Type 'order' anytime to start again.");
                        await this.updateSession(session.id, 'IDLE', {});
                    }
                    break;

                case 'ORDER_AWAITING_CONFIRM':
                    if (buttonId === 'yes_confirm') {
                        const order = await this.createOrderFromSession(orgId, from, context);
                        if (order) {
                            await this.wa.sendText(orgId, from, `✅ Order #${order.orderNumber} confirmed!\nExpected delivery: within 2-3 days.\nWe'll notify you when dispatched.`);
                            // Queue notification to owner
                            await this.queueService.addToQueue('notification', 'send-push', {
                                type: 'NEW_WHATSAPP_ORDER', orgId, orderId: order.id,
                            });
                        } else {
                            await this.wa.sendText(orgId, from, 'Sorry, there was an error creating your order. Please try again.');
                        }
                        await this.updateSession(session.id, 'IDLE', {});
                    } else if (buttonId === 'no_cancel') {
                        await this.wa.sendText(orgId, from, "Order cancelled. Type 'order' anytime to start again.");
                        await this.updateSession(session.id, 'IDLE', {});
                    }
                    break;

                case 'ORDER_TRACK_INPUT':
                    await this.handleOrderTracking(orgId, from, text);
                    await this.updateSession(session.id, 'IDLE', {});
                    break;

                default:
                    await this.wa.sendText(orgId, from, "Hi! Type 'order' to get started.");
                    await this.updateSession(session.id, 'IDLE', {});
            }
        } catch (err) {
            this.logger.error(`Bot error for ${from} in state ${state}`, (err as Error).message);
            await this.wa.sendText(orgId, from, "Something went wrong. Type 'order' to start again.");
            await this.updateSession(session.id, 'IDLE', {});
        }

        // Save incoming message to DB
        await this.prisma.whatsAppMessage.create({
            data: {
                orgId,
                direction: 'INBOUND',
                phone: from,
                messageType: msgType,
                content: text || '[interactive]',
                waMessageId: msgId,
                status: 'RECEIVED',
            },
        }).catch((e: Error) => this.logger.error('Failed to save WA message', e.message));
    }

    private async updateSession(sessionId: string, state: BotState, context: SessionContext) {
        await this.prisma.whatsAppSession.update({
            where: { id: sessionId },
            data: { state, context: context as any },
        });
    }

    private async sendProductList(orgId: string, to: string) {
        const products = await this.prisma.product.findMany({
            where: { orgId, isActive: true },
            orderBy: { name: 'asc' },
            take: 20,
            select: { id: true, name: true, sellingPrice: true, category: true, unit: true },
        });

        if (!products.length) {
            await this.wa.sendText(orgId, to, 'No products available. Please contact your distributor.');
            return;
        }

        // Group by category
        const grouped = new Map<string, typeof products>();
        for (const p of products) {
            const cat = p.category || 'General';
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(p);
        }

        const sections = Array.from(grouped.entries()).map(([title, items]) => ({
            title,
            rows: items.map((p: any) => ({
                id: p.id,
                title: p.name.slice(0, 24),
                description: `${formatINR(Number(p.sellingPrice))} per ${p.unit}`,
            })),
        }));

        await this.wa.sendList(orgId, to, 'Our Products', 'Select a product to add to your order:', 'View Products', sections);
    }

    private async handleBalanceCheck(orgId: string, to: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { orgId, phone: to.replace(/^\+?91/, '') },
        });

        if (!customer) {
            await this.wa.sendText(orgId, to, "We couldn't find your account. Please contact your distributor.");
            return;
        }

        const lastPayment = await this.prisma.payment.findFirst({
            where: { orgId, customerId: customer.id },
            orderBy: { createdAt: 'desc' },
        });

        let msg = `💰 Your Account:\nOutstanding: ${formatINR(Number(customer.outstandingAmount))}`;
        if (lastPayment) {
            msg += `\nLast payment: ${formatINR(Number(lastPayment.amount))} on ${new Date(lastPayment.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
        if (Number(customer.outstandingAmount) === 0) {
            msg += '\n\n✅ Your account is clear! Thank you!';
        } else {
            const org = await this.prisma.organization.findUnique({
                where: { id: orgId },
                include: { settings: true },
            });
            const upiId = (org?.settings as any)?.upiId;
            if (upiId) {
                const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(org?.name ?? '')}&am=${Number(customer.outstandingAmount)}&cu=INR`;
                msg += `\n\nPay via UPI: ${upiLink}`;
            }
        }
        await this.wa.sendText(orgId, to, msg);
    }

    private async handleOrderTracking(orgId: string, to: string, orderNumber: string) {
        const order = await this.prisma.order.findFirst({
            where: { orgId, orderNumber: orderNumber.trim().toUpperCase() },
            include: { items: { include: { product: true } } },
        });

        if (!order) {
            await this.wa.sendText(orgId, to, 'Order not found. Please check the order number and try again.');
            return;
        }

        const statusEmoji: Record<string, string> = {
            DRAFT: '📝', CONFIRMED: '✅', PACKED: '📦', DISPATCHED: '🚛', DELIVERED: '🎉', CANCELLED: '❌',
        };

        const itemsList = order.items.map((it: any) => `• ${it.product.name} x${it.quantity}`).join('\n');
        await this.wa.sendText(orgId, to, `📦 Order #${order.orderNumber}\nStatus: ${statusEmoji[order.status] ?? '📋'} ${order.status}\n\nItems:\n${itemsList}\n\nTotal: ${formatINR(Number(order.netAmount))}`);
    }

    private async createOrderFromSession(orgId: string, phone: string, context: SessionContext) {
        try {
            // Find or create customer
            const cleanPhone = phone.replace(/^\+?91/, '');
            let customer = await this.prisma.customer.findFirst({ where: { orgId, phone: cleanPhone } });
            if (!customer) {
                customer = await this.prisma.customer.create({
                    data: { orgId, name: `WhatsApp Customer (${cleanPhone})`, phone: cleanPhone },
                });
            }

            // Get default warehouse
            const defaultWarehouse = await this.prisma.warehouse.findFirst({
                where: { orgId, isDefault: true },
            });
            const warehouseId = defaultWarehouse?.id ?? '';

            const items = context.items ?? [];
            const totalAmount = items.reduce((s: number, it: OrderItem) => s + it.total, 0);

            // Generate order number
            const count = await this.prisma.order.count({ where: { orgId } });
            const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

            const order = await this.prisma.order.create({
                data: {
                    orgId,
                    customerId: customer.id,
                    warehouseId,
                    orderNumber,
                    source: 'WHATSAPP',
                    status: 'CONFIRMED',
                    totalAmount,
                    discountAmount: 0,
                    taxAmount: 0,
                    netAmount: totalAmount,
                    items: {
                        create: items.map((it: OrderItem) => ({
                            productId: it.productId,
                            quantity: it.qty,
                            unit: 'PCS',
                            price: it.price,
                            discount: 0,
                            taxRate: 0,
                            taxAmount: 0,
                            totalAmount: it.total,
                        })),
                    },
                },
            });

            return order;
        } catch (err) {
            this.logger.error('Failed to create WhatsApp order', (err as Error).message);
            return null;
        }
    }
}
