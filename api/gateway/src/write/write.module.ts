import { Module } from "@nestjs/common";
import { WriteController } from "./write.controller";
import { WriteService } from "./write.service";

@Module({
  controllers: [WriteController],
  providers: [WriteService],
})
export class WriteModule {}
