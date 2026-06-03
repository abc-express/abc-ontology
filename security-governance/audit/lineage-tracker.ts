/** Spec: security-governance/audit/lineage-tracker.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface LineageNode {
  id: string;
  kind: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  operation: string;
  at: number;
}

/**
 * Tracks data lineage as a directed acyclic graph of derivations: which inputs
 * produced which outputs via which operation. Supports upstream provenance
 * queries used by audit and compliance exports.
 */
export class LineageTracker {
  private readonly nodes = new Map<string, LineageNode>();
  private readonly edges: LineageEdge[] = [];

  constructor(private readonly now: () => number = () => Date.now()) {}

  declare(node: LineageNode): void {
    if (!node.id) throw new DaemonError(ErrorCodes.VALIDATION, "node id required", 400);
    this.nodes.set(node.id, node);
  }

  /** Record that `inputs` were transformed into `output` by `operation`. */
  derive(output: string, inputs: string[], operation: string): void {
    if (!this.nodes.has(output)) {
      throw new DaemonError(ErrorCodes.NOT_FOUND, `output ${output} undeclared`, 404);
    }
    for (const input of inputs) {
      if (!this.nodes.has(input)) {
        throw new DaemonError(ErrorCodes.NOT_FOUND, `input ${input} undeclared`, 404);
      }
      this.edges.push({ from: input, to: output, operation, at: this.now() });
    }
  }

  /** Return all transitive ancestors that contributed to `id`. */
  ancestors(id: string): string[] {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const edge of this.edges) {
        if (edge.to === current && !seen.has(edge.from)) {
          seen.add(edge.from);
          stack.push(edge.from);
        }
      }
    }
    return [...seen].sort();
  }

  history(): LineageEdge[] {
    return [...this.edges];
  }
}
