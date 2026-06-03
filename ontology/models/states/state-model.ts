import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface Transition {
  from: string;
  to: string;
  on: string;
}

export interface StateModelDefinition {
  name: string;
  initial: string;
  states: string[];
  transitions: Transition[];
}

/**
 * A finite state machine for an ontology entity lifecycle. Validates that every
 * transition references declared states and computes the next state for an event.
 */
export class StateModel {
  private readonly states: Set<string>;
  /** key `${from}:${on}` -> to */
  private readonly table = new Map<string, string>();

  constructor(private readonly def: StateModelDefinition) {
    if (!def.name.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "state model name required", 400);
    }
    this.states = new Set(def.states);
    if (!this.states.has(def.initial)) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `initial state not declared: ${def.initial}`,
        400,
      );
    }
    for (const t of def.transitions) {
      if (!this.states.has(t.from) || !this.states.has(t.to)) {
        throw new DaemonError(
          ErrorCodes.VALIDATION,
          `transition references unknown state: ${t.from}->${t.to}`,
          400,
        );
      }
      const key = `${t.from}:${t.on}`;
      if (this.table.has(key)) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `ambiguous transition: ${key}`,
          409,
        );
      }
      this.table.set(key, t.to);
    }
  }

  get name(): string {
    return this.def.name;
  }

  get initial(): string {
    return this.def.initial;
  }

  /** Returns true when an event triggers a transition from the given state. */
  canFire(from: string, on: string): boolean {
    return this.table.has(`${from}:${on}`);
  }

  /** Computes the next state; throws DaemonError if the transition is invalid. */
  next(from: string, on: string): string {
    if (!this.states.has(from)) {
      throw new DaemonError(ErrorCodes.VALIDATION, `unknown state: ${from}`, 400);
    }
    const to = this.table.get(`${from}:${on}`);
    if (to === undefined) {
      throw new DaemonError(
        ErrorCodes.CONFLICT,
        `no transition from ${from} on ${on}`,
        409,
      );
    }
    return to;
  }
}
