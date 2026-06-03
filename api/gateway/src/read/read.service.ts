import { Injectable } from "@nestjs/common";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { entityId, ontologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";

@Injectable()
export class ReadService {
  private readonly router = new ReadRouter();

  ensureSeed() {
    if (!globalRegistry.get(ontologyId("default"), entityId("ent-1"))) {
      globalRegistry.register(ontologyId("default"), { name: "Seed" }, entityId("ent-1"));
    }
  }

  getEntity(ont: string, id: string) {
    this.ensureSeed();
    return this.router.route({
      ontologyId: ontologyId(ont),
      entityId: entityId(id),
    });
  }
}
