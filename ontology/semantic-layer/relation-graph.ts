export interface RelationEdge {
  from: string;
  to: string;
  type: string;
}

/**
 * Directed, typed relation graph over ontology entities. Supports neighbor
 * lookup and bounded reachability checks (BFS) without external dependencies.
 */
export class RelationGraph {
  private readonly adjacency = new Map<string, RelationEdge[]>();

  addEdge(from: string, to: string, type: string): void {
    if (!from || !to || !type) {
      throw new Error("from, to, and type are required");
    }
    const edges = this.adjacency.get(from) ?? [];
    if (!edges.some((e) => e.to === to && e.type === type)) {
      edges.push({ from, to, type });
    }
    this.adjacency.set(from, edges);
  }

  neighbors(node: string, type?: string): RelationEdge[] {
    const edges = this.adjacency.get(node) ?? [];
    return type ? edges.filter((e) => e.type === type) : [...edges];
  }

  isReachable(from: string, to: string, maxDepth = 8): boolean {
    if (from === to) return true;
    const seen = new Set<string>([from]);
    let frontier = [from];
    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const node of frontier) {
        for (const edge of this.neighbors(node)) {
          if (edge.to === to) return true;
          if (!seen.has(edge.to)) {
            seen.add(edge.to);
            next.push(edge.to);
          }
        }
      }
      frontier = next;
    }
    return false;
  }
}
