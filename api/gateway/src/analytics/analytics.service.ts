import { Injectable } from "@nestjs/common";
import { defaultOntology } from "@daemon/ontology";
import { ontologyId } from "@daemon/platform-types";
import { AnalyticsWorkflows } from "@daemon/products/analytics-workflows/analytics-workflows.js";
import type { AnalyticsReport } from "@daemon/products/analytics-workflows/report-generator.js";
import type { DashboardSpec } from "@daemon/products/analytics-workflows/dashboard-builder.js";
import type { EntityRecord } from "@daemon/ontology";

export interface AnalyticsSearchQuery {
  q: string;
  ontologyId?: string;
  limit?: number;
  property?: string;
  propertyValue?: string;
  reportTitle?: string;
}

export interface AnalyticsDashboardQuery {
  ontologyId?: string;
  breakdownField?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly flows = new AnalyticsWorkflows();

  searchReport(query: AnalyticsSearchQuery): AnalyticsReport {
    const ont = ontologyId(query.ontologyId ?? defaultOntology());
    return this.flows.searchAndReport({
      query: query.q,
      ontologyId: ont,
      limit: query.limit,
      property: query.property,
      propertyValue: query.propertyValue,
      reportTitle: query.reportTitle,
    });
  }

  searchEntities(query: AnalyticsSearchQuery): EntityRecord[] {
    const ont = ontologyId(query.ontologyId ?? defaultOntology());
    return this.flows.search({
      query: query.q,
      ontologyId: ont,
      limit: query.limit,
      property: query.property,
      propertyValue: query.propertyValue,
    });
  }

  dashboard(query: AnalyticsDashboardQuery): DashboardSpec {
    const ont = ontologyId(query.ontologyId ?? defaultOntology());
    return this.flows.buildDashboard(ont, {
      breakdownField: query.breakdownField,
    });
  }
}
