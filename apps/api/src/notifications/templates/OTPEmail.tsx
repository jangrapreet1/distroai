import { Html, Head, Body, Container, Text, Heading, Section } from '@react-email/components';
import React from 'react';

export const OTPEmail = (props: {
    otp: string;
}) => (
    <Html>
        <Head />
        <Body style={{ backgroundColor: '#0e0c15', color: '#f0e8d5', fontFamily: 'sans-serif' }}>
            <Container style={{ margin: '0 auto', padding: '32px', maxWidth: '600px', backgroundColor: '#1a1625', borderRadius: '12px', textAlign: 'center' }}>
                <Heading style={{ color: '#d4a843', fontSize: '24px', margin: '0 0 20px 0' }}>Verification Code</Heading>

                <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#9a9080' }}>
                    Use the following code to continue:
                </Text>

                <Section style={{ backgroundColor: '#2a2436', padding: '24px', borderRadius: '12px', margin: '20px 0' }}>
                    <Text style={{ margin: 0, fontSize: '32px', fontFamily: 'monospace', letterSpacing: '8px', color: '#ffffff', fontWeight: 'bold' }}>
                        {props.otp}
                    </Text>
                </Section>

                <Text style={{ color: '#9a9080', fontSize: '12px', marginTop: '24px' }}>
                    This code will expire in 10 minutes. Please do not share this code with anyone.
                </Text>
            </Container>
        </Body>
    </Html>
);

export default OTPEmail;
