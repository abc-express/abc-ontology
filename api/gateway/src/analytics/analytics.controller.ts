import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

/**
 * Analytics workflows over the ontology registry (search, reports, dashboards).
 * Policy `query:analytics` is enforced inside {@link AnalyticsWorkflows}.
 */
@Controller("v1/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("search")
  searchReport(
    @Query("q") q: string,
    @Query("ontologyId") ontologyId?: string,
    @Query("limit") limit?: string,
    @Query("property") property?: string,
    @Query("propertyValue") propertyValue?: string,
    @Query("reportTitle") reportTitle?: string,
  ) {
    return this.analytics.searchReport({
      q: q ?? "",
      ontologyId,
      limit: limit ? Number(limit) : undefined,
      property,
      propertyValue,
      reportTitle,
    });
  }

  @Get("entities")
  searchEntities(
    @Query("q") q: string,
    @Query("ontologyId") ontologyId?: string,
    @Query("limit") limit?: string,
    @Query("property") property?: string,
    @Query("propertyValue") propertyValue?: string,
  ) {
    return this.analytics.searchEntities({
      q: q ?? "",
      ontologyId,
      limit: limit ? Number(limit) : undefined,
      property,
      propertyValue,
    });
  }

  @Get("dashboard")
  dashboard(
    @Query("ontologyId") ontologyId?: string,
    @Query("breakdownField") breakdownField?: string,
  ) {
    return this.analytics.dashboard({ ontologyId, breakdownField });
  }
}
