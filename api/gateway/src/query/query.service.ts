import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { OntologyScope } from "@daemon/context-ports";
import {
  OntologyQueryChain,
  isOntologyQueryEnabled,
} from "@daemon/ontology-query";
import { buildPackGraphSchema } from "@daemon/ontology/graph-schema/pack-graph-schema.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { pumpSseStream } from "../streaming/sse.js";

@Injectable()
export class QueryService {
  constructor(private readonly runtime: DaemonRuntime) {}

  private buildChain(): OntologyQueryChain {
    const store = this.runtime.neo4jStore;
    if (!store) {
      throw new DaemonError(
        ErrorCodes.INTERNAL,
        "Neo4j is not configured (DAEMON_NEO4J_URI)",
        503,
      );
    }
    return OntologyQueryChain.fromEnv(store, {
      resolveSchemaSummary: (scope: OntologyScope) => {
        const tenant = this.runtime.tenants.require(scope.tenantId);
        const pack = this.runtime.packs.resolve(tenant, scope.domainId);
        return buildPackGraphSchema(pack).promptSchemaSummary;
      },
    });
  }

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
    const scope: OntologyScope = {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
    };
    const chain = this.buildChain();
    return chain.ask({
      question: body.question,
      scope,
      ontologyId: body.ontologyId,
    });
  }

  async askStream(
    ctx: TenantContextHeaders,
    body: { question: string; ontologyId?: string },
    res: Response,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!isOntologyQueryEnabled()) {
      throw new DaemonError(
        ErrorCodes.INTERNAL,
        "ontology natural-language query is disabled (set DAEMON_ONTOLOGY_QUERY_ENABLED=1, DAEMON_NEO4J_URI, and OPENROUTER_API_KEY)",
        503,
      );
    }
    const scope: OntologyScope = {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
    };
    const chain = this.buildChain();
    await pumpSseStream(
      res,
      chain.askStream({
        question: body.question,
        scope,
        ontologyId: body.ontologyId,
      }),
      { signal },
    );
  }
}
