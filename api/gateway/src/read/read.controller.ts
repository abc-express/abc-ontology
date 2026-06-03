import { Controller, Get, Param, Query } from "@nestjs/common";
import { ReadService } from "./read.service";

@Controller("v1/read")
export class ReadController {
  constructor(private readonly reads: ReadService) {}

  @Get("entities/:entityId")
  getEntity(
    @Param("entityId") entityId: string,
    @Query("ontologyId") ontologyId: string,
  ) {
    return this.reads.getEntity(ontologyId ?? "default", entityId);
  }
}
