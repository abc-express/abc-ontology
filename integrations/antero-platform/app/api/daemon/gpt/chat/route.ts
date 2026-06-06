import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  turns: z.array(turnSchema).min(1),
  ontologyId: z.string().optional(),
  limit: z.number().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const client = createAnteroDaemonClient("analyst");
    const result = await client.customerGptChat(
      {
        turns: parsed.turns,
        ontologyId: parsed.ontologyId ?? daemonOntologyId(),
        limit: parsed.limit,
      },
      parsed.sessionId,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return daemonErrorResponse(err);
  }
}
