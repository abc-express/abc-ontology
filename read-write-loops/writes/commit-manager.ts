export interface CommitEntry {
  writeId: string;
  entityKey: string;
  version: number;
  committedAt: string;
}

/**
 * Tracks an append-only commit log keyed by entity, supporting lookup of the
 * latest committed version and rollback of the most recent commit.
 */
export class CommitManager {
  private readonly log: CommitEntry[] = [];

  commit(entry: Omit<CommitEntry, "committedAt">): CommitEntry {
    const full: CommitEntry = {
      ...entry,
      committedAt: new Date().toISOString(),
    };
    this.log.push(full);
    return full;
  }

  latestVersion(entityKey: string): number | undefined {
    let version: number | undefined;
    for (const entry of this.log) {
      if (entry.entityKey === entityKey) version = entry.version;
    }
    return version;
  }

  history(entityKey: string): CommitEntry[] {
    return this.log.filter((e) => e.entityKey === entityKey);
  }

  rollbackLast(entityKey: string): CommitEntry | undefined {
    for (let i = this.log.length - 1; i >= 0; i--) {
      if (this.log[i].entityKey === entityKey) {
        return this.log.splice(i, 1)[0];
      }
    }
    return undefined;
  }
}
