import { Injectable } from "@nestjs/common";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { OntologyScope } from "@daemon/context-ports";
import {
  OntologyQueryChain,
  isOntologyQueryEnabled,
} from "@daemon/ontology-query";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class QueryService {
  constructor(private readonly runtime: DaemonRuntime) {}

  async ask(
    ctx: TenantContextHeaders,
    body: { question: string; ontologyId?: string },
  ) {
    if (!isOntologyQueryEnabled()) {
      throw new DaemonError(
        ErrorCodes.INTERNAL,
        "ontology natural-language query is disabled (set DAEMON_ONTOLOGY_QUERY_ENABLED=1, DAEMON_NEO4J_URI, and OPENROUTER_API_KEY)",
        503,
      );
    }
    const store = this.runtime.neo4jStore;
    if (!store) {
      throw new DaemonError(
        ErrorCodes.INTERNAL,
        "Neo4j is not configured (DAEMON_NEO4J_URI)",
        503,
      );
    }
    const scope: OntologyScope = {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
    };
    const chain = OntologyQueryChain.fromEnv(store);
    return chain.ask({
      question: body.question,
      scope,
      ontologyId: body.ontologyId,
    });
  }
}
