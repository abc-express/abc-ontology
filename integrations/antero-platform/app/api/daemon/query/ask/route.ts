import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  question: z.string().min(1),
  ontologyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const client = createAnteroDaemonClient("viewer");
    const result = await client.queryAsk({
      question: parsed.question,
      ontologyId: parsed.ontologyId ?? daemonOntologyId(),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return daemonErrorResponse(err);
  }
}
