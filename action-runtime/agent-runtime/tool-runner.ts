/** Spec: action-runtime/agent-runtime/tool-runner.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface ToolSpec<I, O> {
  name: string;
  /** Names of required keys on the input object. */
  required: string[];
  handler: (input: I) => Promise<O> | O;
}

export interface ToolResult<O> {
  tool: string;
  ok: boolean;
  output?: O;
  error?: string;
}

/**
 * Registry and executor for agent tools. Validates that required inputs are
 * present before invoking a tool and normalizes thrown errors into a structured
 * {@link ToolResult} so the agent loop never crashes on a single tool failure.
 */
export class ToolRunner {
  private readonly tools = new Map<string, ToolSpec<Record<string, unknown>, unknown>>();

  register<I extends Record<string, unknown>, O>(spec: ToolSpec<I, O>): void {
    if (this.tools.has(spec.name)) {
      throw new DaemonError(ErrorCodes.CONFLICT, `tool ${spec.name} already registered`, 409);
    }
    this.tools.set(spec.name, spec as ToolSpec<Record<string, unknown>, unknown>);
  }

  async run(name: string, input: Record<string, unknown>): Promise<ToolResult<unknown>> {
    const spec = this.tools.get(name);
    if (!spec) {
      throw new DaemonError(ErrorCodes.NOT_FOUND, `tool ${name} not found`, 404);
    }
    const missing = spec.required.filter((key) => !(key in input));
    if (missing.length > 0) {
      return { tool: name, ok: false, error: `missing inputs: ${missing.join(", ")}` };
    }
    try {
      const output = await spec.handler(input);
      return { tool: name, ok: true, output };
    } catch (err) {
      return { tool: name, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  list(): string[] {
    return [...this.tools.keys()].sort();
  }
}
