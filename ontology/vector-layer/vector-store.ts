import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface VectorRecord {
  id: string;
  vector: number[];
}

export interface VectorMatch {
  id: string;
  similarity: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new DaemonError(
      ErrorCodes.VALIDATION,
      `dimension mismatch: ${a.length} vs ${b.length}`,
      400,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * In-memory vector store with fixed dimensionality and cosine nearest-neighbor
 * search. Used for unit tests and as the fallback when the Rust shim is absent.
 */
export class VectorStore {
  private readonly records = new Map<string, number[]>();

  constructor(private readonly dimension: number) {
    if (dimension <= 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "dimension must be > 0", 400);
    }
  }

  upsert(record: VectorRecord): void {
    if (record.vector.length !== this.dimension) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `expected dimension ${this.dimension}, got ${record.vector.length}`,
        400,
      );
    }
    this.records.set(record.id, [...record.vector]);
  }

  nearest(query: number[], k = 5): VectorMatch[] {
    return [...this.records.entries()]
      .map(([id, vector]) => ({ id, similarity: cosineSimilarity(query, vector) }))
      .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
      .slice(0, k);
  }

  size(): number {
    return this.records.size;
  }
}
