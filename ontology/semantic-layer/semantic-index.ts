export interface IndexedDocument {
  id: string;
  text: string;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length > 1);
}

/**
 * Inverted token index over documents. Provides exact-token lookup and a simple
 * term-frequency score used by retrieval and hybrid search.
 */
export class SemanticIndex {
  private readonly postings = new Map<string, Set<string>>();
  private readonly docs = new Map<string, IndexedDocument>();

  add(doc: IndexedDocument): void {
    if (!doc.id) throw new Error("document id required");
    this.docs.set(doc.id, doc);
    for (const token of new Set(tokenize(doc.text))) {
      const set = this.postings.get(token) ?? new Set<string>();
      set.add(doc.id);
      this.postings.set(token, set);
    }
  }

  documentsFor(token: string): string[] {
    return [...(this.postings.get(token.toLowerCase()) ?? [])];
  }

  score(docId: string, queryTokens: string[]): number {
    const doc = this.docs.get(docId);
    if (!doc) return 0;
    const docTokens = tokenize(doc.text);
    let matches = 0;
    for (const q of queryTokens) {
      matches += docTokens.filter((t) => t === q).length;
    }
    return docTokens.length === 0 ? 0 : matches / docTokens.length;
  }

  size(): number {
    return this.docs.size;
  }
}
