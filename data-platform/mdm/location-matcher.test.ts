import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LocationMatcher } from "./location-matcher.js";

const JAKSEL: Parameters<LocationMatcher["register"]>[0] = {
  locationId: "LOC-3174",
  locationType: "kab_kota",
  canonicalName: "Kota Administrasi Jakarta Selatan",
  provinceName: "DKI Jakarta",
  kabKotaCode: "3174",
  bpsCode: "3174",
  aliases: [
    { alias: "Jakarta Selatan", sourceSystem: "antero", confidenceScore: 1 },
    { alias: "Kota Adm. Jakarta Selatan", sourceSystem: "abc-talk", confidenceScore: 0.95 },
    { alias: "Jaksel", sourceSystem: "cms", confidenceScore: 0.9 },
  ],
};

describe("LocationMatcher", () => {
  it("matches by exact kab/kota code", () => {
    const matcher = new LocationMatcher();
    matcher.register(JAKSEL);
    const result = matcher.match({
      sourceSystem: "antero",
      sourcePk: "city-1",
      name: "anything",
      kabKotaCode: "3174",
    });
    assert.equal(result.matchMethod, "exact_code");
    assert.equal(result.canonical?.locationId, "LOC-3174");
    assert.equal(result.confidenceScore, 1);
  });

  it("matches CMS alias Jaksel", () => {
    const matcher = new LocationMatcher();
    matcher.register(JAKSEL);
    const result = matcher.match({
      sourceSystem: "cms",
      sourcePk: "area-12",
      name: "Jaksel",
    });
    assert.equal(result.matchMethod, "alias");
    assert.equal(result.canonical?.locationId, "LOC-3174");
  });

  it("matches ABC Talk normalized destination name", () => {
    const matcher = new LocationMatcher();
    matcher.register(JAKSEL);
    const result = matcher.match({
      sourceSystem: "abc-talk",
      sourcePk: "lr-1",
      name: "Kota Adm. Jakarta Selatan",
      provinceName: "DKI Jakarta",
    });
    assert.equal(result.matchMethod, "alias");
    assert.ok(result.confidenceScore >= 0.9);
  });

  it("flags unmatched locations for manual review", () => {
    const matcher = new LocationMatcher();
    matcher.register(JAKSEL);
    const result = matcher.match({
      sourceSystem: "antero",
      sourcePk: "city-x",
      name: "Unknown City",
    });
    assert.equal(result.matchMethod, "unmatched");
    assert.ok(matcher.needsManualReview(result));
  });
});
