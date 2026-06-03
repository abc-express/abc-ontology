import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { VersionManager, parseSemVer } from "./version-manager.js";

describe("VersionManager", () => {
  it("starts at the initial version", () => {
    assert.equal(new VersionManager("1.2.3").current(), "1.2.3");
  });

  it("bumps patch, minor, and major correctly", () => {
    const v = new VersionManager("1.2.3");
    assert.equal(v.bump("patch"), "1.2.4");
    assert.equal(v.bump("minor"), "1.3.0");
    assert.equal(v.bump("major"), "2.0.0");
    assert.deepEqual(v.versions(), ["1.2.3", "1.2.4", "1.3.0", "2.0.0"]);
  });

  it("rejects malformed versions", () => {
    assert.throws(() => parseSemVer("1.2"), DaemonError);
  });
});
