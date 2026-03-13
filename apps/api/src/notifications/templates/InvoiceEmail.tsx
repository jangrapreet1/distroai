import { Html, Head, Body, Container, Text, Button, Link, Img, Heading, Section } from '@react-email/components';
import React from 'react';

export const InvoiceEmail = (props: {
    orgName: string;
    invoiceNumber: string;
    amount: number;
    pdfUrl: string;
}) => (
    <Html>
        <Head />
        <Body style={{ backgroundColor: '#0e0c15', color: '#f0e8d5', fontFamily: 'sans-serif' }}>
            <Container style={{ margin: '0 auto', padding: '32px', maxWidth: '600px', backgroundColor: '#1a1625', borderRadius: '12px' }}>
                <Heading style={{ color: '#d4a843', fontSize: '24px', margin: '0 0 20px 0' }}>Tax Invoice from {props.orgName}</Heading>
                <Text style={{ fontSize: '16px', lineHeight: '24px' }}>
                    Your invoice <strong>{props.invoiceNumber}</strong> for the amount of <strong>₹{props.amount.toLocaleString('en-IN')}</strong> has been successfully generated.
                </Text>
                <Section style={{ textAlign: 'center' as const, marginTop: '32px', marginBottom: '32px' }}>
                    <Button href={props.pdfUrl} style={{ backgroundColor: '#d4a843', color: '#0e0c15', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Download PDF
                    </Button>
                </Section>
                <Text style={{ color: '#9a9080', fontSize: '12px', marginTop: '24px' }}>
                    This is an automated email sent on behalf of {props.orgName} via DistroAI. Please do not reply directly to this email.
                </Text>
            </Container>
        </Body>
    </Html>
);

export default InvoiceEmail;
