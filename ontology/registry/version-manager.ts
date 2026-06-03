import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type VersionBump = "major" | "minor" | "patch";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemVer(value: string): SemVer {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new DaemonError(ErrorCodes.VALIDATION, `invalid semver: ${value}`, 400);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Tracks the version history of a single ontology artifact and computes the
 * next version for a requested bump. History is append-only.
 */
export class VersionManager {
  private readonly history: string[] = [];

  constructor(initial = "0.1.0") {
    this.history.push(formatSemVer(parseSemVer(initial)));
  }

  current(): string {
    return this.history[this.history.length - 1];
  }

  bump(kind: VersionBump): string {
    const v = parseSemVer(this.current());
    const next =
      kind === "major"
        ? { major: v.major + 1, minor: 0, patch: 0 }
        : kind === "minor"
          ? { major: v.major, minor: v.minor + 1, patch: 0 }
          : { major: v.major, minor: v.minor, patch: v.patch + 1 };
    const formatted = formatSemVer(next);
    this.history.push(formatted);
    return formatted;
  }

  versions(): readonly string[] {
    return [...this.history];
  }
}
