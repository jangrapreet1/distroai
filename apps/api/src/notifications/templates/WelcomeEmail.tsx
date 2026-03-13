import { Html, Head, Body, Container, Text, Button, Heading, Section } from '@react-email/components';
import React from 'react';

export const WelcomeEmail = (props: {
    orgName: string;
    firstName: string;
    tempPassword?: string;
}) => (
    <Html>
        <Head />
        <Body style={{ backgroundColor: '#0e0c15', color: '#f0e8d5', fontFamily: 'sans-serif' }}>
            <Container style={{ margin: '0 auto', padding: '32px', maxWidth: '600px', backgroundColor: '#1a1625', borderRadius: '12px' }}>
                <Heading style={{ color: '#d4a843', fontSize: '24px', margin: '0 0 20px 0' }}>Welcome to {props.orgName}!</Heading>
                <Text style={{ fontSize: '16px', lineHeight: '24px' }}>
                    Hi {props.firstName}, your account has been created on the DistroAI platform.
                </Text>

                {props.tempPassword && (
                    <Section style={{ backgroundColor: '#2a2436', padding: '16px', borderRadius: '8px', margin: '20px 0' }}>
                        <Text style={{ margin: 0, color: '#9a9080', fontSize: '12px' }}>Your temporary password:</Text>
                        <Text style={{ margin: '8px 0 0 0', fontSize: '20px', fontFamily: 'monospace', letterSpacing: '2px' }}>
                            {props.tempPassword}
                        </Text>
                    </Section>
                )}

                <Section style={{ textAlign: 'center' as const, marginTop: '32px', marginBottom: '32px' }}>
                    <Button href="https://app.distroai.in/login" style={{ backgroundColor: '#d4a843', color: '#0e0c15', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Login to Dashboard
                    </Button>
                </Section>

                <Text style={{ color: '#9a9080', fontSize: '12px', marginTop: '24px' }}>
                    Please change your password immediately upon your first login.
                </Text>
            </Container>
        </Body>
    </Html>
);

export default WelcomeEmail;
