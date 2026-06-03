import { OutboundPolicy, type OutboundTarget } from "./outbound-policy.js";
import { ExternalCommandBus, type ExternalCommand } from "./external-command-bus.js";

export interface OutboundWrite extends OutboundTarget {
  payload: Record<string, unknown>;
}

export interface OutboundResult {
  dispatched: boolean;
  reason: string;
}

/**
 * Bridges internal commits to external systems. Each write is authorized by the
 * OutboundPolicy before being enqueued on the ExternalCommandBus, ensuring no
 * unauthorized side effect leaves the platform.
 */
export class OutboundAdapter {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly bus: ExternalCommandBus = new ExternalCommandBus(),
  ) {}

  dispatch(write: OutboundWrite): OutboundResult {
    const decision = this.policy.authorize({
      system: write.system,
      operation: write.operation,
    });
    if (!decision.allowed) {
      return { dispatched: false, reason: decision.reason };
    }

    const command: ExternalCommand = {
      target: `${write.system}:${write.operation}`,
      payload: write.payload,
    };
    this.bus.publish(command);
    return { dispatched: true, reason: "ok" };
  }

  pending(): ExternalCommand[] {
    return this.bus.drain();
  }
}
