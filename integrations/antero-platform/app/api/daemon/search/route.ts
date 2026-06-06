import { createAnteroDaemonClient } from "@/lib/daemon/client";
import { daemonErrorResponse } from "@/lib/daemon/errors";
import { daemonOntologyId } from "@/lib/daemon/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const client = createAnteroDaemonClient("viewer");
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q");
    if (!q?.trim()) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }
    const result = await client.search({
      q: q.trim(),
      ontologyId: searchParams.get("ontologyId") ?? daemonOntologyId(),
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      mode: (searchParams.get("mode") as "keyword" | "hybrid") ?? "hybrid",
    });
    return NextResponse.json(result);
  } catch (err) {
    return daemonErrorResponse(err);
  }
}
