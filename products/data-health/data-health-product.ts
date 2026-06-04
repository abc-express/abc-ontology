import type { ProductRuntime } from "../shared/product-runtime.js";

export interface DataHealthProductSummary {
  generatedAt: string;
  searchIndexSize: number;
  registryReplayReady: boolean;
}

/** Thin product wrapper over runtime lakehouse/search signals. */
export class DataHealthProduct {
  constructor(private readonly runtime: ProductRuntime) {}

  async snapshot(): Promise<DataHealthProductSummary> {
    let searchIndexSize = 0;
    try {
      if (this.runtime.search && this.runtime.scope) {
        const probe = await this.runtime.search.search(this.runtime.scope, {
          query: "health",
          limit: 5,
        });
        searchIndexSize = probe.length;
      }
    } catch {
      searchIndexSize = 0;
    }
    return {
      generatedAt: new Date().toISOString(),
      searchIndexSize,
      registryReplayReady: Boolean(process.env.DAEMON_POSTGRES_URL),
    };
  }
}
