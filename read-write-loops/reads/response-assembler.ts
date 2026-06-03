import type { EntityRecord } from "@daemon/ontology";

export interface AssembledResponse {
  entityId: string;
  ontologyId: string;
  version: number;
  properties: Record<string, unknown>;
  updatedAt: string;
  partial: boolean;
}

/**
 * Assembles a registry record into an outbound read response, applying an
 * optional field projection. When a projection is applied the response is
 * marked partial so callers can distinguish a full read from a filtered one.
 */
export class ResponseAssembler {
  assemble(record: EntityRecord, fields?: string[] | null): AssembledResponse {
    let properties: Record<string, unknown>;
    let partial: boolean;

    if (fields && fields.length > 0) {
      properties = {};
      for (const field of fields) {
        if (field in record.properties) {
          properties[field] = record.properties[field];
        }
      }
      partial = true;
    } else {
      properties = { ...record.properties };
      partial = false;
    }

    return {
      entityId: record.entityId,
      ontologyId: record.ontologyId,
      version: record.version,
      properties,
      updatedAt: record.updatedAt,
      partial,
    };
  }
}
