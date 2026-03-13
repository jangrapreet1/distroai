import http from 'k6/http';
import { check } from 'k6';

export const options = {
    stages: [
        { duration: '15s', target: 250 },
        { duration: '30s', target: 500 },
        { duration: '60s', target: 500 },
        { duration: '15s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],  // Meta requires fast ack
        http_req_failed: ['rate<0.001'],
    },
};

const BASE_URL = __ENV.API_URL || 'https://api.distroai.in';

export default function () {
    const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '919876543210', phone_number_id: '12345' },
                    messages: [{
                        from: `91${Math.floor(9000000000 + Math.random() * 999999999)}`,
                        id: `wamid.${Date.now()}`,
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        type: 'text',
                        text: { body: 'balance' },
                    }],
                },
                field: 'messages',
            }],
        }],
    });

    const res = http.post(`${BASE_URL}/api/v1/whatsapp/webhook`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response < 2s': (r) => r.timings.duration < 2000,
    });
}
