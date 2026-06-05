import {
  buildCoverageId,
  buildLocationId,
  normalizeLocationName,
} from "./location-normalizer.js";

export type SourceLocationRecord = {
  sourceSystem: string;
  sourcePk: string;
  name: string;
  provinceName?: string;
  kabKotaCode?: string;
  bpsCode?: string;
};

export type CanonicalLocation = {
  locationId: string;
  locationType: "provinsi" | "kab_kota" | "kecamatan" | "kelurahan" | "alias";
  canonicalName: string;
  provinceName?: string;
  provinceCode?: string;
  kabKotaCode?: string;
  bpsCode?: string;
  aliases: Array<{ alias: string; sourceSystem: string; confidenceScore: number }>;
};

export type LocationMatchResult = {
  canonical: CanonicalLocation | null;
  confidenceScore: number;
  matchMethod: "exact_code" | "normalized_name" | "alias" | "unmatched";
  conflict?: {
    fieldName: string;
    sourceA: string;
    valueA: string;
    sourceB: string;
    valueB: string;
    severity: "low" | "medium" | "high" | "critical";
  };
};

export type ServiceAreaCoverageInput = {
  locationId: string;
  coverageStatus: "active" | "inactive" | "pending" | "suspended";
  servingRo?: string;
  servingAgent?: string;
  slaHours?: number;
  is3t?: boolean;
  sourceSystem?: string;
};

export type ServiceAreaCoverage = ServiceAreaCoverageInput & {
  coverageId: string;
};

const MANUAL_REVIEW_THRESHOLD = 0.9;

export class LocationMatcher {
  private readonly byCode = new Map<string, CanonicalLocation>();
  private readonly byNormalizedName = new Map<string, CanonicalLocation[]>();
  private readonly byAlias = new Map<string, CanonicalLocation>();

  register(location: CanonicalLocation): void {
    this.byCode.set(location.locationId, location);
    const norm = normalizeLocationName(location.canonicalName);
    const bucket = this.byNormalizedName.get(norm) ?? [];
    bucket.push(location);
    this.byNormalizedName.set(norm, bucket);
    for (const a of location.aliases) {
      const aliasNorm = normalizeLocationName(a.alias);
      const existing = this.byAlias.get(aliasNorm);
      if (existing && existing.locationId !== location.locationId) {
        continue;
      }
      this.byAlias.set(aliasNorm, location);
    }
  }

  match(record: SourceLocationRecord): LocationMatchResult {
    if (record.kabKotaCode) {
      const locationId = buildLocationId(record.kabKotaCode);
      const hit = this.byCode.get(locationId);
      if (hit) {
        return {
          canonical: hit,
          confidenceScore: 1,
          matchMethod: "exact_code",
        };
      }
    }

    const normalized = normalizeLocationName(record.name);
    const aliasHit = this.byAlias.get(normalized);
    if (aliasHit) {
      return {
        canonical: aliasHit,
        confidenceScore: 0.95,
        matchMethod: "alias",
      };
    }

    const nameHits = this.byNormalizedName.get(normalized) ?? [];
    if (nameHits.length === 1) {
      const hit = nameHits[0]!;
      const provinceOk =
        !record.provinceName ||
        !hit.provinceName ||
        normalizeLocationName(record.provinceName) ===
          normalizeLocationName(hit.provinceName);
      return {
        canonical: hit,
        confidenceScore: provinceOk ? 0.92 : 0.75,
        matchMethod: "normalized_name",
        conflict: provinceOk
          ? undefined
          : {
              fieldName: "province_name",
              sourceA: record.sourceSystem,
              valueA: record.provinceName ?? "",
              sourceB: "canonical",
              valueB: hit.provinceName ?? "",
              severity: "medium",
            },
      };
    }

    if (nameHits.length > 1) {
      return {
        canonical: null,
        confidenceScore: 0.5,
        matchMethod: "normalized_name",
        conflict: {
          fieldName: "canonical_name",
          sourceA: record.sourceSystem,
          valueA: record.name,
          sourceB: "canonical",
          valueB: nameHits.map((h) => h.canonicalName).join(" | "),
          severity: "high",
        },
      };
    }

    return {
      canonical: null,
      confidenceScore: 0,
      matchMethod: "unmatched",
    };
  }

  needsManualReview(result: LocationMatchResult): boolean {
    return (
      result.confidenceScore < MANUAL_REVIEW_THRESHOLD ||
      result.conflict !== undefined ||
      result.canonical === null
    );
  }

  buildServiceAreaCoverage(input: ServiceAreaCoverageInput): ServiceAreaCoverage {
    return {
      ...input,
      coverageId: buildCoverageId(input.locationId),
      sourceSystem: input.sourceSystem ?? "antero",
    };
  }
}
