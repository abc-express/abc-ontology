import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderConfig,
  createOpenRouterModel,
  parseFallbackModels,
  resolveOpenRouterApiKey,
} from "./openrouter-model.js";

describe("openrouter-model", () => {
  it("resolveOpenRouterApiKey prefers OPENROUTER_API_KEY", () => {
    assert.equal(
      resolveOpenRouterApiKey({
        OPENROUTER_API_KEY: "a",
        DAEMON_OPENROUTER_API_KEY: "b",
      }),
      "a",
    );
  });

  it("buildProviderConfig defaults data_collection to deny", () => {
    const cfg = buildProviderConfig({});
    assert.equal(cfg?.data_collection, "deny");
  });

  it("buildProviderConfig parses provider order CSV", () => {
    const cfg = buildProviderConfig({
      DAEMON_OPENROUTER_PROVIDER_ORDER: "Anthropic, Google",
    });
    assert.deepEqual(cfg?.order, ["Anthropic", "Google"]);
  });

  it("parseFallbackModels splits models list", () => {
    assert.deepEqual(
      parseFallbackModels({ DAEMON_OPENROUTER_MODELS: "a/b,c/d" }),
      ["a/b", "c/d"],
    );
  });

  it("createOpenRouterModel throws without api key", () => {
    assert.throws(() => createOpenRouterModel({}), /OPENROUTER_API_KEY/);
  });

  it("createOpenRouterModel configures route fallback", () => {
    const model = createOpenRouterModel({
      OPENROUTER_API_KEY: "test-key",
      DAEMON_OPENROUTER_ROUTE: "fallback",
      DAEMON_OPENROUTER_MODELS: "openai/gpt-4o-mini",
    });
    assert.equal(model.route, "fallback");
    assert.deepEqual(model.models, ["openai/gpt-4o-mini"]);
    assert.equal(model.provider?.data_collection, "deny");
  });
});
