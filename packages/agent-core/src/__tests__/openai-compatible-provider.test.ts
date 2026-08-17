import { describe, expect, it } from "vitest";

import { OpenAICompatibleProvider } from "../providers/openai-compatible-provider.js";

function response(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

const request = {
  promptVersion: "test.prompt.v1",
  systemPrompt: "Return JSON.",
  context: {
    scene: "companion_reply" as const,
    householdId: "household:test:001",
    childProfileId: "child:test:001",
    characterInstanceId: "character:test:001",
    childAgeBand: "6_7" as const,
    locale: "zh-CN",
    input: {
      evidenceId: "event:test:001",
      type: "choice" as const,
      text: "我看到了铜狮。",
    },
    facts: [],
    memories: [],
    personality: {
      personalityVersion: 1,
      baselineArchetype: "yuanlong:curious-gentle-v1",
      traits: [{ traitId: "exploration" as const, value: 0.8 }],
      mood: { valence: 0.7, arousal: 0.4, curiosity: 0.8, fatigue: 0.1 },
      relationship: { familiarity: 0.2, trust: 0.3, sharedExperienceCount: 1 },
      scene: { quietHours: false, initiative: 0.5 },
    },
  },
};

describe("OpenAICompatibleProvider", () => {
  it("sends the system prompt and parses the JSON content", async () => {
    let receivedBody = "";
    const provider = new OpenAICompatibleProvider({
      name: "test-openai-compatible",
      endpoint: "https://model.test/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      fetchImpl: async (_input, init) => {
        receivedBody = String(init?.body);
        return response(
          JSON.stringify({
            choices: [{ message: { content: '{"answer":"ok"}' } }],
          }),
        );
      },
    });

    await expect(
      provider.generate(request, { signal: new AbortController().signal }),
    ).resolves.toEqual({ answer: "ok" });
    expect(receivedBody).toContain("test.prompt.v1");
    expect(receivedBody).toContain("Return JSON.");
  });

  it("exposes a non-2xx provider response", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test-provider",
      endpoint: "https://model.test/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      fetchImpl: async () => response("upstream down", 503),
    });

    await expect(
      provider.generate(request, { signal: new AbortController().signal }),
    ).rejects.toThrow("MODEL_HTTP_503:upstream down");
  });

  it("exposes a non-JSON model content response", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "test-provider",
      endpoint: "https://model.test/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      fetchImpl: async () =>
        response(
          JSON.stringify({
            choices: [{ message: { content: "not json" } }],
          }),
        ),
    });

    await expect(
      provider.generate(request, { signal: new AbortController().signal }),
    ).rejects.toThrow("MODEL_CONTENT_NOT_JSON");
  });
});
