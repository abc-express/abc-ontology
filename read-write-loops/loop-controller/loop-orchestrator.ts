import type {
  DaemonSession,
  EntityId,
  OntologyId,
  PolicyDecision,
} from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { StateMachine, type LoopState } from "./state-machine.js";

export interface ReadPort {
  route(req: { ontologyId: OntologyId; entityId: EntityId }): unknown;
}

export interface PolicyPort {
  evaluate(action: string, resource: string): PolicyDecision;
}

export interface WritePort {
  submit(cmd: {
    session: DaemonSession;
    ontologyId: OntologyId;
    entityId: EntityId;
    patch: Record<string, unknown>;
    idempotencyKey?: string;
  }): { writeId: string; status: "committed"; version: number };
}

export interface OutboundPort {
  dispatch(write: {
    system: string;
    operation: string;
    payload: Record<string, unknown>;
  }): { dispatched: boolean; reason: string };
}

export interface LoopRequest {
  session: DaemonSession;
  ontologyId: OntologyId;
  entityId: EntityId;
  patch: Record<string, unknown>;
  idempotencyKey?: string;
  external?: { system: string; operation: string };
}

export interface LoopOutcome {
  state: LoopState;
  current: unknown;
  version: number;
  externalDispatched: boolean;
  trace: LoopState[];
}

/**
 * Drives a single read → policy → write → optional external-write loop,
 * advancing a StateMachine at each step so failures leave an auditable trace.
 * Collaborators are injected as ports so the loop can be exercised against
 * either in-memory fakes (unit tests) or real services (integration).
 */
export class LoopOrchestrator {
  constructor(
    private readonly reads: ReadPort,
    private readonly policy: PolicyPort,
    private readonly writes: WritePort,
    private readonly outbound?: OutboundPort,
  ) {}

  run(req: LoopRequest): LoopOutcome {
    const sm = new StateMachine();
    const trace: LoopState[] = [];
    const advance = (to: LoopState) => {
      sm.transition(to);
      trace.push(to);
    };

    advance("reading");
    const current = this.reads.route({
      ontologyId: req.ontologyId,
      entityId: req.entityId,
    });

    advance("policy-check");
    const resource = `${req.ontologyId}/${req.entityId}`;
    const decision = this.policy.evaluate("write", resource);
    if (decision.effect === "deny") {
      advance("failed");
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        `policy denied write on ${resource}: ${decision.reason ?? "no reason"}`,
        403,
      );
    }

    advance("writing");
    const result = this.writes.submit({
      session: req.session,
      ontologyId: req.ontologyId,
      entityId: req.entityId,
      patch: req.patch,
      idempotencyKey: req.idempotencyKey,
    });

    let externalDispatched = false;
    if (req.external && this.outbound) {
      advance("external-write");
      const dispatch = this.outbound.dispatch({
        system: req.external.system,
        operation: req.external.operation,
        payload: req.patch,
      });
      externalDispatched = dispatch.dispatched;
    }

    advance("committed");
    return {
      state: sm.current(),
      current,
      version: result.version,
      externalDispatched,
      trace,
    };
  }
}
