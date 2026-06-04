const FORBIDDEN_KEYWORDS =
  /\b(CREATE|MERGE|DELETE|DETACH|SET|DROP|REMOVE|LOAD\s+CSV|CALL\s+dbms|CALL\s+db\.create|FOREACH|APOC\.periodic)\b/i;

const MULTI_STATEMENT = /;[\s\S]*[^\s;]/;

export class CypherValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CypherValidationError";
  }
}

export function validateReadOnlyCypher(cypher: string): void {
  const trimmed = cypher.trim();
  if (!trimmed) {
    throw new CypherValidationError("empty Cypher query");
  }
  if (MULTI_STATEMENT.test(trimmed)) {
    throw new CypherValidationError("multiple Cypher statements are not allowed");
  }
  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    throw new CypherValidationError("write or admin Cypher operations are not allowed");
  }
}

export function assertTenantScopedCypher(cypher: string): void {
  if (!/\$tenantId/.test(cypher) || !/\$domainId/.test(cypher)) {
    throw new CypherValidationError(
      "Cypher must reference $tenantId and $domainId parameters",
    );
  }
}
