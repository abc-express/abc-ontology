import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type LoopState =
  | "idle"
  | "reading"
  | "policy-check"
  | "writing"
  | "external-write"
  | "committed"
  | "failed";

const TRANSITIONS: Record<LoopState, LoopState[]> = {
  idle: ["reading"],
  reading: ["policy-check", "failed"],
  "policy-check": ["writing", "failed"],
  writing: ["external-write", "committed", "failed"],
  "external-write": ["committed", "failed"],
  committed: [],
  failed: [],
};

/**
 * Enforces the legal state transitions of a single read-write loop. Illegal
 * transitions throw rather than silently corrupting loop state.
 */
export class StateMachine {
  private state: LoopState;

  constructor(initial: LoopState = "idle") {
    this.state = initial;
  }

  current(): LoopState {
    return this.state;
  }

  canTransition(to: LoopState): boolean {
    return TRANSITIONS[this.state].includes(to);
  }

  transition(to: LoopState): LoopState {
    if (!this.canTransition(to)) {
      throw new DaemonError(
        ErrorCodes.CONFLICT,
        `illegal loop transition: ${this.state} -> ${to}`,
        409,
      );
    }
    this.state = to;
    return this.state;
  }

  isTerminal(): boolean {
    return TRANSITIONS[this.state].length === 0;
  }
}
