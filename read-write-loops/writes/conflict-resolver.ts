import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type ConflictStrategy = "reject" | "last-write-wins" | "merge";

export interface ConflictInput {
  currentVersion: number;
  expectedVersion?: number;
  currentProperties: Record<string, unknown>;
  patch: Record<string, unknown>;
}

export interface ConflictResolution {
  conflict: boolean;
  resolvedProperties: Record<string, unknown>;
  strategyApplied: ConflictStrategy;
}

/**
 * Detects optimistic-concurrency conflicts and resolves them per strategy.
 * A conflict exists when the caller supplied an expectedVersion that no longer
 * matches the current version.
 */
export class ConflictResolver {
  constructor(private readonly strategy: ConflictStrategy = "reject") {}

  resolve(input: ConflictInput): ConflictResolution {
    const conflict =
      input.expectedVersion !== undefined &&
      input.expectedVersion !== input.currentVersion;

    if (!conflict) {
      return {
        conflict: false,
        resolvedProperties: { ...input.currentProperties, ...input.patch },
        strategyApplied: this.strategy,
      };
    }

    switch (this.strategy) {
      case "reject":
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `version conflict: expected ${input.expectedVersion}, found ${input.currentVersion}`,
          409,
        );
      case "last-write-wins":
        return {
          conflict: true,
          resolvedProperties: { ...input.currentProperties, ...input.patch },
          strategyApplied: "last-write-wins",
        };
      case "merge":
        return {
          conflict: true,
          // merge keeps existing keys unless the patch explicitly overrides
          resolvedProperties: { ...input.patch, ...input.currentProperties },
          strategyApplied: "merge",
        };
    }
  }
}
