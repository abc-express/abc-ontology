import type { ProductRuntime } from "../shared/product-runtime.js";

export interface BronzeEntityTypeCountRow {
  entityType: string;
  count: number;
}

export interface BronzeChangeVolumeRow {
  day: string;
  changeType: string;
  count: number;
}

export interface BronzeLakehouseSummary {
  entityTypeCounts: BronzeEntityTypeCountRow[];
  changeVolumeByDay: BronzeChangeVolumeRow[];
  window: { since?: string };
}

export interface LakehouseAnalyticsReport {
  title: string;
  generatedAt: string;
  summary: BronzeLakehouseSummary;
  /** Total bronze events in the summary window. */
  totalEvents: number;
}

export type LakehouseSummaryReader = (
  scope: { tenantId: string; domainId: string },
  options: { since?: string },
) => Promise<BronzeLakehouseSummary>;

/**
 * Builds an analytics report from lakehouse bronze rollups (change history / volume).
 */
export class LakehouseAnalytics {
  constructor(
    private readonly runtime: ProductRuntime,
    private readonly readSummary: LakehouseSummaryReader,
  ) {}

  async lakehouseReport(options: {
    since?: string;
    reportTitle?: string;
  } = {}): Promise<LakehouseAnalyticsReport> {
    this.runtime.assertAllowed("query", "analytics");
    const scope = this.runtime.scope;
    if (!scope) {
      throw new Error("ProductRuntime scope is required for lakehouse analytics");
    }
    const summary = await this.readSummary(scope, { since: options.since });
    const totalEvents = summary.entityTypeCounts.reduce(
      (sum, row) => sum + row.count,
      0,
    );
    return {
      title: options.reportTitle ?? "Lakehouse change summary",
      generatedAt: new Date().toISOString(),
      summary,
      totalEvents,
    };
  }
}
