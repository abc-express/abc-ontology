import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { entityId, ontologyId } from "@daemon/platform-types";
import { defaultOntology } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

const READ_ONLY_TOOL_NAMES = ["search", "read_entity", "ontology_ask"] as const;

export type ReadOnlyToolName = (typeof READ_ONLY_TOOL_NAMES)[number];

export function isReadOnlyAgentTool(name: string): name is ReadOnlyToolName {
  return (READ_ONLY_TOOL_NAMES as readonly string[]).includes(name);
}

export type OntologyAskFn = (question: string) => Promise<string>;

export type DaemonToolsOptions = {
  ontologyAsk?: OntologyAskFn;
};

export function createDaemonReadTools(
  runtime: ProductRuntime,
  options: DaemonToolsOptions = {},
) {
  const scope = runtime.scope;
  if (!scope) {
    throw new Error("ProductRuntime.scope is required for agent tools");
  }

  const searchTool = tool(
    async ({ query, limit, ontologyId: ontOpt }) => {
      runtime.assertAllowed("query", "ontology-search");
      if (!runtime.search) {
        return { hits: [], message: "search not configured" };
      }
      const hits = await runtime.search.search(scope, {
        query,
        limit: limit ?? 8,
        ontologyId: ontOpt ? ontologyId(ontOpt) : defaultOntology(),
      });
      return { hits };
    },
    {
      name: "search",
      description:
        "Hybrid ontology search for entities matching a natural-language query.",
      schema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().int().min(1).max(25).optional(),
        ontologyId: z.string().optional(),
      }),
    },
  );

  const readEntityTool = tool(
    async ({ entityId: eid, ontologyId: ont }) => {
      runtime.assertAllowed("read", "entity");
      const record = runtime.store.get(
        scope,
        ontologyId(ont),
        entityId(eid),
      );
      return { entity: record ?? null };
    },
    {
      name: "read_entity",
      description: "Load a single ontology entity by id.",
      schema: z.object({
        entityId: z.string(),
        ontologyId: z.string().default("foundation"),
      }),
    },
  );

  const ontologyAskTool = tool(
    async ({ question }) => {
      runtime.assertAllowed("query", "ontology-nl");
      if (!options.ontologyAsk) {
        return {
          answer:
            "Natural-language graph query is not available in this environment.",
        };
      }
      const answer = await options.ontologyAsk(question);
      return { answer };
    },
    {
      name: "ontology_ask",
      description:
        "Ask a natural-language question against the ontology graph (read-only).",
      schema: z.object({
        question: z.string(),
      }),
    },
  );

  return [searchTool, readEntityTool, ontologyAskTool];
}
