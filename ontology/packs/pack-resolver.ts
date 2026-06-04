import type { LoadedOntologyPack } from "./load-pack.js";
import { loadExtensionPack, loadFoundationPack } from "./load-pack.js";
import { mergeOntologyPacks } from "./merge-packs.js";
import type { DomainCatalog } from "../tenancy/domain-catalog.js";
import type { TenantDefinition } from "../tenancy/tenant-registry.js";

export interface PackResolveOptions {
  packBranch?: string;
  environment?: string;
}

export interface ResolvedPack {
  ontologyId: string;
  entityTypes: string[];
  models: LoadedOntologyPack["models"];
  relations: LoadedOntologyPack["relations"];
  junctions: LoadedOntologyPack["junctions"];
  packVersion: string;
  packBranch: string;
  environment: string;
}

/**
 * Merges foundation pack with optional domain extensions for a tenant.
 */
export class PackResolver {
  private readonly foundation = loadFoundationPack();
  private readonly extensionCache = new Map<string, LoadedOntologyPack>();

  constructor(private readonly domains?: DomainCatalog) {}

  private compiledPack(domainId: string): LoadedOntologyPack {
    const domain = this.domains?.get(domainId);
    if (!domain?.extensionPack) {
      return this.foundation;
    }
    let extension = this.extensionCache.get(domain.extensionPack);
    if (!extension) {
      extension = loadExtensionPack(domain.extensionPack);
      this.extensionCache.set(domain.extensionPack, extension);
    }
    return mergeOntologyPacks(this.foundation, extension);
  }

  resolve(
    tenant: TenantDefinition,
    domainId: string,
    options: PackResolveOptions = {},
  ): ResolvedPack {
    if (!tenant.enabledDomains.includes(domainId)) {
      throw new Error(
        `domain ${domainId} not enabled for tenant ${tenant.id}`,
      );
    }
    const domain = this.domains?.get(domainId);
    const packBranch =
      options.packBranch ??
      process.env.DAEMON_PACK_BRANCH ??
      domain?.packBranch ??
      "main";
    const environment =
      options.environment ??
      process.env.DAEMON_PACK_ENVIRONMENT ??
      "production";
    const compiled = this.compiledPack(domainId);
    const baseVersion = compiled.manifest.version;
    return {
      ontologyId: compiled.manifest.ontologyId,
      entityTypes: [...compiled.manifest.entityTypes],
      models: new Map(compiled.models),
      relations: new Map(compiled.relations),
      junctions: new Map(compiled.junctions),
      packVersion:
        packBranch === "main" ? baseVersion : `${baseVersion}+${packBranch}`,
      packBranch,
      environment,
    };
  }
}
