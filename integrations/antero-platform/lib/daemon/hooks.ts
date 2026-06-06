"use client";

import { useCallback, useState } from "react";

export async function daemonFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error ?? text ?? res.statusText);
  }
  return body as T;
}

export function useDaemonSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<
    { entityId?: string; snippet?: string; score?: number }[]
  >([]);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await daemonFetch<{ hits: typeof hits }>(
        `/api/daemon/search?q=${encodeURIComponent(q)}&mode=hybrid&limit=20`,
      );
      setHits(data.hits ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, hits, loading, error };
}

export function useDaemonAsk() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>("");

  const ask = useCallback(async (question: string, stream = false) => {
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      if (!stream) {
        const data = await daemonFetch<Record<string, unknown>>(
          "/api/daemon/query/ask",
          {
            method: "POST",
            body: JSON.stringify({ question }),
          },
        );
        setAnswer(
          String(data.answer ?? data.response ?? JSON.stringify(data, null, 2)),
        );
        return;
      }
      const res = await fetch("/api/daemon/query/ask/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            const piece = dataLine.slice(6).replace(/\\n/g, "\n");
            setAnswer((prev) => prev + piece);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ask failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { ask, answer, loading, error };
}
