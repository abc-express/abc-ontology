import type { Response } from "express";

export type SseEventName =
  | "token"
  | "tool_start"
  | "tool_end"
  | "node"
  | "done"
  | "error";

export function initSseResponse(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

export function writeSseEvent(
  res: Response,
  event: SseEventName,
  data: unknown,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function pumpSseStream(
  res: Response,
  source: AsyncIterable<{ event: SseEventName; data: unknown }>,
  options?: { signal?: AbortSignal },
): Promise<void> {
  initSseResponse(res);
  try {
    for await (const chunk of source) {
      if (options?.signal?.aborted) break;
      writeSseEvent(res, chunk.event, chunk.data);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeSseEvent(res, "error", { message });
  } finally {
    res.end();
  }
}
