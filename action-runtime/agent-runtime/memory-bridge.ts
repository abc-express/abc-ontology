/** Spec: action-runtime/agent-runtime/memory-bridge.ts */
export interface MemoryRecord {
  id: string;
  content: string;
  tags: string[];
  at: number;
}

/**
 * Bridges an agent's working memory to durable episodic storage. Keeps a bounded
 * window of recent records for fast recall and supports tag-filtered retrieval
 * ordered by recency. Eviction is FIFO once capacity is exceeded.
 */
export class MemoryBridge {
  private readonly records: MemoryRecord[] = [];

  constructor(
    private readonly capacity = 100,
    private readonly now: () => number = () => Date.now(),
  ) {}

  remember(content: string, tags: string[] = []): MemoryRecord {
    const record: MemoryRecord = {
      id: `mem-${this.records.length + 1}`,
      content,
      tags,
      at: this.now(),
    };
    this.records.push(record);
    if (this.records.length > this.capacity) {
      this.records.shift();
    }
    return record;
  }

  /** Most recent records, optionally filtered to those carrying every tag. */
  recall(limit = 10, tags: string[] = []): MemoryRecord[] {
    const filtered = tags.length
      ? this.records.filter((r) => tags.every((t) => r.tags.includes(t)))
      : this.records;
    return [...filtered].sort((a, b) => b.at - a.at).slice(0, limit);
  }

  size(): number {
    return this.records.length;
  }
}
