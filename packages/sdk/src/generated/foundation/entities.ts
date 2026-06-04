/** Generated from configs/ontology/packs — do not edit by hand. */

export const ONTOLOGY_ID = "foundation" as const;

export type FoundationEntityType =
  "Case" |
  "Document" |
  "Event" |
  "Link" |
  "Organization" |
  "Party";

export interface CaseProperties {
  openedAt?: string;
  status?: string;
  title: string;
}

export interface DocumentProperties {
  mimeType?: string;
  title: string;
  uri?: string;
}

export interface EventProperties {
  eventType: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

export interface LinkProperties {
  fromEntityId: string;
  linkType: string;
  toEntityId: string;
}

export interface OrganizationProperties {
  jurisdiction?: string;
  legalName: string;
  sector?: string;
}

export interface PartyProperties {
  displayName: string;
  identifiers?: Record<string, unknown>;
  partyKind?: string;
}

