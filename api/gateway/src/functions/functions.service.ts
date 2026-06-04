import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { Injectable } from "@nestjs/common";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { entityId, ontologyId } from "@daemon/platform-types";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

interface FunctionDef {
  id: string;
  handler: "echo" | "read_entity";
}

@Injectable()
export class FunctionsService {
  constructor(private readonly runtime: DaemonRuntime) {}

  private loadCatalog(): FunctionDef[] {
    const root = process.env.DAEMON_REPO_ROOT ?? process.cwd();
    const path = join(root, "configs/action-runtime/functions-catalog.yaml");
    if (!existsSync(path)) return [{ id: "echo", handler: "echo" }];
    const doc = parseYaml(readFileSync(path, "utf8")) as {
      functions?: FunctionDef[];
    };
    return doc.functions ?? [];
  }

  invoke(
    ctx: TenantContextHeaders,
    functionId: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    this.runtime.assertAllowed("read", "function-invoke");
    const fn = this.loadCatalog().find((f) => f.id === functionId);
    if (!fn) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `function ${functionId} not found`,
        404,
      );
    }
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    if (fn.handler === "read_entity") {
      const eid = String(input.entityId ?? "");
      const ont = String(input.ontologyId ?? "foundation");
      return {
        functionId,
        result: this.runtime.store.get(scope, ontologyId(ont), entityId(eid)),
      };
    }
    return { functionId, echo: input };
  }
}
