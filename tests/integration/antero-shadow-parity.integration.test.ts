import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGatewayTestApp } from "../helpers/gateway-test-app.js";
import { syntheticTestApiKey } from "../helpers/test-api-keys.js";
import { skipUnlessPostgresReady } from "../helpers/postgres-integration.js";

const TENANT = "abc-antero";
const DOMAIN = "logistics";
const ONTOLOGY = "foundation";
const repoRoot = process.env.DAEMON_REPO_ROOT ?? process.cwd();

const FIXTURE_SOURCES = [
  "abc-fixture-shipments",
  "abc-fixture-manifests",
  "abc-fixture-dispatches",
  "abc-fixture-trips",
  "abc-fixture-ttk",
  "abc-fixture-orders",
  "abc-fixture-accounts",
  "abc-fixture-contacts",
  "abc-fixture-leads",
  "abc-fixture-opportunities",
  "abc-fixture-pipelines",
  "abc-fixture-signals",
  "abc-fixture-obl-manifests",
] as const;

interface GoldenSummary {
  entityCounts: Record<string, number>;
  sampleEntities: {
    Shipment: {
      externalRef: string;
      displayName: string;
      status: string;
    };
  };
}

function authHeaders(
  apiKey: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "x-daemon-tenant": TENANT,
    "x-daemon-domain": DOMAIN,
    ...extra,
  };
}

describe("antero shadow parity golden e2e", () => {
  it("abc fixtures ingest → read entities match golden summary", async (t) => {
    const postgresUrl = await skipUnlessPostgresReady(t);
    if (!postgresUrl) return;
    if (process.env.DAEMON_INTEGRATION_REQUIRED !== "1" && !process.env.CI) {
      t.skip("set DAEMON_INTEGRATION_REQUIRED=1 or run in CI");
      return;
    }

    const goldenPath = join(repoRoot, "tests/fixtures/abc-express/golden-summary.json");
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenSummary;

    const abcApiKey = syntheticTestApiKey("abc-parity");
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_POSTGRES_URL: postgresUrl,
      DAEMON_REPO_ROOT: repoRoot,
      DAEMON_AUTH_MODE: "dev",
      DAEMON_ABC_FIXTURES: "1",
      DAEMON_API_KEYS: `${abcApiKey}:abc-parity:${TENANT}:admin|logistics-viewer`,
    });

    try {
      for (const sourceId of FIXTURE_SOURCES) {
        const runRes = await fetch(`${baseUrl}/v1/ingest/sources/${sourceId}/run`, {
          method: "POST",
          headers: authHeaders(abcApiKey),
          body: JSON.stringify({}),
        });
        const runText = await runRes.text();
        assert.ok(runRes.ok, `${sourceId}: ${runText}`);
        const runBody = JSON.parse(runText) as { accepted?: number };
        assert.ok((runBody.accepted ?? 0) >= 1, `${sourceId} accepted none`);
      }

      for (const [entityType, expectedCount] of Object.entries(golden.entityCounts)) {
        const listRes = await fetch(
          `${baseUrl}/v1/read/entities?ontologyId=${ONTOLOGY}&entityType=${encodeURIComponent(entityType)}&limit=200`,
          { headers: authHeaders(abcApiKey) },
        );
        assert.equal(listRes.status, 200, await listRes.text());
        const listBody = (await listRes.json()) as { items: unknown[] };
        assert.equal(
          listBody.items.length,
          expectedCount,
          `entityType ${entityType}`,
        );
      }

      const shipmentRes = await fetch(
        `${baseUrl}/v1/read/entities?ontologyId=${ONTOLOGY}&entityType=Shipment&limit=50`,
        { headers: authHeaders(abcApiKey) },
      );
      const shipmentBody = (await shipmentRes.json()) as {
        items: { properties: Record<string, unknown> }[];
      };
      const sample = golden.sampleEntities.Shipment;
      const match = shipmentBody.items.find(
        (item) => item.properties.externalRef === sample.externalRef,
      );
      assert.ok(match, "sample shipment not found");
      assert.equal(match.properties.displayName, sample.displayName);
      assert.equal(match.properties.status, sample.status);

      const pricingRes = await fetch(`${baseUrl}/v1/products/shadow-pricing/simulate`, {
        method: "POST",
        headers: authHeaders(abcApiKey),
        body: JSON.stringify({
          ontologyId: ONTOLOGY,
          shipmentRef: sample.externalRef,
        }),
      });
      assert.equal(pricingRes.status, 200, await pricingRes.text());
      const pricingBody = (await pricingRes.json()) as {
        readOnly: boolean;
        shipments: { count: number };
      };
      assert.equal(pricingBody.readOnly, true);
      assert.ok(pricingBody.shipments.count >= 1);
    } finally {
      await close();
    }
  });
});
