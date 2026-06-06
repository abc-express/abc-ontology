import { DaemonError } from "@daemon/platform-types";
import { NextResponse } from "next/server";

export function daemonErrorResponse(err: unknown): NextResponse {
  if (err instanceof DaemonError) {
    const status =
      err.status === 401
        ? 401
        : err.status === 403
          ? 403
          : err.status >= 400 && err.status < 600
            ? err.status
            : 502;
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status },
    );
  }
  const message = err instanceof Error ? err.message : "Internal error";
  if (message.includes("Missing server env") || message.includes("Missing DAEMON")) {
    return NextResponse.json({ error: message }, { status: 503 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export function encodeSseEvent(event: string, data: string): Uint8Array {
  const payload = `event: ${event}\ndata: ${data.replace(/\n/g, "\\n")}\n\n`;
  return new TextEncoder().encode(payload);
}

export function formatSseData(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  return JSON.stringify(data);
}
