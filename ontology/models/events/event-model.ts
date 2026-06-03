import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { matchesType, type FieldSpec } from "../entities/entity-model.js";

/** A domain event type belonging to an ontology, with a typed payload schema. */
export interface EventModelDefinition {
  name: string;
  ontologyId: string;
  payload: FieldSpec[];
}

export interface EventInstance {
  name: string;
  ontologyId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Describes a domain event and validates emitted payloads against the declared
 * schema. Required payload fields must be present and typed correctly.
 */
export class EventModel {
  private readonly payloadSpec: FieldSpec[];

  constructor(private readonly def: EventModelDefinition) {
    if (!def.name.trim() || !def.ontologyId.trim()) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        "event name/ontologyId required",
        400,
      );
    }
    this.payloadSpec = [...def.payload];
  }

  get name(): string {
    return this.def.name;
  }

  get ontologyId(): string {
    return this.def.ontologyId;
  }

  /** Builds a validated event instance; throws DaemonError on schema violation. */
  emit(payload: Record<string, unknown>, occurredAt?: string): EventInstance {
    for (const field of this.payloadSpec) {
      const present = Object.prototype.hasOwnProperty.call(payload, field.name);
      if (!present) {
        if (field.required) {
          throw new DaemonError(
            ErrorCodes.VALIDATION,
            `missing payload field: ${field.name}`,
            400,
          );
        }
        continue;
      }
      if (!matchesType(payload[field.name], field.type)) {
        throw new DaemonError(
          ErrorCodes.VALIDATION,
          `payload field ${field.name} expected ${field.type}`,
          400,
        );
      }
    }
    return {
      name: this.def.name,
      ontologyId: this.def.ontologyId,
      payload: { ...payload },
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  }
}
