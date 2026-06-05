import { Injectable } from "@nestjs/common";
import { PostgresClient } from "@daemon/data-platform/operational-store";
import { MdmStore } from "@daemon/data-platform/mdm/mdm-store";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";
import type { DaemonSession } from "@daemon/platform-types";

@Injectable()
export class ActionsService {
  private store: MdmStore | null = null;

  constructor(private readonly runtime: DaemonRuntime) {}

  private async getStore(): Promise<MdmStore> {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) {
      throw new Error("DAEMON_POSTGRES_URL required for audited actions");
    }
    if (!this.store) {
      const pg = new PostgresClient({ connectionString: url });
      this.store = new MdmStore(pg);
    }
    return this.store;
  }

  private actorId(session: DaemonSession): string {
    return session.subjectId || "system";
  }

  async resolveLocationConflict(
    _ctx: TenantContextHeaders,
    session: DaemonSession,
    body: {
      conflictId: string;
      canonicalId: string;
      resolvedValue: string;
      reasonCode?: string;
      idempotencyKey?: string;
    },
  ) {
    this.runtime.assertAllowed("write", "entity");
    const store = await this.getStore();
    return store.resolveLocationConflict({
      ...body,
      actorId: this.actorId(session),
    });
  }

  async createSignal(
    _ctx: TenantContextHeaders,
    session: DaemonSession,
    body: {
      signalId: string;
      signalType: string;
      severity: string;
      accountRef?: string;
      idempotencyKey?: string;
    },
  ) {
    this.runtime.assertAllowed("write", "entity");
    const store = await this.getStore();
    return store.createSignal({
      ...body,
      actorId: this.actorId(session),
    });
  }

  async updateServiceAreaCoverage(
    _ctx: TenantContextHeaders,
    session: DaemonSession,
    body: {
      coverageId: string;
      locationId: string;
      coverageStatus: "active" | "inactive" | "pending" | "suspended";
      servingRo?: string;
      servingAgent?: string;
      slaHours?: number;
      is3t?: boolean;
      sourceSystem?: string;
      reasonCode?: string;
      idempotencyKey?: string;
    },
  ) {
    this.runtime.assertAllowed("write", "entity");
    const store = await this.getStore();
    return store.updateServiceAreaCoverage({
      ...body,
      actorId: this.actorId(session),
    });
  }

  async getActionCatalog() {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");
    const root = process.env.DAEMON_REPO_ROOT ?? process.cwd();
    const path = join(root, "configs", "abc-express", "action-catalog.yaml");
    return parse(readFileSync(path, "utf8"));
  }
}
