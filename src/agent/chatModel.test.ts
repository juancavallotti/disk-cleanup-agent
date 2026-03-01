import { describe, it, expect } from "vitest";
import { createChatModelFromProvider } from "./chatModel.js";
import type { Provider } from "@/system/types.js";

describe("createChatModelFromProvider", () => {
  it("returns ChatOpenAI for openai provider with default model", () => {
    const provider: Provider = { id: "o1", type: "openai", apiKey: "sk-test" };
    const model = createChatModelFromProvider(provider);
    expect(model).toBeDefined();
    expect(model._llmType?.()).toBe("openai");
  });

  it("uses provider.model override for openai", () => {
    const provider: Provider = { id: "o2", type: "openai", apiKey: "sk-x", model: "gpt-4o" };
    const model = createChatModelFromProvider(provider);
    expect(model).toBeDefined();
  });

  it("returns ChatAnthropic for anthropic provider with default model", () => {
    const provider: Provider = { id: "a1", type: "anthropic", apiKey: "sk-ant-test" };
    const model = createChatModelFromProvider(provider);
    expect(model).toBeDefined();
    expect(model._llmType?.()).toBe("anthropic");
  });

  it("throws for unsupported provider type", () => {
    const provider = { id: "x", type: "other", apiKey: "k" } as unknown as Provider;
    expect(() => createChatModelFromProvider(provider)).toThrow("Unsupported provider type");
  });
});
