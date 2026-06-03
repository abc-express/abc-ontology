import { Module } from "@nestjs/common";
import { ReadController } from "./read.controller";
import { ReadService } from "./read.service";

@Module({
  controllers: [ReadController],
  providers: [ReadService],
})
export class ReadModule {}
