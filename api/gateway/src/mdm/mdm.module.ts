import { Module } from "@nestjs/common";
import { MdmController } from "./mdm.controller";
import { MdmService } from "./mdm.service";

@Module({
  controllers: [MdmController],
  providers: [MdmService],
})
export class MdmModule {}
