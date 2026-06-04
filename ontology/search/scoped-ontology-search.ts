import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
import type { OntologyId, EntityId } from "@daemon/platform-types";
import { SemanticIndex } from "../semantic-layer/semantic-index.js";
import { RetrievalService } from "../semantic-layer/retrieval-service.js";
import { VectorStore } from "../vector-layer/vector-store.js";
import { HybridSearch } from "../vector-layer/hybrid-search.js";
import type { TextEmbedder } from "../vector-layer/text-embedder.js";
import {
  createEmbedderFromEnv,
  isAsyncEmbedder,
} from "../vector-layer/create-embedder-from-env.js";

export type SearchMode = "hybrid" | "keyword";

export interface OntologySearchHit {
  tenantId: string;
  domainId: string;
  ontologyId: string;
  entityId: string;
  score: number;
  keywordScore: number;
  vectorScore: number;
}

export interface OntologySearchOptions {
  query: string;
  limit?: number;
  ontologyId?: OntologyId;
  mode?: SearchMode;
}

function documentText(record: EntityRecord): string {
  const type = record.entityType ?? "";
  return `${type} ${JSON.stringify(record.properties)}`;
}

function scopedDocId(scope: OntologyScope, record: EntityRecord): string {
  return `${scope.tenantId}/${scope.domainId}/${record.ontologyId}/${record.entityId}`;
}

function parseScopedDocId(id: string): {
  tenantId: string;
  domainId: string;
  ontologyId: string;
  entityId: string;
} | null {
  const parts = id.split("/");
  if (parts.length !== 4) return null;
  const [tenantId, domainId, ontologyId, entityId] = parts;
  if (!tenantId || !domainId || !ontologyId || !entityId) return null;
  return { tenantId, domainId, ontologyId, entityId };
}

function scopePrefix(scope: OntologyScope): string {
  return `${scope.tenantId}/${scope.domainId}/`;
}

/**
 * Tenant/domain-scoped semantic + vector index updated via propagation.
 */
export class ScopedOntologySearch {
  private readonly semanticIndex = new SemanticIndex();
  private readonly vectors: VectorStore;
  private readonly embedder: TextEmbedder;
  private readonly hybrid: HybridSearch;

  constructor(embedder?: TextEmbedder, alpha = 0.5) {
    this.embedder = embedder ?? createEmbedderFromEnv();
    this.vectors = new VectorStore(this.embedder.dimension);
    this.hybrid = new HybridSearch(
      new RetrievalService(this.semanticIndex),
      this.vectors,
      this.embedder,
      alpha,
    );
  }

  /** Fire-and-forget index for sync propagation hooks. */
  index(record: EntityRecord, scope: OntologyScope): void {
    void this.indexAsync(record, scope);
  }

  async indexAsync(record: EntityRecord, scope: OntologyScope): Promise<void> {
    const id = scopedDocId(scope, record);
    const text = documentText(record);
    this.semanticIndex.add({ id, text });
    const vector = await this.embedText(text);
    this.vectors.upsert({ id, vector });
  }

  private async embedText(text: string): Promise<number[]> {
    if (isAsyncEmbedder(this.embedder)) {
      return this.embedder.embedAsync(text);
    }
    return this.embedder.embed(text);
  }

  async search(
    scope: OntologyScope,
    options: OntologySearchOptions,
  ): Promise<OntologySearchHit[]> {
    const needle = options.query.trim();
    if (!needle) return [];
    const limit = options.limit ?? 10;
    const mode = options.mode ?? "hybrid";
    const prefix = scopePrefix(scope);

    const raw =
      mode === "keyword"
        ? new RetrievalService(this.semanticIndex)
            .search(needle, limit * 4)
            .map((h) => ({
              id: h.id,
              score: h.score,
              keywordScore: h.score,
              vectorScore: 0,
            }))
        : this.hybrid.searchWithQueryVector(
            await this.embedText(needle),
            needle,
            limit * 4,
          );

    const hits: OntologySearchHit[] = [];
    for (const hit of raw) {
      if (!hit.id.startsWith(prefix)) continue;
      const parsed = parseScopedDocId(hit.id);
      if (!parsed) continue;
      if (options.ontologyId && parsed.ontologyId !== options.ontologyId) {
        continue;
      }
      hits.push({
        tenantId: parsed.tenantId,
        domainId: parsed.domainId,
        ontologyId: parsed.ontologyId,
        entityId: parsed.entityId,
        score: hit.score,
        keywordScore: hit.keywordScore,
        vectorScore: hit.vectorScore,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  /** Resolve entity ids from hits for product surfaces. */
  hitEntityIds(hits: OntologySearchHit[]): EntityId[] {
    return hits.map((h) => h.entityId as EntityId);
  }
}
