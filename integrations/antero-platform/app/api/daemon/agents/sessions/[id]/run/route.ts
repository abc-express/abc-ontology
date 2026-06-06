import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  message: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const parsed = bodySchema.parse(await req.json());
    const client = createAnteroDaemonClient("analyst");
    const result = await client.agentSessionRun(id, {
      message: parsed.message,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return daemonErrorResponse(err);
  }
}
