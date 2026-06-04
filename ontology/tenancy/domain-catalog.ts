import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { configsPath } from "../paths.js";

export interface DomainDefinition {
  id: string;
  label: string;
  packId?: string;
  packIds?: string[];
  extensionPack?: string;
  /** Logical pack branch (e.g. main, staging); surfaced in pack-resolution API. */
  packBranch?: string;
  description?: string;
}

interface DomainCatalogFile {
  domains: DomainDefinition[];
}

export function domainCatalogPath(): string {
  return configsPath("ontology", "domains", "catalog.yaml");
}

export class DomainCatalog {
  private readonly domains = new Map<string, DomainDefinition>();

  constructor(definitions: DomainDefinition[]) {
    for (const d of definitions) {
      if (!d.id?.trim()) throw new Error("domain id required");
      this.domains.set(d.id, d);
    }
  }

  static fromYamlFile(path = domainCatalogPath()): DomainCatalog {
    if (!existsSync(path)) {
      throw new Error(`domain catalog not found: ${path}`);
    }
    const raw = parseYaml(readFileSync(path, "utf8")) as DomainCatalogFile;
    return new DomainCatalog(raw.domains ?? []);
  }

  get(domainId: string): DomainDefinition | undefined {
    return this.domains.get(domainId);
  }

  require(domainId: string): DomainDefinition {
    const d = this.get(domainId);
    if (!d) throw new Error(`unknown domain: ${domainId}`);
    return d;
  }

  list(): DomainDefinition[] {
    return [...this.domains.values()];
  }
}
