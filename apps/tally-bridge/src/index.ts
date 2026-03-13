import { TallyClient } from './tally-client';
import { generateSalesReceiptXml, SalesReceiptData } from './xml-generator';

async function main() {
    console.log('DistroAI Tally Bridge Starting...');

    const client = new TallyClient();
    const isConnected = await client.checkConnection();

    if (!isConnected) {
        console.error('ERROR: Could not connect to Tally on http://localhost:9000');
        console.error('Please ensure Tally is running and configured for ODBC/HTTP Server.');
        process.exit(1);
    }
    console.log('Connected to Tally successfully.');

    // Mock processing a payment queue from API
    console.log('Polling for new payments to sync...');

    // Example test sync
    const testData: SalesReceiptData = {
        id: 'PAY-1234',
        date: '20250310',
        customerName: 'Demo Retailer',
        amount: 5000,
        receiptNumber: 'RCPT-001',
    };

    const xml = generateSalesReceiptXml(testData);
    console.log('Generated XML:', xml);

    try {
        const response = await client.postXml(xml);
        console.log('Tally Response:', response);
    } catch (e) {
        console.log('Sync failed during local development test without actual Tally.');
    }
}

main().catch(console.error);
