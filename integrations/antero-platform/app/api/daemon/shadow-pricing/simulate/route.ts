import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  ontologyId: z.string().optional(),
  shipmentRef: z.string().optional(),
  limit: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const client = createAnteroDaemonClient("viewer");
    const result = await client.shadowPricingSimulate({
      ontologyId: parsed.ontologyId ?? daemonOntologyId(),
      shipmentRef: parsed.shipmentRef,
      limit: parsed.limit,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return daemonErrorResponse(err);
  }
}
