export type OntologyId = string & { readonly __brand: "OntologyId" };
export type EntityId = string & { readonly __brand: "EntityId" };
export type SessionId = string & { readonly __brand: "SessionId" };

export interface DaemonSession {
  sessionId: SessionId;
  subjectId: string;
  tenantId: string;
  roles: string[];
  issuedAt: string;
}

export interface CommandEnvelope<TPayload = unknown> {
  commandId: string;
  type: string;
  session: DaemonSession;
  payload: TPayload;
  idempotencyKey?: string;
}

export type PolicyEffect = "allow" | "deny";

export interface PolicyDecision {
  effect: PolicyEffect;
  reason?: string;
  obligations?: string[];
}

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  POLICY_DENIED: "POLICY_DENIED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  UPSTREAM: "UPSTREAM",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class DaemonError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "DaemonError";
  }
}

export function ontologyId(id: string): OntologyId {
  return id as OntologyId;
}

export function entityId(id: string): EntityId {
  return id as EntityId;
}
