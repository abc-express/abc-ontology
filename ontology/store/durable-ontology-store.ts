import type { EntityId, OntologyId } from "@daemon/platform-types";
import type {
  EntityRecord,
  OntologyStore,
  OntologyScope,
  RegisterEntityInput,
  PatchEntityInput,
  RegistryListener,
} from "@daemon/context-ports";
import type {
  EntityJournal,
  PostgresEntityJournal,
} from "@daemon/data-platform/operational-store/entity-journal";
import type { OntologyRegistry } from "../registry/ontology-registry.js";

export interface DurableWriteContext {
  packVersion?: string;
}

/**
 * Sync OntologyStore with write-through persistence to Postgres snapshots.
 */
export class DurableOntologyStore implements OntologyStore {
  private persistChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly inner: OntologyRegistry,
    private readonly journal: EntityJournal,
    private readonly writeContext: DurableWriteContext = {},
  ) {}

  innerRegistry(): OntologyRegistry {
    return this.inner;
  }

  entityJournal(): EntityJournal {
    return this.journal;
  }

  /** Awaits all in-flight journal writes (for tests and shutdown). */
  pendingWrites(): Promise<void> {
    return this.persistChain;
  }

  private enqueuePersist(
    record: EntityRecord,
    changeType: "register" | "patch",
  ): void {
    this.persistChain = this.persistChain
      .then(() => this.persist(record, changeType))
      .catch((error) => {
        console.error("durable ontology persist failed", error);
      });
  }

  private async persist(
    record: EntityRecord,
    changeType: "register" | "patch",
  ): Promise<void> {
    await this.journal.upsert(record);
    const journal = this.journal as PostgresEntityJournal;
    if (typeof journal.recordChange === "function") {
      await journal.recordChange({
        scope: {
          tenantId: record.tenantId,
          domainId: record.domainId,
        },
        ontologyId: String(record.ontologyId),
        entityId: String(record.entityId),
        changeType,
        payload: record.properties,
        packVersion: this.writeContext.packVersion,
      });
    }
    if (record.entityType === "Link") {
      await this.persistLinkGraph(record, journal);
    }
  }

  private async persistLinkGraph(
    record: EntityRecord,
    journal: PostgresEntityJournal,
  ): Promise<void> {
    const fromId = record.properties.fromEntityId;
    const toId = record.properties.toEntityId;
    const relation =
      typeof record.properties.linkType === "string"
        ? record.properties.linkType
        : "link";
    if (
      typeof fromId !== "string" ||
      typeof toId !== "string" ||
      typeof journal.upsertGraphEdge !== "function"
    ) {
      return;
    }
    await journal.upsertGraphEdge({
      scope: {
        tenantId: record.tenantId,
        domainId: record.domainId,
      },
      fromId,
      toId,
      relation,
    });
  }

  register(input: RegisterEntityInput): EntityRecord;
  register(
    ont: OntologyId,
    props: Record<string, unknown>,
    id?: EntityId,
    scope?: Partial<OntologyScope>,
  ): EntityRecord;
  register(
    ontOrInput: OntologyId | RegisterEntityInput,
    props?: Record<string, unknown>,
    id?: EntityId,
    scopeArg?: Partial<OntologyScope>,
  ): EntityRecord {
    const record =
      typeof ontOrInput === "object" &&
      ontOrInput !== null &&
      "scope" in ontOrInput
        ? this.inner.register(ontOrInput)
        : this.inner.register(
            ontOrInput as OntologyId,
            props ?? {},
            id,
            scopeArg,
          );
    this.enqueuePersist(record, "register");
    return record;
  }

  get(
    scopeOrOnt: OntologyScope | OntologyId,
    ontOrId?: OntologyId | EntityId,
    idArg?: EntityId,
  ): EntityRecord | undefined {
    return this.inner.get(scopeOrOnt, ontOrId, idArg);
  }

  list(
    scopeOrOnt?: OntologyScope | OntologyId,
    ontArg?: OntologyId,
  ): EntityRecord[] {
    return this.inner.list(scopeOrOnt, ontArg);
  }

  patch(input: PatchEntityInput): EntityRecord;
  patch(
    ont: OntologyId,
    id: EntityId,
    patchProps: Record<string, unknown>,
    scope?: Partial<OntologyScope>,
  ): EntityRecord;
  patch(
    ontOrInput: OntologyId | PatchEntityInput,
    id?: EntityId,
    patchProps?: Record<string, unknown>,
    scopeArg?: Partial<OntologyScope>,
  ): EntityRecord {
    const record =
      typeof ontOrInput === "object" &&
      ontOrInput !== null &&
      "scope" in ontOrInput
        ? this.inner.patch(ontOrInput)
        : this.inner.patch(
            ontOrInput as OntologyId,
            id as EntityId,
            patchProps ?? {},
            scopeArg,
          );
    this.enqueuePersist(record, "patch");
    return record;
  }

  subscribe(listener: RegistryListener): () => void {
    return this.inner.subscribe(listener);
  }

  subscribeEvents(
    listener: import("../registry/ontology-registry.js").RegistryEventListener,
  ): () => void {
    return this.inner.subscribeEvents(listener);
  }
}
