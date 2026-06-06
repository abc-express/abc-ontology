import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const client = createAnteroDaemonClient("viewer");
    const ontologyId =
      req.nextUrl.searchParams.get("ontologyId") ?? daemonOntologyId();
    const record = await client.readEntity(id, ontologyId);
    return NextResponse.json(record);
  } catch (err) {
    return daemonErrorResponse(err);
  }
}
