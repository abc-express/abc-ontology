import { DaemonError, ErrorCodes } from "@daemon/platform-types";

/**
 * Resolves human-supplied aliases to a canonical entity id. Aliases are
 * normalized (trimmed, lowercased) so lookups are case-insensitive.
 */
export class EntityResolver {
  private readonly aliasToCanonical = new Map<string, string>();

  private normalize(alias: string): string {
    return alias.trim().toLowerCase();
  }

  register(canonicalId: string, aliases: string[]): void {
    if (!canonicalId.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "canonicalId required", 400);
    }
    for (const alias of [canonicalId, ...aliases]) {
      const key = this.normalize(alias);
      if (!key) continue;
      const existing = this.aliasToCanonical.get(key);
      if (existing && existing !== canonicalId) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `alias "${alias}" already bound to ${existing}`,
          409,
        );
      }
      this.aliasToCanonical.set(key, canonicalId);
    }
  }

  resolve(alias: string): string | undefined {
    return this.aliasToCanonical.get(this.normalize(alias));
  }

  resolveOrThrow(alias: string): string {
    const id = this.resolve(alias);
    if (!id) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `unresolved alias: ${alias}`,
        404,
      );
    }
    return id;
  }
}
