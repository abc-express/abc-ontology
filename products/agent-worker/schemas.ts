import { z } from "zod";

export const ToolTraceEntrySchema = z.object({
  tool: z.string(),
  input: z.record(z.unknown()).optional(),
  output: z.unknown().optional(),
});

export const AgentWorkerReplySchema = z.object({
  message: z.string(),
  citations: z.array(z.string()).default([]),
  toolTrace: z.array(ToolTraceEntrySchema).default([]),
});

export type AgentWorkerReply = z.infer<typeof AgentWorkerReplySchema>;
export type ToolTraceEntry = z.infer<typeof ToolTraceEntrySchema>;
