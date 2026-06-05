import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { PostgresClient } from "@daemon/data-platform/operational-store";
import { MdmStore } from "@daemon/data-platform/mdm/mdm-store";
import { PILOT_LOCATIONS } from "@daemon/data-platform/mdm/pilot-locations";
import { runMigrations } from "@daemon/data-platform/migrations";
import {
  createGatewayTestApp,
  DEV_API_KEY,
  daemonTenantHeaders,
  type GatewayTestApp,
} from "../helpers/gateway-test-app.js";
import { resolvePostgresUrlForTests } from "../helpers/postgres-integration.js";

const repoRoot = join(import.meta.dirname, "..", "..");

describe("ABC Express MDM integration", () => {
  let pgUrl: string | undefined;
  let pg: PostgresClient | undefined;
  let gateway: GatewayTestApp | undefined;

  before(async () => {
    pgUrl = await resolvePostgresUrlForTests(process.env.DAEMON_POSTGRES_URL);
    if (!pgUrl) return;
    process.env.DAEMON_POSTGRES_URL = pgUrl;
    process.env.DAEMON_REPO_ROOT = repoRoot;
    await runMigrations(process.env);
    pg = new PostgresClient({ connectionString: pgUrl });
    gateway = await createGatewayTestApp(process.env);
  });

  after(async () => {
    await gateway?.close();
    await pg?.close();
  });

  it("source-system-registry lists four production systems", () => {
    const doc = parseYaml(
      readFileSync(
        join(repoRoot, "configs", "abc-express", "source-system-registry.yaml"),
        "utf8",
      ),
    );
    const ids = (doc.sourceSystems ?? []).map((s: { id: string }) => s.id);
    assert.deepEqual(
      ids.sort(),
      ["abc-talk", "antero", "cms", "obl", "vendor-feed"].sort(),
    );
  });

  it("location matcher ingests source rows and opens conflicts", async () => {
    if (!pg) {
      console.log("skip: postgres unavailable");
      return;
    }
    const store = new MdmStore(pg);
    await store.seedPilotLocations(PILOT_LOCATIONS);

    const jaksel = await store.ingestSourceLocation({
      sourceSystem: "antero",
      sourcePk: "city-3174",
      name: "Jakarta Selatan",
      provinceName: "DKI Jakarta",
      kabKotaCode: "3174",
    });
    assert.equal(jaksel.match.canonical?.locationId, "LOC-3174");
    assert.equal(jaksel.match.matchMethod, "exact_code");

    const unknown = await store.ingestSourceLocation({
      sourceSystem: "antero",
      sourcePk: "city-9999",
      name: "Unknown Remote Area",
      provinceName: "Papua",
    });
    assert.equal(unknown.match.matchMethod, "unmatched");
    assert.ok(unknown.conflictId);
  });

  it("GET /v1/ontology/locations returns pilot canonical locations", async () => {
    if (!gateway) {
      console.log("skip: gateway unavailable");
      return;
    }
    const res = await fetch(`${gateway.baseUrl}/v1/ontology/locations`, {
      headers: {
        "x-api-key": DEV_API_KEY,
        ...daemonTenantHeaders("abc-antero", "logistics"),
      },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { locations: Array<{ locationId: string }> };
    assert.ok(body.locations.some((l) => l.locationId === "LOC-3174"));
  });

  it("POST /v1/actions/create-signal writes audit trail", async () => {
    if (!gateway || !pg) {
      console.log("skip: gateway/postgres unavailable");
      return;
    }
    const key = `idem-${Date.now()}`;
    const res = await fetch(`${gateway.baseUrl}/v1/actions/create-signal`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": DEV_API_KEY,
        ...daemonTenantHeaders("abc-antero", "logistics"),
      },
      body: JSON.stringify({
        signalId: "sig-test-1",
        signalType: "lead_response_breach",
        severity: "medium",
        idempotencyKey: key,
      }),
    });
    assert.equal(res.status, 200, await res.text());
    const audit = await pg.query(
      `SELECT count(*)::int AS c FROM abc_core.audit_events WHERE idempotency_key = $1`,
      [key],
    );
    assert.equal(audit.rows[0]?.c, 1);
  });
});
