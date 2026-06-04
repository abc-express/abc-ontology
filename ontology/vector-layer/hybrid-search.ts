import { RetrievalService } from "../semantic-layer/retrieval-service.js";
import type { TextEmbedder } from "./text-embedder.js";
import { VectorStore } from "./vector-store.js";

export interface HybridHit {
  id: string;
  score: number;
  keywordScore: number;
  vectorScore: number;
}

/**
 * Combines keyword retrieval with vector similarity into a single ranking. The
 * blend weight (alpha) controls how much keyword vs vector contributes.
 */
export class HybridSearch {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly vectors: VectorStore,
    private readonly embedder: TextEmbedder,
    private readonly alpha = 0.5,
  ) {
    if (alpha < 0 || alpha > 1) throw new Error("alpha must be in [0,1]");
  }

  search(query: string, k = 10): HybridHit[] {
    return this.searchWithQueryVector(this.embedder.embed(query), query, k);
  }

  searchWithQueryVector(
    queryVector: number[],
    query: string,
    k = 10,
  ): HybridHit[] {
    const keyword = new Map(
      this.retrieval.search(query, k * 2).map((h) => [h.id, h.score]),
    );
    const vector = new Map(
      this.vectors.nearest(queryVector, k * 2).map((m) => [m.id, m.similarity]),
    );

    const ids = new Set<string>([...keyword.keys(), ...vector.keys()]);
    const hits: HybridHit[] = [...ids].map((id) => {
      const keywordScore = keyword.get(id) ?? 0;
      const vectorScore = vector.get(id) ?? 0;
      return {
        id,
        keywordScore,
        vectorScore,
        score: this.alpha * keywordScore + (1 - this.alpha) * vectorScore,
      };
    });

    return hits
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, k);
  }
}
