/** Spec: security-governance/audit/audit-log.ts */
export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  subjectId: string;
  resource: string;
  outcome: "allow" | "deny";
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  append(entry: Omit<AuditEntry, "id" | "at">): AuditEntry {
    const row: AuditEntry = {
      id: `audit-${this.entries.length + 1}`,
      at: new Date().toISOString(),
      ...entry,
    };
    this.entries.push(row);
    return row;
  }

  list(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }
}
