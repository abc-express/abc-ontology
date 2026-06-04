import type { WriteCommand } from "./command-gateway.js";
import { assertWriteLogicAllowed } from "./write-logic-guard.js";

/**
 * Optional HTTP call to Rust logic-engine sidecar; always applies TS pack rules first.
 */
export async function evaluateWriteWithLogicEngine(
  cmd: WriteCommand,
): Promise<void> {
  assertWriteLogicAllowed(cmd);
  const url = process.env.DAEMON_LOGIC_ENGINE_URL;
  if (!url) return;
  const res = await fetch(`${url.replace(/\/+$/, "")}/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      facts: { ...cmd.patch, entityId: cmd.entityId },
      session: { subjectId: cmd.session.subjectId, roles: cmd.session.roles },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`logic-engine rejected write: ${text}`);
  }
}
