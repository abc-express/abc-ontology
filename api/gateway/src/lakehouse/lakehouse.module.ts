import { Module } from "@nestjs/common";
import { LakehouseController } from "./lakehouse.controller";
import { LakehouseService } from "./lakehouse.service";
import { LakehouseExportService } from "./lakehouse-export.service";

@Module({
  controllers: [LakehouseController],
  providers: [LakehouseService, LakehouseExportService],
})
export class LakehouseModule {}
