import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";

/** Wires the ingest proxy controller to the Go orchestrator client. */
@Module({
  controllers: [IngestController],
  providers: [
    {
      provide: IngestService,
      useFactory: () => IngestService.create(process.env),
    },
  ],
})
export class IngestModule {}
