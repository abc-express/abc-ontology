"use client";

import { useCallback, useEffect, useState } from "react";
import { Section, styles } from "@/components/intelligence/ui";
import { daemonFetch, useDaemonAsk, useDaemonSearch } from "@/lib/daemon/hooks";

const ENTITY_TYPES = [
  "Shipment",
  "Manifest",
  "Dispatch",
  "Trip",
  "Order",
  "Account",
  "Lead",
  "Opportunity",
];

export function IntelligenceShell() {
  const [entityType, setEntityType] = useState("Shipment");
  const [entities, setEntities] = useState<
    { entityId: string; properties: Record<string, unknown> }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("Shipment");
  const { search, hits, loading: searchLoading, error: searchError } =
    useDaemonSearch();
  const { ask, answer, loading: askLoading, error: askError } = useDaemonAsk();
  const [askQ, setAskQ] = useState("How many shipments are in the ontology?");
  const [askStream, setAskStream] = useState(false);
  const [gptInput, setGptInput] = useState("");
  const [gptReply, setGptReply] = useState("");
  const [gptError, setGptError] = useState<string | null>(null);
  const [shipmentRef, setShipmentRef] = useState("SHP-ABC-001");
  const [pricingResult, setPricingResult] = useState<object | null>(null);

  const loadEntities = useCallback(async () => {
    setListError(null);
    try {
      const data = await daemonFetch<{
        items: { entityId: string; properties: Record<string, unknown> }[];
      }>(`/api/daemon/entities?entityType=${encodeURIComponent(entityType)}&limit=50`);
      setEntities(data.items ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "List failed");
      setEntities([]);
    }
  }, [entityType]);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    try {
      const data = await daemonFetch<{ properties: Record<string, unknown> }>(
        `/api/daemon/entities/${encodeURIComponent(id)}`,
      );
      setDetail(data.properties ?? data);
    } catch (e) {
      setDetail({ error: e instanceof Error ? e.message : "Read failed" });
    }
  };

  const runGpt = async () => {
    setGptError(null);
    setGptReply("");
    try {
      const data = await daemonFetch<{ reply?: string }>("/api/daemon/gpt/chat", {
        method: "POST",
        body: JSON.stringify({
          turns: [{ role: "user", content: gptInput }],
        }),
      });
      setGptReply(data.reply ?? JSON.stringify(data));
    } catch (e) {
      setGptError(e instanceof Error ? e.message : "GPT failed");
    }
  };

  const runShadowPricing = async () => {
    try {
      const data = await daemonFetch<object>(
        "/api/daemon/shadow-pricing/simulate",
        {
          method: "POST",
          body: JSON.stringify({ shipmentRef }),
        },
      );
      setPricingResult(data);
    } catch (e) {
      setPricingResult({
        error: e instanceof Error ? e.message : "Simulation failed",
      });
    }
  };

  return (
    <div style={styles.page}>
      <h1>Intelligence</h1>
      <p style={{ color: "#64748b", marginTop: 0 }}>
        Read-only DAEMON surface — all calls go through server BFF routes.
      </p>

      <Section title="Entity explorer">
        <label>
          Entity type{" "}
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={styles.input}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="button" style={styles.button} onClick={() => void loadEntities()}>
          Refresh
        </button>
        {listError && <p style={styles.error}>{listError}</p>}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Label</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((row) => (
              <tr key={row.entityId}>
                <td style={styles.td}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#1e40af", cursor: "pointer" }}
                    onClick={() => void loadDetail(row.entityId)}
                  >
                    {row.entityId}
                  </button>
                </td>
                <td style={styles.td}>
                  {String(row.properties.displayName ?? row.properties.externalRef ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedId && detail && (
          <pre style={styles.pre}>{JSON.stringify(detail, null, 2)}</pre>
        )}
      </Section>

      <Section title="Search">
        <input
          style={styles.input}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search query"
        />
        <button
          type="button"
          style={styles.button}
          disabled={searchLoading}
          onClick={() => void search(searchQ)}
        >
          Search
        </button>
        {searchError && <p style={styles.error}>{searchError}</p>}
        <ul>
          {hits.map((h, i) => (
            <li key={h.entityId ?? i}>
              {h.entityId}{" "}
              {h.score != null && (
                <span style={{ color: "#64748b" }}>({h.score.toFixed(2)})</span>
              )}
              {h.snippet && <div style={{ fontSize: "0.85rem" }}>{h.snippet}</div>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ask ontology">
        <textarea
          style={{ ...styles.input, minHeight: 80 }}
          value={askQ}
          onChange={(e) => setAskQ(e.target.value)}
        />
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <input
            type="checkbox"
            checked={askStream}
            onChange={(e) => setAskStream(e.target.checked)}
          />{" "}
          Stream (SSE)
        </label>
        <button
          type="button"
          style={styles.button}
          disabled={askLoading}
          onClick={() => void ask(askQ, askStream)}
        >
          Ask
        </button>
        {askError && <p style={styles.error}>{askError}</p>}
        {answer && <pre style={styles.pre}>{answer}</pre>}
      </Section>

      <Section title="Commercial GPT (analyst key)">
        <textarea
          style={{ ...styles.input, minHeight: 60 }}
          value={gptInput}
          onChange={(e) => setGptInput(e.target.value)}
          placeholder="Ask about commercial logistics data…"
        />
        <button type="button" style={styles.button} onClick={() => void runGpt()}>
          Send
        </button>
        {gptError && <p style={styles.error}>{gptError}</p>}
        {gptReply && <pre style={styles.pre}>{gptReply}</pre>}
      </Section>

      <Section title="Shadow pricing">
        <input
          style={styles.input}
          value={shipmentRef}
          onChange={(e) => setShipmentRef(e.target.value)}
          placeholder="shipmentRef"
        />
        <button type="button" style={styles.button} onClick={() => void runShadowPricing()}>
          Simulate
        </button>
        {pricingResult && (
          <pre style={styles.pre}>{JSON.stringify(pricingResult, null, 2)}</pre>
        )}
      </Section>
    </div>
  );
}
