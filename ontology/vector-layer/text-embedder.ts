/** Pluggable text embedding for semantic search (deterministic or remote). */
export interface TextEmbedder {
  readonly dimension: number;
  embed(text: string): number[];
}
