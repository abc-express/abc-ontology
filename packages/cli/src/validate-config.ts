import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const REQUIRED_PLATFORM_KEYS = ["platform", "tenancy", "environments"] as const;

export async function validateConfig(configDir: string): Promise<void> {
  const platformPath = join(configDir, "platform.yaml");
  const raw = await readFile(platformPath, "utf8");
  const doc = parseYaml(raw) as Record<string, unknown>;
  for (const key of REQUIRED_PLATFORM_KEYS) {
    if (!(key in doc)) {
      throw new Error(`platform.yaml missing required key: ${key}`);
    }
  }
  const tenancy = doc.tenancy as { defaultTenant?: string };
  if (!tenancy?.defaultTenant) {
    throw new Error("platform.yaml tenancy.defaultTenant is required");
  }
}
