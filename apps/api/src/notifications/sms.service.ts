import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SMSService {
    private readonly logger = new Logger(SMSService.name);
    private readonly authKey: string;
    private readonly senderId: string;
    private readonly isConfigured: boolean;

    constructor(private config: ConfigService) {
        this.authKey = config.get<string>('MSG91_AUTH_KEY', '');
        this.senderId = config.get<string>('MSG91_SENDER_ID', 'DISTRO');
        this.isConfigured = !!this.authKey;

        if (!this.isConfigured) {
            this.logger.warn('MSG91 not configured — SMS will be logged to console');
        }
    }

    private async send(phone: string, message: string) {
        if (!this.isConfigured) {
            this.logger.log(`[SMS STUB] To: ${phone} | ${message}`);
            return;
        }
        try {
            await axios.post('https://api.msg91.com/api/v5/flow/', {
                sender: this.senderId,
                route: '4', // transactional
                mobiles: phone.replace(/^\+/, ''),
                message,
            }, {
                headers: { authkey: this.authKey },
            });
        } catch (err) {
            this.logger.error(`Failed to send SMS to ${phone}`, (err as Error).message);
        }
    }

    async sendOTP(phone: string, otp: string) {
        await this.send(phone, `Your DistroAI verification code is ${otp}. Valid for 10 minutes.`);
    }

    async sendPaymentReminder(phone: string, customerName: string, amount: number, paymentLink: string) {
        await this.send(phone, `Hi ${customerName}, payment of Rs.${amount.toLocaleString('en-IN')} is due. Pay here: ${paymentLink} - DistroAI`);
    }

    async sendOrderConfirmation(phone: string, customerName: string, orderNumber: string, amount: number) {
        await this.send(phone, `Hi ${customerName}, order ${orderNumber} for Rs.${amount.toLocaleString('en-IN')} confirmed. Track at app.distroai.in - DistroAI`);
    }

    async sendDeliveryNotification(phone: string, customerName: string, orderNumber: string) {
        await this.send(phone, `Hi ${customerName}, order ${orderNumber} has been delivered! Thank you - DistroAI`);
    }
}
