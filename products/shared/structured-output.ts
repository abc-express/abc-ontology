import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { z } from "zod";

export type StructuredOutputOptions = {
  name?: string;
  strict?: boolean;
  method?: "functionCalling" | "jsonMode" | "jsonSchema";
};

/**
 * Wrap a chat model with Zod structured output via LangChain withStructuredOutput.
 */
export function withZodSchema<T extends z.ZodType>(
  model: BaseChatModel,
  schema: T,
  options: StructuredOutputOptions = {},
) {
  const method = options.method ?? "functionCalling";
  return model.withStructuredOutput(schema, {
    name: options.name,
    strict: options.strict,
    method,
  });
}
