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

  it("throws when provider has no API key and env has none", () => {
    const origOpenAI = process.env.OPENAI_API_KEY;
    const origToken = process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TOKEN;
    try {
      const provider: Provider = { id: "o1", type: "openai" };
      expect(() => createChatModelFromProvider(provider)).toThrow("API key for this provider is not set");
    } finally {
      if (origOpenAI !== undefined) process.env.OPENAI_API_KEY = origOpenAI;
      if (origToken !== undefined) process.env.OPENAI_TOKEN = origToken;
    }
  });

  it("uses OPENAI_API_KEY from env when provider has no apiKey", () => {
    const orig = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-env-key";
    try {
      const provider: Provider = { id: "o1", type: "openai" };
      const model = createChatModelFromProvider(provider);
      expect(model).toBeDefined();
      expect(model._llmType?.()).toBe("openai");
    } finally {
      if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
      else delete process.env.OPENAI_API_KEY;
    }
  });

  it("throws when provider apiKey is empty and env has none", () => {
    const origOpenAI = process.env.OPENAI_API_KEY;
    const origToken = process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TOKEN;
    try {
      const provider: Provider = { id: "o1", type: "openai", apiKey: "   " };
      expect(() => createChatModelFromProvider(provider)).toThrow("API key for this provider is not set");
    } finally {
      if (origOpenAI !== undefined) process.env.OPENAI_API_KEY = origOpenAI;
      if (origToken !== undefined) process.env.OPENAI_TOKEN = origToken;
    }
  });
});
