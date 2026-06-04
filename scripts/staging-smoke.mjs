#!/usr/bin/env node
/**
 * Staging smoke: helm template render (or chart file checks when helm CLI absent);
 * optional live gateway health + ops when reachable.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const base = process.env.DAEMON_GATEWAY_URL ?? "http://127.0.0.1:3000";
const requireGateway = process.env.DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY === "1";

const CHART_TEMPLATES = [
  "Chart.yaml",
  "values.yaml",
  "templates/deployment-gateway.yaml",
  "templates/deployment-ingest.yaml",
  "templates/deployment-agent-worker.yaml",
  "templates/service-gateway.yaml",
];

function validateHelmChart(chartDir) {
  for (const rel of CHART_TEMPLATES) {
    const path = join(chartDir, rel);
    if (!existsSync(path)) {
      throw new Error(`missing helm chart file: ${rel}`);
    }
  }
}

function renderHelm(chartDir) {
  try {
    execSync(`helm template daemon-platform ${chartDir}`, {
      cwd: root,
      stdio: "pipe",
    });
    return "helm";
  } catch (error) {
    const status = error && typeof error === "object" ? error.status : undefined;
    if (status === 127) {
      validateHelmChart(chartDir);
      console.warn(
        "staging-smoke: helm CLI not found; chart template files present",
      );
      return "files";
    }
    throw error;
  }
}

async function probeGateway() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) {
    throw new Error(`health ${health.status}`);
  }
  const ops = await fetch(`${base}/v1/ops/health`);
  if (!ops.ok) {
    throw new Error(`ops health ${ops.status}`);
  }
}

async function main() {
  const chart = join(root, "deployment/helm/daemon-platform");
  const helmMode = renderHelm(chart);

  try {
    await probeGateway();
    console.log(`staging-smoke OK (${helmMode} + gateway)`);
  } catch (error) {
    if (requireGateway) {
      console.error(`staging-smoke FAILED: ${error?.message ?? error}`);
      process.exit(1);
    }
    console.warn(
      `staging-smoke: gateway probe skipped (${error?.message ?? error})`,
    );
    console.log(`staging-smoke OK (${helmMode} only)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
