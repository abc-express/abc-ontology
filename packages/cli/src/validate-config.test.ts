import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateConfig } from "./validate-config.js";

describe("validateConfig", () => {
  it("accepts minimal platform.yaml", async () => {
    const dir = await mkdtemp(join(tmpdir(), "daemon-cfg-"));
    await writeFile(
      join(dir, "platform.yaml"),
      `platform:
  name: test
tenancy:
  defaultTenant: default
environments:
  - name: dev
`,
      "utf8",
    );
    await validateConfig(dir);
    assert.ok(true);
  });
});
