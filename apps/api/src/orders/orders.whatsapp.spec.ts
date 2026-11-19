import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { InvoicesService } from '../invoices/invoices.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { RazorpayService } from '../payments/razorpay.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrdersService - WhatsApp Automated Order Confirmation & Payment Links', () => {
    let service: OrdersService;
    let prisma: {
        order: { findFirst: jest.Mock };
    };
    let wa: {
        sendText: jest.Mock;
        sendDocument: jest.Mock;
    };
    let razorpay: {
        createPaymentLink: jest.Mock;
    };

    const mockOrder = {
        id: 'ord-123',
        orgId: 'org-456',
        orderNumber: 'ORD-00042',
        status: 'CONFIRMED',
        netAmount: 5000,
        balanceAmount: 5000,
        createdAt: new Date('2026-11-03T10:00:00Z'),
        customer: {
            id: 'cust-1',
            name: 'Radhe Shyam Traders',
            phone: '9812466888',
            email: 'radhe@example.com',
        },
        items: [
            {
                productId: 'p1',
                quantity: 10,
                unit: 'Boxes',
                totalAmount: 5000,
                product: { name: 'Tata Tea Gold 500g', unit: 'Boxes' },
                variant: null,
            },
        ],
        invoice: {
            id: 'inv-1',
            invoiceNumber: 'INV-00042',
            balanceAmount: 5000,
            pdfUrl: 'https://s3.distroai.in/invoices/org-456/inv-1.pdf',
        },
        organization: {
            id: 'org-456',
            name: 'Sharma Distributors',
            phone: '9811122233',
            settings: {
                upiId: 'sharmadistro@okaxis',
            },
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            order: { findFirst: jest.fn().mockResolvedValue(mockOrder) },
        };
        wa = {
            sendText: jest.fn().mockResolvedValue(undefined),
            sendDocument: jest.fn().mockResolvedValue(undefined),
        };
        razorpay = {
            createPaymentLink: jest.fn().mockResolvedValue({
                id: 'plink_123',
                shortUrl: 'https://rzp.io/i/test_link',
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: PrismaService, useValue: prisma },
                { provide: RedisService, useValue: { del: jest.fn().mockResolvedValue(1) } },
                { provide: InvoicesService, useValue: {} },
                { provide: EventsService, useValue: { emit: jest.fn() } },
                { provide: NotificationsService, useValue: { notify: jest.fn() } },
                { provide: WhatsAppService, useValue: wa },
                { provide: RazorpayService, useValue: razorpay },
            ],
        }).compile();

        service = module.get<OrdersService>(OrdersService);
    });

    it('should generate a Razorpay payment link and send WhatsApp text & PDF confirmation', async () => {
        const result = await service.sendWhatsAppConfirmation('org-456', 'ord-123');

        expect(result.success).toBe(true);
        expect(result.to).toBe('919812466888');
        expect(result.paymentLinkUrl).toBe('https://rzp.io/i/test_link');

        // Verify Razorpay payment link creation
        expect(razorpay.createPaymentLink).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 500000, // 5000 * 100 paise
                customerName: 'Radhe Shyam Traders',
                customerPhone: '9812466888',
                description: 'Payment for Order #ORD-00042',
            }),
        );

        // Verify WhatsApp text message contents
        expect(wa.sendText).toHaveBeenCalledWith(
            'org-456',
            '919812466888',
            expect.stringContaining('Order Confirmed — Sharma Distributors'),
        );
        expect(wa.sendText).toHaveBeenCalledWith(
            'org-456',
            '919812466888',
            expect.stringContaining('https://rzp.io/i/test_link'),
        );
        expect(wa.sendText).toHaveBeenCalledWith(
            'org-456',
            '919812466888',
            expect.stringContaining('sharmadistro@okaxis'),
        );

        // Verify PDF invoice attachment
        expect(wa.sendDocument).toHaveBeenCalledWith(
            'org-456',
            '919812466888',
            'https://s3.distroai.in/invoices/org-456/inv-1.pdf',
            'Invoice-ORD-00042.pdf',
            expect.stringContaining('Invoice for Order #ORD-00042'),
        );
    });

    it('should throw NotFoundException if order does not exist or belongs to another tenant', async () => {
        prisma.order.findFirst.mockResolvedValue(null);

        await expect(service.sendWhatsAppConfirmation('org-wrong', 'ord-123')).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should throw BadRequestException if customer has no phone number', async () => {
        prisma.order.findFirst.mockResolvedValue({
            ...mockOrder,
            customer: { ...mockOrder.customer, phone: null },
        });

        await expect(service.sendWhatsAppConfirmation('org-456', 'ord-123')).rejects.toThrow(
            BadRequestException,
        );
    });
});
