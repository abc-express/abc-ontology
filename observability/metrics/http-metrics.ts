export interface HttpMetricLabels {
  method: string;
  route: string;
  status: string;
}

interface CounterKey {
  method: string;
  route: string;
  status: string;
}

interface DurationStats {
  count: number;
  sumMs: number;
}

function counterKey(labels: CounterKey): string {
  return `${labels.method}|${labels.route}|${labels.status}`;
}

function durationKey(method: string, route: string): string {
  return `${method}|${route}`;
}

/**
 * In-process HTTP metrics with Prometheus text exposition.
 * Metric names align with `observability/metrics/prometheus-rules.yaml`.
 */
export class HttpMetricsRegistry {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, DurationStats>();

  recordRequest(labels: HttpMetricLabels, durationMs: number): void {
    const key = counterKey(labels);
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
    const dKey = durationKey(labels.method, labels.route);
    const prev = this.durations.get(dKey) ?? { count: 0, sumMs: 0 };
    this.durations.set(dKey, {
      count: prev.count + 1,
      sumMs: prev.sumMs + durationMs,
    });
  }

  snapshot(): { requests: Map<string, number>; durations: Map<string, DurationStats> } {
    return {
      requests: new Map(this.requests),
      durations: new Map(this.durations),
    };
  }

  prometheusText(): string {
    const lines: string[] = [];
    lines.push("# HELP daemon_http_requests_total Total HTTP requests handled");
    lines.push("# TYPE daemon_http_requests_total counter");
    for (const [key, value] of this.requests) {
      const [method, route, status] = key.split("|");
      lines.push(
        `daemon_http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"} ${value}`,
      );
    }
    lines.push("# HELP daemon_http_request_duration_ms_sum Sum of request durations in milliseconds");
    lines.push("# TYPE daemon_http_request_duration_ms_sum counter");
    lines.push("# HELP daemon_http_request_duration_ms_count Request count for duration sum");
    lines.push("# TYPE daemon_http_request_duration_ms_count counter");
    for (const [key, stats] of this.durations) {
      const [method, route] = key.split("|");
      const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}"`;
      lines.push(`daemon_http_request_duration_ms_sum{${labels}} ${stats.sumMs}`);
      lines.push(`daemon_http_request_duration_ms_count{${labels}} ${stats.count}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Shared registry for gateway and standalone REST when both run in one process. */
export const globalHttpMetrics = new HttpMetricsRegistry();

/**
 * Collapse dynamic path segments so metrics cardinality stays bounded.
 */
export function normalizeRoutePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/v1\/entities\/[^/]+/g, "/v1/entities/:entityId")
    .replace(/\/v1\/read\/entities\/[^/]+/g, "/v1/read/entities/:entityId");
}
