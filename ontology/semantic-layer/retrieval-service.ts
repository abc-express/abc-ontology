import { SemanticIndex, tokenize } from "./semantic-index.js";

export interface RetrievalHit {
  id: string;
  score: number;
}

/**
 * Keyword retrieval over a SemanticIndex. Candidate documents are gathered from
 * the inverted index, then ranked by term-frequency score.
 */
export class RetrievalService {
  constructor(private readonly index: SemanticIndex) {}

  search(query: string, limit = 10): RetrievalHit[] {
    const tokens = tokenize(query);
    const candidates = new Set<string>();
    for (const token of tokens) {
      for (const id of this.index.documentsFor(token)) candidates.add(id);
    }
    const hits: RetrievalHit[] = [...candidates]
      .map((id) => ({ id, score: this.index.score(id, tokens) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hits.slice(0, limit);
  }
}
