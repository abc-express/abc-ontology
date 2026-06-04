/** Generated from configs/governance/action-catalog.yaml — do not edit by hand. */

export interface CatalogAction {
  action: string;
  resource: string;
  effect: string;
}

export const FOUNDATION_ACTIONS: CatalogAction[] = [
  { action: "chat", resource: "customer-gpt", effect: "allow" },
  { action: "ingest", resource: "ingest-job", effect: "allow" },
  { action: "ingest", resource: "ingest-record", effect: "allow" },
  { action: "ingest", resource: "ingest-source", effect: "allow" },
  { action: "query", resource: "analytics", effect: "allow" },
  { action: "query", resource: "ontology-nl", effect: "allow" },
  { action: "query", resource: "ontology-search", effect: "allow" },
  { action: "read", resource: "agent-session", effect: "allow" },
  { action: "read", resource: "entity", effect: "allow" },
  { action: "read", resource: "function-invoke", effect: "allow" },
  { action: "read", resource: "lakehouse", effect: "allow" },
  { action: "write", resource: "entity", effect: "allow" },
];

