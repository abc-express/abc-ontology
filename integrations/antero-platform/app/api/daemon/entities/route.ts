import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const client = createAnteroDaemonClient("viewer");
    const { searchParams } = req.nextUrl;
    const ontologyId = searchParams.get("ontologyId") ?? daemonOntologyId();
    const entityType = searchParams.get("entityType") ?? undefined;
    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor") ?? undefined;

    const page = await client.listEntities({
      ontologyId,
      entityType,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
    return NextResponse.json(page);
  } catch (err) {
    return daemonErrorResponse(err);
  }
}
