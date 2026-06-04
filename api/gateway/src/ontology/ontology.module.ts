import { Module } from "@nestjs/common";
import { OntologyPackController } from "./ontology-pack.controller";
import { OntologyPackService } from "./ontology-pack.service";

@Module({
  controllers: [OntologyPackController],
  providers: [OntologyPackService],
})
export class OntologyModule {}
