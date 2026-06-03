import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface Namespace {
  name: string;
  owner: string;
  createdAt: string;
}

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,62}$/;

/**
 * Manages ontology namespaces. Names are validated, unique, and immutable once
 * registered; resolution is case-sensitive and explicit.
 */
export class NamespaceManager {
  private readonly namespaces = new Map<string, Namespace>();

  register(name: string, owner: string): Namespace {
    if (!NAME_PATTERN.test(name)) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `invalid namespace name: ${name}`,
        400,
      );
    }
    if (this.namespaces.has(name)) {
      throw new DaemonError(
        ErrorCodes.CONFLICT,
        `namespace already exists: ${name}`,
        409,
      );
    }
    const ns: Namespace = { name, owner, createdAt: new Date().toISOString() };
    this.namespaces.set(name, ns);
    return ns;
  }

  resolve(name: string): Namespace {
    const ns = this.namespaces.get(name);
    if (!ns) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `unknown namespace: ${name}`,
        404,
      );
    }
    return ns;
  }

  has(name: string): boolean {
    return this.namespaces.has(name);
  }

  list(): Namespace[] {
    return [...this.namespaces.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
}
