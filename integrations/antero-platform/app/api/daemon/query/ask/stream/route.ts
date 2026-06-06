import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { encodeSseEvent, formatSseData } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  question: z.string().min(1),
  ontologyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = createAnteroDaemonClient("viewer");
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await client.queryAskStream(
          {
            question: parsed.question,
            ontologyId: parsed.ontologyId ?? daemonOntologyId(),
          },
          (ev) => {
            controller.enqueue(
              encodeSseEvent(ev.event ?? "message", formatSseData(ev.data)),
            );
          },
        );
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream failed";
        controller.enqueue(encodeSseEvent("error", message));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
