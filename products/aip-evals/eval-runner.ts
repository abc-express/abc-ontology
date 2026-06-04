import type { ProductRuntime } from "../shared/product-runtime.js";

export interface EvalCase {
  id: string;
  question: string;
  expectContains?: string[];
}

export interface EvalSuite {
  id: string;
  cases: EvalCase[];
}

export interface EvalScore {
  caseId: string;
  passed: boolean;
  answer: string;
  notes?: string;
}

export interface EvalRunResult {
  runId: string;
  suiteId: string;
  status: "completed";
  scores: EvalScore[];
  passRate: number;
}

/**
 * Rule-based eval runner for ontology-query / customer-gpt style answers.
 */
export class EvalRunner {
  constructor(private readonly runtime: ProductRuntime) {}

  async run(suite: EvalSuite): Promise<EvalRunResult> {
    const runId = `eval-${Date.now()}`;
    const scores: EvalScore[] = [];

    for (const c of suite.cases) {
      let answer = "";
      try {
        if (this.runtime.search && this.runtime.scope) {
          const hits = await this.runtime.search.search(this.runtime.scope, {
            query: c.question,
            limit: 3,
          });
          answer = hits
            .map((h) => `${h.entityId}:${h.score.toFixed(3)}`)
            .join(" | ");
        } else {
          answer = "(search unavailable)";
        }
      } catch {
        answer = "(search unavailable)";
      }
      const passed =
        !c.expectContains?.length ||
        c.expectContains.every((needle) =>
          answer.toLowerCase().includes(needle.toLowerCase()),
        );
      scores.push({ caseId: c.id, passed, answer });
    }

    const passRate =
      scores.length === 0
        ? 0
        : scores.filter((s) => s.passed).length / scores.length;

    return {
      runId,
      suiteId: suite.id,
      status: "completed",
      scores,
      passRate,
    };
  }
}
