import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';

import InvoiceEmail from './templates/InvoiceEmail';
import PaymentReminderEmail from './templates/PaymentReminderEmail';
import WelcomeEmail from './templates/WelcomeEmail';
import OTPEmail from './templates/OTPEmail';
import WeeklyDigestEmail from './templates/WeeklyDigestEmail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;
  private readonly fromEmail: string;
  private readonly isConfigured: boolean;

  constructor(private config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.fromEmail = config.get<string>('FROM_EMAIL', 'noreply@distroai.in');
    this.isConfigured = !!apiKey;

    if (this.isConfigured) {
      this.client = new Resend(apiKey);
      this.logger.log('Resend email client configured');
    } else {
      this.logger.warn('Resend not configured — emails will be logged to console');
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.client) {
      this.logger.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}\n${html.slice(0, 200)}...`);
      return;
    }
    try {
      await this.client.emails.send({ from: this.fromEmail, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, (err as Error).message);
    }
  }

  async sendInvoice(to: string, pdfUrl: string, invoiceNumber: string, amount: number, orgName: string) {
    const element = React.createElement(InvoiceEmail, { orgName, invoiceNumber, amount, pdfUrl });
    const html = await render(element);
    await this.send(to, `Invoice ${invoiceNumber} from ${orgName}`, html);
  }

  async sendPaymentReminder(to: string, customerName: string, invoiceNumber: string, amount: number, dueDate: Date, paymentLink: string, orgName: string) {
    const element = React.createElement(PaymentReminderEmail, { orgName, customerName, invoiceNumber, amount, dueDate, paymentLink });
    const html = await render(element);
    await this.send(to, `Payment reminder for ${invoiceNumber}`, html);
  }

  async sendWelcome(to: string, firstName: string, orgName: string, tempPassword?: string) {
    const element = React.createElement(WelcomeEmail, { orgName, firstName, tempPassword });
    const html = await render(element);
    await this.send(to, `Welcome to ${orgName} on DistroAI`, html);
  }

  async sendOTP(to: string, otp: string) {
    const element = React.createElement(OTPEmail, { otp });
    const html = await render(element);
    await this.send(to, `Your DistroAI verification code: ${otp}`, html);
  }

  async sendWeeklyDigest(to: string, firstName: string, data: Record<string, unknown>) {
    const element = React.createElement(WeeklyDigestEmail, { firstName, data });
    const html = await render(element);
    await this.send(to, 'Your weekly DistroAI digest', html);
  }
}
