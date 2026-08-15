import json
import sys

def analyze_k6_results(filepath):
    """Parse k6 JSON output and extract key metrics."""
    metrics = {}

    with open(filepath, 'r') as f:
        for line in f:
            if not line.strip():
                continue

            try:
                data = json.loads(line)

                if isinstance(data, dict):
                    if data.get('type') == 'Metric':
                        # First line: {"type":"Metric","data":{"name":"http_reqs",...},"metric":"http_reqs"}
                        metric_name = data.get('metric', '')
                        metrics[metric_name] = data
                        # Ensure all metrics have a points key
                        if 'points' not in metrics[metric_name]:
                            metrics[metric_name]['points'] = []
                    elif data.get('type') == 'Point':
                        # Subsequent lines: {"metric":"http_reqs","type":"Point",...}
                        metric_name = data.get('metric', '')
                        value = data.get('value')
                        time = data.get('time')

                        # Initialize points list if not present
                        if metric_name not in metrics:
                            metrics[metric_name] = {'points': []}

                        metrics[metric_name]['points'].append({
                            'time': time,
                            'value': value
                        })

            except json.JSONDecodeError:
                continue

    # Extract summary statistics
    results = {}

    # Count total requests
    if 'http_requests' in metrics:
        results['total_requests'] = len(metrics['http_requests']['points'])

    # Rejection count
    if 'http_requests_rejected' in metrics:
        results['rejected_requests'] = len(metrics['http_requests_rejected']['points'])

    # Throughput (requests per second)
    if 'http_requests' in metrics and 'http_req_duration' in metrics:
        points = metrics['http_requests']['points']
        durations = metrics['http_req_duration']['points']

        if points and durations and len(points) == len(durations):
            start_time = points[0].get('time')
            end_time = points[-1].get('time')

            if start_time and end_time:
                duration_sec = (end_time - start_time) / 1000  # convert ms to sec
                results['throughput_rps'] = len(points) / duration_sec if duration_sec > 0 else 0

    # Latency statistics
    if 'http_req_duration' in metrics and 'points' in metrics['http_req_duration']:
        durations = [p.get('value', 0) for p in metrics['http_req_duration']['points'] if p.get('value') is not None and p['value'] > 0]

        if durations:
            results['latency_ms'] = {
                'min': min(durations),
                'max': max(durations),
                'mean': sum(durations) / len(durations),
                'p50': sorted(durations)[int(len(durations) * 0.5)],
                'p95': sorted(durations)[int(len(durations) * 0.95)],
                'p99': sorted(durations)[int(len(durations) * 0.99)],
            }

    # Rejection rate
    if 'total_requests' in results and 'rejected_requests' in results:
        results['rejection_rate_pct'] = (results['rejected_requests'] / results['total_requests'] * 100)
        results['allowed_requests'] = results['total_requests'] - results['rejected_requests']

    return results

if __name__ == '__main__':
    results = analyze_k6_results('loadtest/results.json')

    print("=" * 60)
    print("K6 Load Test Results")
    print("=" * 60)
    print(f"\nTotal Requests: {results.get('total_requests', 0)}")
    print(f"Allowed Requests: {results.get('allowed_requests', 0)}")
    print(f"Rejected Requests: {results.get('rejected_requests', 0)}")
    print(f"Rejection Rate: {results.get('rejection_rate_pct', 0):.2f}%")

    if 'throughput_rps' in results:
        print(f"\nThroughput: {results['throughput_rps']:.2f} requests/sec")

    if 'latency_ms' in results:
        lat = results['latency_ms']
        print(f"\nLatency:")
        print(f"  Min: {lat['min']:.2f}ms")
        print(f"  Max: {lat['max']:.2f}ms")
        print(f"  Mean: {lat['mean']:.2f}ms")
        print(f"  P50: {lat['p50']:.2f}ms")
        print(f"  P95: {lat['p95']:.2f}ms")
        print(f"  P99: {lat['p99']:.2f}ms")

    print("\n" + "=" * 60)
    print("Test Configuration")
    print("=" * 60)
    print("VUs: 50 max")
    print("Stages: 30s ramp to 20 VU, 1m hold, 30s ramp to 50 VU, 1m hold, 30s ramp down")
    print("Burst: 15 requests every 30 seconds")
    print("\n" + "=" * 60)