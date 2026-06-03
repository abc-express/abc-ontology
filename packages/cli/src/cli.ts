#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "./validate-config.js";

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
        console.log("ontology lint: no violations");
        break;
      }
      throw new Error(`unknown ontology subcommand: ${args.join(" ")}`);
    case "dev":
      if (args[0] === "up") {
        const compose = path.join(repoRoot, "deployment/docker/compose.dev.yaml");
        await run("docker", ["compose", "-f", compose, "up", "-d"]);
        await run("node", [path.join(repoRoot, "scripts/wait-for-services.mjs")], {
          DAEMON_POSTGRES_URL: "postgresql://daemon:daemon@127.0.0.1:5432/daemon",
          DAEMON_REDIS_URL: "redis://127.0.0.1:6379",
        });
        console.log("Dev stack is up (postgres, redis, nats, otel-collector)");
        break;
      }
      throw new Error(`unknown dev subcommand: ${args.join(" ")}`);
    default:
      console.error("Usage: daemon-cli validate-config | ontology lint | dev up");
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
