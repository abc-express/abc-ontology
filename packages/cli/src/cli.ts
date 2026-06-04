#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "./validate-config.js";
import { validateSchemaChange } from "./validate-schema-change.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const [cmd, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (cmd) {
    case "validate-config": {
      const dir = args[0] ?? process.env.DAEMON_CONFIG_DIR ?? "./configs";
      await validateConfig(dir);
      console.log(`Config OK: ${dir}`);
      break;
    }
    case "ontology":
      if (args[0] === "lint") {
        await run("node", [path.join(repoRoot, "scripts/validate-ontology-pack.mjs")]);
        break;
      }
      if (args[0] === "validate-schema-change") {
        const proposedDirIdx = args.indexOf("--proposed-dir");
        const proposedPackDir =
          proposedDirIdx >= 0 ? args[proposedDirIdx + 1] : undefined;
        const changeType = (args.find((a) =>
          ["field_add", "field_remove", "type_rename"].includes(a),
        ) ?? (proposedPackDir ? undefined : "field_remove")) as
          | "field_add"
          | "field_remove"
          | "type_rename"
          | undefined;
        const breaking = args.includes("--breaking") ? true : undefined;
        const approved = args.includes("--approved");
        validateSchemaChange({
          packId: "foundation",
          changeType,
          breaking,
          proposedPackDir,
          approvals: approved ? ["approver-1", "approver-2"] : [],
        });
        break;
      }
      throw new Error(`unknown ontology subcommand: ${args.join(" ")}`);
    case "graph":
      if (args[0] === "backfill-neo4j") {
        await runNeo4jBackfillCli(args.slice(1));
        break;
      }
      throw new Error(`unknown graph subcommand: ${args.join(" ")}`);
    case "dev":
      if (args[0] === "up") {
        const compose = path.join(repoRoot, "deployment/docker/compose.dev.yaml");
        await run("docker", ["compose", "-f", compose, "up", "-d"]);
        await run("node", [path.join(repoRoot, "scripts/wait-for-services.mjs")], {
          DAEMON_POSTGRES_URL: "postgresql://daemon:daemon@127.0.0.1:5432/daemon",
          DAEMON_REDIS_URL: "redis://127.0.0.1:6379",
        });
        console.log("Dev stack is up (postgres, redis, nats, otel-collector, neo4j)");
        console.log("Neo4j Browser: http://127.0.0.1:7474 (neo4j / daemon-dev-neo4j)");
        console.log(
          "Neo4j Bolt: DAEMON_NEO4J_URI=bolt://127.0.0.1:7687 DAEMON_NEO4J_USER=neo4j DAEMON_NEO4J_PASSWORD=daemon-dev-neo4j",
        );
        console.log(
          "Migrations: DAEMON_POSTGRES_URL=postgresql://daemon:daemon@127.0.0.1:5432/daemon pnpm run db:migrate",
        );
        console.log(
          "Integration: DAEMON_POSTGRES_URL=postgresql://daemon_app:daemon_app@127.0.0.1:5432/daemon pnpm run test:repo",
        );
        break;
      }
      throw new Error(`unknown dev subcommand: ${args.join(" ")}`);
    default:
      console.error(
        "Usage: daemon-cli validate-config | ontology lint | ontology validate-schema-change ... | graph backfill-neo4j [--tenant-id T] [--domain-id D] [--dry-run] | dev up",
      );
      process.exit(1);
  }
}

function run(
  cmd: string,
  cmdArgs: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: repoRoot, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function runNeo4jBackfillCli(args: string[]): Promise<void> {
  const { Neo4jGraphStore } = await import(
    "@daemon/data-platform/graph-store/neo4j-graph-store"
  );
  const { PostgresEntityJournal } = await import(
    "@daemon/data-platform/operational-store/entity-journal"
  );
  const { runNeo4jBackfill } = await import(
    "@daemon/ontology/graph-sync/neo4j-backfill.js"
  );
  const { DEFAULT_DOMAIN_ID, DEFAULT_TENANT_ID } = await import(
    "@daemon/context-ports"
  );

  const store = Neo4jGraphStore.fromEnv();
  if (!store) {
    throw new Error("DAEMON_NEO4J_URI is required for backfill");
  }
  const pgUrl = process.env.DAEMON_POSTGRES_URL;
  if (!pgUrl) {
    throw new Error("DAEMON_POSTGRES_URL is required for backfill");
  }

  let tenantId = DEFAULT_TENANT_ID;
  let domainId = DEFAULT_DOMAIN_ID;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant-id" && args[i + 1]) tenantId = args[++i];
    else if (args[i] === "--domain-id" && args[i + 1]) domainId = args[++i];
    else if (args[i] === "--dry-run") dryRun = true;
  }

  const journal = PostgresEntityJournal.fromEnv({
    ...process.env,
    DAEMON_POSTGRES_URL: pgUrl,
  });
  if (!journal) {
    throw new Error("failed to open Postgres entity journal");
  }
  const result = await runNeo4jBackfill(journal, store, {
    scope: { tenantId, domainId },
    dryRun,
    onProgress: (msg) => console.log(msg),
  });
  await store.close();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
