/** Spec: external-systems — adapter contract for ERP/CRM/WMS integrations. */
export type AdapterPullRequest = {
  systemId: string;
  resource: string;
  since?: string;
};

export type AdapterRecord = {
  externalId: string;
  properties: Record<string, unknown>;
};

export interface SystemAdapter {
  readonly systemId: string;
  pull(request: AdapterPullRequest): Promise<AdapterRecord[]>;
}

export class InMemorySystemAdapter implements SystemAdapter {
  constructor(
    readonly systemId: string,
    private readonly data: Map<string, AdapterRecord[]> = new Map(),
  ) {}

  seed(resource: string, records: AdapterRecord[]): void {
    this.data.set(resource, records);
  }

  async pull(request: AdapterPullRequest): Promise<AdapterRecord[]> {
    return this.data.get(request.resource) ?? [];
  }
}
