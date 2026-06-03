import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type Cardinality = "one-to-one" | "one-to-many" | "many-to-many";

export interface RelationModelDefinition {
  name: string;
  from: string;
  to: string;
  cardinality: Cardinality;
}

export interface RelationInstance {
  fromId: string;
  toId: string;
}

/**
 * Describes a directed relation between two ontology types and enforces the
 * declared cardinality as instances are added.
 */
export class RelationModel {
  /** fromId -> set of toId */
  private readonly forward = new Map<string, Set<string>>();
  /** toId -> set of fromId */
  private readonly inverse = new Map<string, Set<string>>();

  constructor(private readonly def: RelationModelDefinition) {
    if (!def.name.trim() || !def.from.trim() || !def.to.trim()) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        "relation name/from/to required",
        400,
      );
    }
  }

  get name(): string {
    return this.def.name;
  }

  get cardinality(): Cardinality {
    return this.def.cardinality;
  }

  link(fromId: string, toId: string): void {
    if (!fromId.trim() || !toId.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "ids required", 400);
    }
    this.enforce(fromId, toId);
    this.add(this.forward, fromId, toId);
    this.add(this.inverse, toId, fromId);
  }

  targetsOf(fromId: string): string[] {
    return [...(this.forward.get(fromId) ?? [])];
  }

  sourcesOf(toId: string): string[] {
    return [...(this.inverse.get(toId) ?? [])];
  }

  private enforce(fromId: string, toId: string): void {
    const card = this.def.cardinality;
    if (card === "many-to-many") return;
    if (card === "one-to-many") {
      // a target may have at most one source
      const existingSources = this.inverse.get(toId);
      if (existingSources && existingSources.size > 0 && !existingSources.has(fromId)) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `one-to-many violated for target ${toId}`,
          409,
        );
      }
      return;
    }
    // one-to-one
    const sources = this.inverse.get(toId);
    const targets = this.forward.get(fromId);
    if (sources && sources.size > 0 && !sources.has(fromId)) {
      throw new DaemonError(ErrorCodes.CONFLICT, "one-to-one violated", 409);
    }
    if (targets && targets.size > 0 && !targets.has(toId)) {
      throw new DaemonError(ErrorCodes.CONFLICT, "one-to-one violated", 409);
    }
  }

  private add(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }
}
