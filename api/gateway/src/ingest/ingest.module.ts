import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestSchedulesController } from "./ingest-schedules.controller";
import { IngestService } from "./ingest.service";
import { IngestPipelineService } from "./ingest-pipeline.service";
import { IngestScheduleService } from "./ingest-schedule.service";
import { IngestWebhookService } from "./ingest-webhook.service";
import { IngestListenerService } from "./ingest-listener.service";
import { DaemonRuntime } from "../platform/daemon-runtime";

@Module({
  controllers: [IngestController, IngestSchedulesController],
  providers: [
    {
      provide: IngestService,
      useFactory: (runtime: DaemonRuntime) =>
        IngestService.create(runtime, process.env),
      inject: [DaemonRuntime],
    },
    {
      provide: IngestPipelineService,
      useFactory: (ingest: IngestService) =>
        IngestPipelineService.create(ingest, process.env),
      inject: [IngestService],
    },
    IngestScheduleService,
    IngestWebhookService,
    IngestListenerService,
  ],
  exports: [IngestService, IngestPipelineService, IngestWebhookService],
})
export class IngestModule {}
