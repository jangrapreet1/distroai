import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 500 },   // Ramp to 500
        { duration: '30s', target: 1000 },  // Ramp to 1000
        { duration: '60s', target: 1000 },  // Sustain 1000
        { duration: '30s', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        http_req_failed: ['rate<0.001'],  // < 0.1% error rate
    },
};

const BASE_URL = __ENV.API_URL || 'https://api.distroai.in';

export default function () {
    const res = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, {
        headers: {
            Authorization: `Bearer ${__ENV.TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.1);
}
