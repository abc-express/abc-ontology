import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

describe("access-policies fixture", () => {
  it("loads allow rules for entity read/write", async () => {
    const raw = await readFile(
      join(process.cwd(), "configs/policies/access-policies.yaml"),
      "utf8",
    );
    const rules = parseYaml(raw) as Array<{ action: string; effect: string }>;
    assert.ok(rules.some((r) => r.action === "read" && r.effect === "allow"));
  });
});
