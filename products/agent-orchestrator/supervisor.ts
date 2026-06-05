import type { ProductRuntime } from "../shared/product-runtime.js";
import { GptOrchestrator } from "../customer-gpt/gpt-orchestrator.js";
import { runAgentWorker } from "../agent-worker/run-agent-worker.js";
import type { OntologyAskFn } from "../agent-worker/daemon-tools.js";
import { routeIntentHeuristic } from "./router.js";
import type { AgentStreamChunk } from "../agent-worker/run-agent-worker.js";
import type { SupervisorInput, SupervisorReply, RouteIntent } from "./types.js";

export type SupervisorDeps = {
  runtime: ProductRuntime;
  ontologyAsk?: OntologyAskFn;
  askOntology?: (question: string) => Promise<{ answer: string; error?: string }>;
};

function mergeParallel(
  ontology?: string,
  research?: { message: string; citations: string[] },
  rag?: { message: string; citations: string[] },
): SupervisorReply {
  const sections: string[] = [];
  const citations = new Set<string>();
  if (ontology) sections.push(`## Ontology\n${ontology}`);
  if (research) {
    sections.push(`## Research\n${research.message}`);
    for (const c of research.citations) citations.add(c);
  }
  if (rag) {
    sections.push(`## Context\n${rag.message}`);
    for (const c of rag.citations) citations.add(c);
  }
  return {
    message: sections.join("\n\n") || "No results.",
    citations: [...citations],
    route: "parallel",
    partials: {
      ontology,
      rag: rag?.message,
      research: research
        ? { message: research.message, citations: research.citations, toolTrace: [] }
        : undefined,
    },
  };
}

export async function runSupervisor(
  deps: SupervisorDeps,
  input: SupervisorInput,
): Promise<SupervisorReply> {
  deps.runtime.assertAllowed("chat", "agent-worker");
  const route = routeIntentHeuristic(input.message);
  return executeRoute(deps, input, route);
}

async function executeRoute(
  deps: SupervisorDeps,
  input: SupervisorInput,
  route: RouteIntent,
): Promise<SupervisorReply> {
  if (route === "parallel") {
    const [ontology, research, rag] = await Promise.all([
      deps.askOntology
        ? deps.askOntology(input.message).then((r) => r.answer)
        : Promise.resolve(undefined),
      runAgentWorker(deps.runtime, { message: input.message }, {
        ontologyAsk: deps.ontologyAsk,
      }),
      new GptOrchestrator(deps.runtime).converse({
        turns: [{ role: "user", content: input.message }],
      }),
    ]);
    return mergeParallel(
      ontology,
      { message: research.message, citations: research.citations },
      { message: rag.message, citations: rag.citations },
    );
  }
  if (route === "ontology_nl") {
    if (!deps.askOntology) {
      return {
        message: "Ontology NL query is not configured.",
        citations: [],
        route,
      };
    }
    const result = await deps.askOntology(input.message);
    return {
      message: result.answer,
      citations: [],
      route,
      partials: { ontology: result.answer },
    };
  }
  if (route === "tool_research") {
    const research = await runAgentWorker(
      deps.runtime,
      { message: input.message },
      { ontologyAsk: deps.ontologyAsk },
    );
    return {
      message: research.message,
      citations: research.citations,
      route,
      partials: { research },
    };
  }
  const rag = await new GptOrchestrator(deps.runtime).converse({
    turns: [{ role: "user", content: input.message }],
  });
  return {
    message: rag.message,
    citations: rag.citations,
    route,
    partials: { rag: rag.message },
  };
}

export async function* runSupervisorStream(
  deps: SupervisorDeps,
  input: SupervisorInput,
): AsyncGenerator<AgentStreamChunk> {
  deps.runtime.assertAllowed("chat", "agent-worker");
  const route = routeIntentHeuristic(input.message);
  yield { event: "node", data: { type: "node", name: "routeIntent", status: "end", data: { route } } };

  if (route === "tool_research" || route === "parallel") {
    const { runAgentWorkerStream } = await import("../agent-worker/run-agent-worker.js");
    for await (const chunk of runAgentWorkerStream(
      deps.runtime,
      { message: input.message },
      { ontologyAsk: deps.ontologyAsk },
    )) {
      yield chunk;
    }
    if (route === "parallel" && deps.askOntology) {
      const ont = await deps.askOntology(input.message);
      yield {
        event: "node",
        data: { type: "node", name: "ontology_nl", status: "end", data: ont },
      };
    }
    return;
  }

  if (route === "ontology_nl" && deps.askOntology) {
    const result = await deps.askOntology(input.message);
    yield { event: "token", data: { type: "token", text: result.answer } };
    yield { event: "done", data: { message: result.answer, citations: [], route } };
    return;
  }

  const gpt = new GptOrchestrator(deps.runtime);
  const { converseStream } = gpt;
  if (converseStream) {
    for await (const chunk of converseStream({
      turns: [{ role: "user", content: input.message }],
    })) {
      yield chunk;
    }
    return;
  }
  const reply = await gpt.converse({
    turns: [{ role: "user", content: input.message }],
  });
  yield { event: "done", data: { ...reply, route } };
}
