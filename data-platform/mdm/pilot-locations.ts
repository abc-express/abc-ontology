import type { CanonicalLocation } from "./location-matcher.js";

/** Seed data for Location / ServiceAreaCoverage MDM pilot (PDF section 6.2). */
export const PILOT_LOCATIONS: CanonicalLocation[] = [
  {
    locationId: "LOC-3174",
    locationType: "kab_kota",
    canonicalName: "Kota Administrasi Jakarta Selatan",
    provinceName: "DKI Jakarta",
    provinceCode: "31",
    kabKotaCode: "3174",
    bpsCode: "3174",
    aliases: [
      { alias: "Jakarta Selatan", sourceSystem: "antero", confidenceScore: 1 },
      { alias: "Kota Adm. Jakarta Selatan", sourceSystem: "abc-talk", confidenceScore: 0.95 },
      { alias: "Jaksel", sourceSystem: "cms", confidenceScore: 0.9 },
    ],
  },
  {
    locationId: "LOC-3171",
    locationType: "kab_kota",
    canonicalName: "Kota Administrasi Jakarta Timur",
    provinceName: "DKI Jakarta",
    provinceCode: "31",
    kabKotaCode: "3171",
    bpsCode: "3171",
    aliases: [
      { alias: "Jakarta Timur", sourceSystem: "antero", confidenceScore: 1 },
      { alias: "Jaktim", sourceSystem: "cms", confidenceScore: 0.9 },
    ],
  },
];
