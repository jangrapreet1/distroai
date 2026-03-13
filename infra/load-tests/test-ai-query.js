import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '15s', target: 10 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<8000'],  // AI is inherently slower
        http_req_failed: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_URL || 'https://api.distroai.in';

const queries = [
    'What is my best selling product this month?',
    'Show me customers with outstanding payments over 50000',
    'Which salesman has the highest collection rate?',
    'Suggest reorder quantities for low stock items',
    'Compare this month revenue with last month',
];

export default function () {
    const query = queries[Math.floor(Math.random() * queries.length)];
    const payload = JSON.stringify({ message: query, language: 'en' });

    const res = http.post(`${BASE_URL}/api/v1/ai/chat`, payload, {
        headers: {
            Authorization: `Bearer ${__ENV.TOKEN}`,
            'Content-Type': 'application/json',
        },
        timeout: '30s',
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
        'has response': (r) => JSON.parse(r.body).data?.response !== undefined,
    });

    sleep(2);
}
