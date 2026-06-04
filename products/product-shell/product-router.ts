import type { WorkflowStep } from "@daemon/action-runtime/workflow-engine/workflow-orchestrator.js";
import type { DaemonSession, OntologyId } from "@daemon/platform-types";
import { ontologyId, type SessionId } from "@daemon/platform-types";
import { AnalyticsWorkflows } from "../analytics-workflows/analytics-workflows.js";
import { GptOrchestrator, type ChatTurn } from "../customer-gpt/gpt-orchestrator.js";
import { DashboardDataService } from "../internal-applications/dashboard-data.js";
import { AdminOperations } from "../admin-console/admin-operations.js";
import {
  AutomationsWorkflows,
  type AutomationLoopInput,
} from "../automations/automations-workflows.js";
import { DataHealthProduct } from "../data-health/data-health-product.js";
import {
  PipelineRunner,
  type PipelineDag,
} from "../pipeline-builder/pipeline-runner.js";
import { EvalRunner, type EvalSuite } from "../aip-evals/eval-runner.js";
import { ProductRuntime } from "../shared/product-runtime.js";

export type ProductId =
  | "analytics-workflows"
  | "automations"
  | "customer-gpt"
  | "internal-applications"
  | "admin-console"
  | "data-health"
  | "pipeline-builder"
  | "aip-evals";

export type ProductOperation =
  | { product: "analytics-workflows"; op: "search"; query: string; ontologyId?: OntologyId }
  | { product: "analytics-workflows"; op: "dashboard"; ontologyId: OntologyId }
  | { product: "customer-gpt"; op: "chat"; turns: ChatTurn[] }
  | { product: "internal-applications"; op: "snapshot"; ontologyId: OntologyId }
  | { product: "admin-console"; op: "list"; ontologyId: OntologyId }
  | {
      product: "automations";
      op: "run";
      session: DaemonSession;
      steps: WorkflowStep[];
      loop?: AutomationLoopInput;
    }
  | {
      product: "automations";
      op: "evaluate";
      patch: Record<string, unknown>;
      approvals: string[];
    }
  | {
      product: "automations";
      op: "approve";
      session: DaemonSession;
      loop: AutomationLoopInput;
      approvals: string[];
    }
  | { product: "automations"; op: "noop" }
  | { product: "data-health"; op: "snapshot" }
  | {
      product: "pipeline-builder";
      op: "run";
      pipelineId: string;
      dag: PipelineDag;
      tenantId?: string;
      domainId?: string;
    }
  | { product: "aip-evals"; op: "run"; suite: EvalSuite };

function routerDevSession(): DaemonSession {
  return {
    sessionId: "sess-router" as SessionId,
    subjectId: "router",
    tenantId: "default",
    roles: ["operator"],
    issuedAt: new Date().toISOString(),
  };
}

/**
 * Single entry point that routes product operations to the correct surface module.
 */
export class ProductRouter {
  private readonly analytics: AnalyticsWorkflows;
  private readonly gpt: GptOrchestrator;
  private readonly internalDashboard: DashboardDataService;
  private readonly admin: AdminOperations;
  private readonly automations: AutomationsWorkflows;
  private readonly dataHealth: DataHealthProduct;
  private readonly pipelines: PipelineRunner;
  private readonly evals: EvalRunner;

  constructor(runtime: ProductRuntime = new ProductRuntime()) {
    this.analytics = new AnalyticsWorkflows(runtime);
    this.gpt = new GptOrchestrator(runtime);
    this.internalDashboard = new DashboardDataService(runtime);
    this.admin = new AdminOperations(runtime);
    this.automations = new AutomationsWorkflows(runtime);
    this.dataHealth = new DataHealthProduct(runtime);
    this.pipelines = new PipelineRunner(runtime);
    this.evals = new EvalRunner(runtime);
  }

  async dispatch(operation: ProductOperation): Promise<unknown> {
    switch (operation.product) {
      case "analytics-workflows":
        if (operation.op === "search") {
          return this.analytics.searchAndReport({
            query: operation.query,
            ontologyId: operation.ontologyId,
            reportTitle: "search",
          });
        }
        return this.analytics.buildDashboard(operation.ontologyId);
      case "customer-gpt":
        return this.gpt.converse({ turns: operation.turns });
      case "internal-applications":
        return this.internalDashboard.snapshot(operation.ontologyId);
      case "admin-console":
        return this.admin.list(operation.ontologyId);
      case "automations":
        if (operation.op === "run") {
          return this.automations.run(operation.session, operation.steps, operation.loop);
        }
        if (operation.op === "evaluate") {
          return this.automations.evaluateApproval(operation.patch, operation.approvals);
        }
        if (operation.op === "approve") {
          return this.automations.approve(
            operation.session,
            operation.loop,
            operation.approvals,
          );
        }
        return this.automations.run(routerDevSession(), [{ id: "noop", action: "ping" }]);
      case "data-health":
        return this.dataHealth.snapshot();
      case "pipeline-builder":
        return this.pipelines.run(operation.pipelineId, operation.dag, {
          tenantId: operation.tenantId ?? "default",
          domainId: operation.domainId ?? "foundation",
        });
      case "aip-evals":
        return this.evals.run(operation.suite);
      default: {
        const _exhaustive: never = operation;
        return _exhaustive;
      }
    }
  }

  /** Convenience for callers that only have ontology id strings. */
  async dispatchOntology(
    product: ProductId,
    op: string,
    ontologyIdStr: string,
    extra?: {
      query?: string;
      turns?: ChatTurn[];
      session?: DaemonSession;
      steps?: WorkflowStep[];
      loop?: AutomationLoopInput;
      patch?: Record<string, unknown>;
      approvals?: string[];
    },
  ): Promise<unknown> {
    const ont = ontologyId(ontologyIdStr);
    if (product === "analytics-workflows" && op === "search") {
      return this.dispatch({
        product,
        op: "search",
        query: extra?.query ?? "",
        ontologyId: ont,
      });
    }
    if (product === "analytics-workflows" && op === "dashboard") {
      return this.dispatch({ product, op: "dashboard", ontologyId: ont });
    }
    if (product === "customer-gpt" && op === "chat") {
      return this.dispatch({
        product,
        op: "chat",
        turns: extra?.turns ?? [{ role: "user", content: "hello" }],
      });
    }
    if (product === "internal-applications" && op === "snapshot") {
      return this.dispatch({ product, op: "snapshot", ontologyId: ont });
    }
    if (product === "admin-console" && op === "list") {
      return this.dispatch({ product, op: "list", ontologyId: ont });
    }
    if (product === "automations" && op === "noop") {
      return this.dispatch({ product, op: "noop" });
    }
    if (product === "automations" && op === "run" && extra?.session && extra.steps) {
      return this.dispatch({
        product: "automations",
        op: "run",
        session: extra.session,
        steps: extra.steps,
        loop: extra.loop,
      });
    }
    if (product === "automations" && op === "evaluate" && extra?.patch) {
      return this.dispatch({
        product: "automations",
        op: "evaluate",
        patch: extra.patch,
        approvals: extra.approvals ?? [],
      });
    }
    if (
      product === "automations" &&
      op === "approve" &&
      extra?.session &&
      extra.loop
    ) {
      return this.dispatch({
        product: "automations",
        op: "approve",
        session: extra.session,
        loop: extra.loop,
        approvals: extra.approvals ?? [],
      });
    }
    if (product === "data-health" && op === "snapshot") {
      return this.dispatch({ product, op: "snapshot" });
    }
    if (product === "pipeline-builder" && op === "run" && extra?.patch) {
      const dag = extra.patch.dag as PipelineDag | undefined;
      if (dag) {
        return this.dispatch({
          product,
          op: "run",
          pipelineId: String(extra.patch.pipelineId ?? "default"),
          dag,
          tenantId: extra.patch.tenantId as string | undefined,
          domainId: extra.patch.domainId as string | undefined,
        });
      }
    }
    if (product === "aip-evals" && op === "run" && extra?.patch?.suite) {
      return this.dispatch({
        product,
        op: "run",
        suite: extra.patch.suite as EvalSuite,
      });
    }
    throw new Error(`unknown operation ${product}/${op}`);
  }
}
