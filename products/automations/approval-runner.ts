import {
  ApprovalGates,
  type ApprovalDecision,
} from "@daemon/read-write-loops/loop-controller/approval-gates.js";
import type { LoopRequest } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import type { LoopOutcome } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface ApprovalRunInput {
  loop: LoopRequest;
  approvals: string[];
}

/**
 * Combines threshold-based approval gates with the read–write loop for automations.
 */
export class ApprovalRunner {
  constructor(
    private readonly runtime: ProductRuntime,
    private readonly gates = new ApprovalGates(
      [{ field: "amount", threshold: 10_000 }],
      1,
    ),
  ) {}

  evaluate(patch: Record<string, unknown>, approvals: string[]): ApprovalDecision {
    return this.gates.evaluate({ patch, approvals });
  }

  run(input: ApprovalRunInput): LoopOutcome {
    const decision = this.evaluate(input.loop.patch, input.approvals);
    if (!decision.approved) {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        `approval required: ${decision.reasons.join("; ")}`,
        403,
      );
    }
    return this.runtime.createLoop().run(input.loop);
  }
}
