import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const failedOrders = new Counter('failed_orders');

export const options = {
    stages: [
        { duration: '15s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '60s', target: 100 },
        { duration: '15s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.01'],
        failed_orders: ['count<1'],
    },
};

const BASE_URL = __ENV.API_URL || 'https://api.distroai.in';

export default function () {
    const payload = JSON.stringify({
        customerId: 'test-customer-001',
        items: [
            { productId: 'prod-001', quantity: Math.ceil(Math.random() * 5), unitPrice: 100 },
            { productId: 'prod-002', quantity: Math.ceil(Math.random() * 3), unitPrice: 250 },
        ],
    });

    const res = http.post(`${BASE_URL}/api/v1/orders`, payload, {
        headers: {
            Authorization: `Bearer ${__ENV.TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    const ok = check(res, {
        'status is 201': (r) => r.status === 201,
        'has order ID': (r) => JSON.parse(r.body).data?.id !== undefined,
    });

    if (!ok) failedOrders.add(1);
    sleep(0.5);
}
