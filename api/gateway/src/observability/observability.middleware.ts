import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { StructuredLogger } from "@daemon/observability/logging/structured-logger.js";
import {
  globalHttpMetrics,
  normalizeRoutePath,
} from "@daemon/observability/metrics/http-metrics.js";

const requestLogger = new StructuredLogger({ service: "daemon-api-gateway" });

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const started = performance.now();
    const route = normalizeRoutePath(req.path ?? req.url ?? "/");

    res.on("finish", () => {
      const durationMs = Math.round(performance.now() - started);
      const status = String(res.statusCode);
      globalHttpMetrics.recordRequest(
        { method: req.method ?? "GET", route, status },
        durationMs,
      );
      requestLogger.info("http_request", {
        method: req.method,
        route,
        status: res.statusCode,
        durationMs,
      });
    });

    next();
  }
}
