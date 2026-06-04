import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { ReadModule } from "./read/read.module";
import { WriteModule } from "./write/write.module";
import { PolicyModule } from "./policy/policy.module";
import { AuthModule } from "./auth/auth.module";
import { IngestModule } from "./ingest/ingest.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AutomationsModule } from "./automations/automations.module";
import { ObservabilityModule } from "./observability/observability.module";
import { PlatformModule } from "./platform/platform.module";
import { GovernanceModule } from "./governance/governance.module";
import { QueryModule } from "./query/query.module";

@Module({
  imports: [
    PlatformModule,
    GovernanceModule,
    ObservabilityModule,
    AuthModule,
    HealthModule,
    ReadModule,
    WriteModule,
    PolicyModule,
    IngestModule,
    AnalyticsModule,
    AutomationsModule,
    QueryModule,
  ],
})
export class AppModule {}
