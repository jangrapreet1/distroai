import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
    let service: RazorpayService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RazorpayService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockImplementation((key: string) => {
                            if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_123';
                            if (key === 'RAZORPAY_KEY_SECRET') return 'rzp_secret_456';
                            if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'test_webhook_secret';
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<RazorpayService>(RazorpayService);
        // Suppress expected logs during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should return a stub payment link when Razorpay client is not initialized', async () => {
        const result = await service.createPaymentLink({
            amount: 100000,
            currency: 'INR',
            description: 'Test Invoice',
            referenceId: 'TEST-INV-001',
            customerName: 'Test Customer',
            customerPhone: '9876543210',
        });
        expect(result).toBeDefined();
        expect(result.id).toContain('stub_pl_');
        expect(result.shortUrl).toContain('https://rzp.io/i/');
    });

    it('should verify webhook signature correctly', () => {
        const crypto = require('crypto');
        const payload = JSON.stringify({ event: 'payment.captured' });
        const secret = 'test_webhook_secret';
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const isValid = service.verifyWebhookSignature(payload, signature);
        expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
        const payload = JSON.stringify({ event: 'payment.captured' });
        const signature = 'invalid_signature_hex';

        const isValid = service.verifyWebhookSignature(payload, signature);
        expect(isValid).toBe(false);
    });
});
