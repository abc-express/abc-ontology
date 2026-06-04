import { useMemo, useState } from "react";
import type { EvalSuiteInput, PipelineRunRequest } from "@daemon/sdk";
import { createDaemonClient } from "./daemon-client.js";

type Tab = "connect" | "pipeline" | "ontology" | "lakehouse" | "aip";

const DEFAULT_PIPELINE = `{
  "nodes": [
    { "id": "src", "type": "source", "config": { "sourceId": "gw-flow" } },
    { "id": "map", "type": "map", "config": {} },
    { "id": "out", "type": "deliver-lakehouse", "config": {} }
  ]
}`;

const DEFAULT_EVAL = `{
  "id": "smoke-suite",
  "cases": [
    { "id": "q1", "question": "How many entities?", "expectContains": ["entity"] }
  ]
}`;

export function App() {
  const client = useMemo(() => createDaemonClient(), []);
  const [tab, setTab] = useState<Tab>("connect");
  const [out, setOut] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(true);
    setErr(null);
    try {
      const result = await fn();
      setOut(`${label}\n${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setOut("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>DSDK Console</h1>
        <p>
          Enterprise shell over <code>@daemon/sdk</code> — not a vendor API clone.
          Point <code>VITE_DAEMON_API_URL</code> at the gateway (or use /api proxy).
        </p>
      </header>
      <nav>
        {(
          [
            ["connect", "Connect"],
            ["pipeline", "Pipeline"],
            ["ontology", "Ontology"],
            ["lakehouse", "Lakehouse"],
            ["aip", "AIP"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="panel">
        {tab === "connect" && (
          <>
            <h2>Connect</h2>
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => run("health", () => client.health())}
              >
                Health
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => run("schedules", () => client.listIngestSchedules())}
              >
                List schedules
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run("data-health", () => client.dataHealthSummary())
                }
              >
                Data health
              </button>
            </div>
          </>
        )}

        {tab === "pipeline" && (
          <>
            <h2>Pipeline builder</h2>
            <textarea id="pipeline-dag" defaultValue={DEFAULT_PIPELINE} />
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => {
                  const raw = (
                    document.getElementById("pipeline-dag") as HTMLTextAreaElement
                  ).value;
                  const dag = JSON.parse(raw) as PipelineRunRequest["dag"];
                  return run("pipeline-run", () =>
                    client.runPipeline("console-demo", { dag }),
                  );
                }}
              >
                Run pipeline
              </button>
            </div>
          </>
        )}

        {tab === "ontology" && (
          <>
            <h2>Ontology</h2>
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() =>
                  run("pack-resolution", () =>
                    client.ontologyPackResolution({ packBranch: "main" }),
                  )
                }
              >
                Pack resolution
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run("search", () => client.search({ q: "Party", limit: 5 }))
                }
              >
                Search
              </button>
            </div>
          </>
        )}

        {tab === "lakehouse" && (
          <>
            <h2>Lakehouse</h2>
            <div className="row">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run("summary", () => client.lakehouseSummary())
                }
              >
                Summary
              </button>
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() =>
                  run("export", () =>
                    client.startLakehouseExport({ limit: 50, format: "jsonl" }),
                  )
                }
              >
                Start export
              </button>
            </div>
          </>
        )}

        {tab === "aip" && (
          <>
            <h2>AIP</h2>
            <div className="row">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run("query-ask", () =>
                    client.queryAsk({ question: "List entity types" }),
                  )
                }
              >
                Query ask
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run("eval-runs", () => client.listEvalRuns(10))
                }
              >
                Eval runs
              </button>
            </div>
            <textarea id="eval-suite" defaultValue={DEFAULT_EVAL} />
            <div className="row">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => {
                  const raw = (
                    document.getElementById("eval-suite") as HTMLTextAreaElement
                  ).value;
                  const suite = JSON.parse(raw) as EvalSuiteInput;
                  return run("eval-run", () => client.runEvals(suite));
                }}
              >
                Run eval suite
              </button>
            </div>
          </>
        )}

        {err && <p className="error">{err}</p>}
        {out && <pre>{out}</pre>}
      </section>
    </div>
  );
}
