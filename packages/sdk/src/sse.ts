export type SseEventName =
  | "token"
  | "tool_start"
  | "tool_end"
  | "node"
  | "done"
  | "error";

export interface SseEvent {
  event: SseEventName;
  data: unknown;
}

/** Parse `text/event-stream` body from fetch into discrete events. */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<SseEvent> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: SseEventName = "token";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim() as SseEventName;
      } else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        try {
          yield { event: currentEvent, data: JSON.parse(raw) };
        } catch {
          yield { event: currentEvent, data: raw };
        }
      }
    }
  }
}

export async function collectSseStream(
  body: ReadableStream<Uint8Array> | null,
): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  for await (const ev of parseSseStream(body)) {
    events.push(ev);
  }
  return events;
}
