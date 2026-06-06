import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    tools: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    const client = createAnteroDaemonClient("analyst");
    const session = await client.createAgentSession(parsed ?? {});
    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return daemonErrorResponse(err);
  }
}
