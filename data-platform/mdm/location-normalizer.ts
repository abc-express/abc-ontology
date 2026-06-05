/** Normalize location names for Phase-1 exact/normalized matching. */

const ABBREVIATIONS: Record<string, string> = {
  jaksel: "jakarta selatan",
  jakbar: "jakarta barat",
  jakpus: "jakarta pusat",
  jakut: "jakarta utara",
  jaktim: "jakarta timur",
  jakartaselatan: "jakarta selatan",
};

export function normalizeLocationName(raw: string): string {
  let s = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const prefix of ["kota adm", "kota administrasi", "kab", "kabupaten", "kota"]) {
    if (s.startsWith(`${prefix} `)) {
      s = s.slice(prefix.length + 1).trim();
    }
  }

  return ABBREVIATIONS[s] ?? s;
}

export function buildLocationId(kabKotaCode: string): string {
  return `LOC-${kabKotaCode}`;
}

export function buildCoverageId(locationId: string): string {
  return `SAC-${locationId.replace(/^LOC-/, "")}`;
}
