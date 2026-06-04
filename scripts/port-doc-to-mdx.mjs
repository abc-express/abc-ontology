#!/usr/bin/env node
// One-off: port docs markdown to mintlify MDX with frontmatter and internal links.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const LINK_MAP = {
  "./13-sdk.md": "/guides/sdk",
  "./14-data-integration-map.md": "/platform/data-integration-map",
  "./15-data-connection-map.md": "/platform/data-connection-map",
  "./16-data-ops-lifecycle-map.md": "/platform/data-ops-lifecycle",
  "./17-platform-decision-map.md": "/platform/platform-decision-map",
  "./18-enterprise-platform-map.md": "/platform/enterprise-platform-map",
  "./19-product-parity-matrix.md": "/platform/product-parity",
  "./20-deployment-go-live-guide.md": "/operations/go-live",
  "./11-data-platform-lakehouse.md": "/data/lakehouse",
  "./12-connectors-catalog.md": "/data/connectors-catalog",
  "./05-security-governance.md": "/operations/security-governance",
  "./06-deployment-topology.md": "/operations/deployment",
  "./06-testing.md": "/operations/testing",
  "./05-observability-runbook.md": "/operations/observability-runbook",
  "./02-bounded-contexts.md": "/architecture/bounded-contexts",
  "./01-end-to-end-architecture.md": "/architecture/end-to-end",
  "./08-semantic-governance-alignment.md": "/semantics/governance-alignment",
  "./09-ontology-competency-questions.md": "/semantics/competency-questions",
  "./10-neo4j-graph-model.md": "/data/neo4j-graph",
  "./02-ontology-system.md": "/architecture/ontology-system",
};

const SHORT_LINK = [
  [/\[11\]\(\.\/11-data-platform-lakehouse\.md\)/g, "[lakehouse](/data/lakehouse)"],
  [/\[08\]\(\.\/08-semantic-governance-alignment\.md\)/g, "[governance](/semantics/governance-alignment)"],
  [/\[09\]\(\.\/09-ontology-competency-questions\.md\)/g, "[competency questions](/semantics/competency-questions)"],
  [/\[15\]\(\.\/15-data-connection-map\.md\)/g, "[data connection](/platform/data-connection-map)"],
  [/\[16\]\(\.\/16-data-ops-lifecycle-map\.md\)/g, "[data ops lifecycle](/platform/data-ops-lifecycle)"],
  [/doc 14/g, "[data integration map](/platform/data-integration-map)"],
  [/doc 16/g, "[data ops lifecycle](/platform/data-ops-lifecycle)"],
];

const JOBS = [
  {
    src: "docs/13-sdk.md",
    dest: "mintlify/guides/sdk.mdx",
    title: "TypeScript SDK",
    description: "@daemon/sdk DaemonClient, pack codegen, and OpenAPI parity checks.",
  },
  {
    src: "docs/14-data-integration-map.md",
    dest: "mintlify/platform/data-integration-map.mdx",
    title: "Data integration map",
    description: "Enterprise data integration topics mapped to ingest, lakehouse, and SDK surfaces.",
  },
  {
    src: "docs/15-data-connection-map.md",
    dest: "mintlify/platform/data-connection-map.mdx",
    title: "Data connection map",
    description: "Cloud pull vs agent-style connectivity patterns in daemon-sdk.",
  },
  {
    src: "docs/16-data-ops-lifecycle-map.md",
    dest: "mintlify/platform/data-ops-lifecycle.mdx",
    title: "Data Ops lifecycle",
    description: "Connect → Transform → Model → Analyze mapped to modules and roles.",
  },
  {
    src: "docs/17-platform-decision-map.md",
    dest: "mintlify/platform/platform-decision-map.mdx",
    title: "Platform decision map",
    description: "Data, Logic, and Actions pillars mapped to bounded contexts.",
  },
  {
    src: "docs/18-enterprise-platform-map.md",
    dest: "mintlify/platform/enterprise-platform-map.mdx",
    title: "Enterprise platform map",
    description: "Foundry-style platform layers and products/ mapping.",
  },
  {
    src: "docs/19-product-parity-matrix.md",
    dest: "mintlify/platform/product-parity.mdx",
    title: "Product parity matrix",
    description: "Weighted Live capabilities for the enterprise data OS mimic stack.",
  },
  {
    src: "docs/05-observability-runbook.md",
    dest: "mintlify/operations/observability-runbook.mdx",
    title: "Observability runbook",
    description: "Production metrics, OTel, Grafana alerts, and SIEM forwarding.",
  },
];

const GH_TREE = "https://github.com/daemon-blockint-tech/DAEMON/tree/main";

function convertRepoLinks(body) {
  return body
    .replace(/\]\(\.\.\/([^)]+)\)/g, (_, path) => `](${GH_TREE}/${path})`)
    .replace(/\]\(\.\/([^)]+\.md)\)/g, (_, path) => `](${GH_TREE}/docs/${path})`);
}

function convertLinks(body) {
  let out = convertRepoLinks(body);
  for (const [from, to] of Object.entries(LINK_MAP)) {
    const label = from.replace("./", "").replace(".md", "");
    const re = new RegExp(`\\[([^\\]]*)\\]\\(${from.replace(".", "\\.")}\\)`, "g");
    out = out.replace(re, (_, text) => `[${text || label}](${to})`);
  }
  for (const [re, rep] of SHORT_LINK) {
    out = out.replace(re, rep);
  }
  return out;
}

function stripH1(body) {
  const lines = body.split("\n");
  if (lines[0]?.startsWith("# ")) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return body;
}

for (const job of JOBS) {
  const raw = readFileSync(join(root, job.src), "utf8");
  const body = convertLinks(stripH1(raw));
  const mdx = `---
title: "${job.title}"
description: "${job.description}"
---

${body}
`;
  mkdirSync(dirname(join(root, job.dest)), { recursive: true });
  writeFileSync(join(root, job.dest), mdx);
  console.log("wrote", job.dest);
}
