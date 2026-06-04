import { Injectable } from "@nestjs/common";
import { ontologyId } from "@daemon/platform-types";
import type { SearchMode } from "@daemon/ontology/search/scoped-ontology-search.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

export interface SearchQuery {
  q: string;
  ontologyId?: string;
  limit?: number;
  mode?: SearchMode;
}

@Injectable()
export class SearchService {
  constructor(private readonly runtime: DaemonRuntime) {}

  async search(ctx: TenantContextHeaders, query: SearchQuery) {
    this.runtime.assertAllowed("query", "ontology-search");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const hits = await this.runtime.search.search(scope, {
      query: query.q,
      limit: query.limit,
      ontologyId: query.ontologyId
        ? ontologyId(query.ontologyId)
        : undefined,
      mode: query.mode,
    });
    return { hits, count: hits.length };
  }
}
