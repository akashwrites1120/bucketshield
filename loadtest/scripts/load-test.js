import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const requests = new Counter('http_requests');
const rejected = new Counter('http_requests_rejected');
const latency = new Trend('http_request_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up to 20 VUs
    { duration: '1m', target: 20 },  // stay at 20 VUs for 1 minute
    { duration: '30s', target: 50 }, // ramp up to 50 VUs
    { duration: '1m', target: 50 },  // stay at 50 VUs for 1 minute
    { duration: '30s', target: 0 },  // ramp down to 0 VUs
  ],
  thresholds: {
    'http_requests': ['count>100'],
    'http_request_latency': ['p(95)<500'], // 95% of requests < 500ms
    'http_requests_rejected': ['count>0'], // expect some rejections
  },
};

// Client IDs to test distribution
const clientIDs = ['client-a', 'client-b', 'client-c'];

// Burst configuration
const burstSize = 15;
const burstInterval = 30; // seconds between bursts

export default function () {
  const clientId = clientIDs[__VU % clientIDs.length];
  const params = {
    headers: {
      'X-Client-ID': clientId,
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  // Regular sustained load (1 request per VU per iteration)
  let res = http.post('http://localhost:8080/api/protected', '', params);
  requests.add(1);

  const checkResult = check(res, {
    'status is 200': (r) => r.status === 200,
    'status is 429': (r) => r.status === 429,
    'transaction time OK': (r) => r.timings.duration < 500,
  });

  if (res.status === 429) {
    rejected.add(1);
  }

  latency.add(res.timings.duration);

  // Periodic burst traffic
  if (__VU === 0 && (__ITER % burstInterval === 0)) {
    console.log(`VU ${__VU}: Starting burst of ${burstSize} requests`);
    const burstResponses = [];

    // Fire burst requests concurrently
    for (let i = 0; i < burstSize; i++) {
      const burstRes = http.post('http://localhost:8080/api/protected', '', params);
      burstResponses.push(burstRes);
      requests.add(1);

      if (burstRes.status === 429) {
        rejected.add(1);
      }

      latency.add(burstRes.timings.duration);
    }

    const allowedInBurst = burstResponses.filter(r => r.status === 200).length;
    console.log(`VU ${__VU}: Burst completed - ${allowedInBurst}/${burstSize} allowed`);

    // Small delay after burst to observe refill
    sleep(1);
  }

  // Normal think time between requests
  sleep(0.5);
}