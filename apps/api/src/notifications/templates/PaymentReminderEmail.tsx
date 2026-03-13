import { Html, Head, Body, Container, Text, Button, Heading, Section } from '@react-email/components';
import React from 'react';

export const PaymentReminderEmail = (props: {
    orgName: string;
    customerName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: Date;
    paymentLink: string;
}) => (
    <Html>
        <Head />
        <Body style={{ backgroundColor: '#0e0c15', color: '#f0e8d5', fontFamily: 'sans-serif' }}>
            <Container style={{ margin: '0 auto', padding: '32px', maxWidth: '600px', backgroundColor: '#1a1625', borderRadius: '12px' }}>
                <Heading style={{ color: '#ef4444', fontSize: '24px', margin: '0 0 20px 0' }}>Payment Reminder</Heading>
                <Text style={{ fontSize: '16px', lineHeight: '24px' }}>
                    Hi {props.customerName},
                </Text>
                <Text style={{ fontSize: '16px', lineHeight: '24px' }}>
                    This is a reminder that invoice <strong>{props.invoiceNumber}</strong> for <strong>₹{props.amount.toLocaleString('en-IN')}</strong> was due on {props.dueDate.toLocaleDateString('en-IN')}.
                </Text>
                <Section style={{ textAlign: 'center' as const, marginTop: '32px', marginBottom: '32px' }}>
                    <Button href={props.paymentLink} style={{ backgroundColor: '#d4a843', color: '#0e0c15', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Pay Now Securely
                    </Button>
                </Section>
                <Text style={{ color: '#9a9080', fontSize: '12px', marginTop: '24px' }}>
                    From {props.orgName} via DistroAI. If you have already paid, please ignore this email.
                </Text>
            </Container>
        </Body>
    </Html>
);

export default PaymentReminderEmail;
