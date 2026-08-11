import { describe, expect, it } from "vitest";

import { AgentError } from "../agent-error.js";
import type {
  ModelDraftOutput,
  SpotFeedbackRequestInput,
} from "../contracts.js";
import { taihemenBronzeLionsFixture } from "../fixtures/taihemen-bronze-lions.js";
import { MockProvider } from "../providers/mock-provider.js";
import { runSpotFeedback } from "../run-agent.js";

const agentOptions = { timeoutMs: 100 } as const;

function createProvider(response: unknown, delayMs = 0): MockProvider {
  return new MockProvider({
    response,
    delayMs,
    name: "mock-provider",
  });
}

const validDraft: ModelDraftOutput = {
  scene: "spot_feedback",
  speechText: "我注意到你发现了两只铜狮脚下不一样。要不要再看一眼？",
  evidenceRefs: ["submission:dev:choice:001"],
  factRefs: ["fact:fc:taihemen:bronze-lions:objects@dev-v1"],
  nextMove: "invite",
  memoryCandidate: null,
  safety: { level: "none", code: "none" },
};

describe("runSpotFeedback", () => {
  it("accepts a valid evidence-grounded response", async () => {
    const provider = createProvider(validDraft);

    const result = await runSpotFeedback(
      taihemenBronzeLionsFixture,
      provider,
      agentOptions,
    );

    expect(result.evidenceRefs).toEqual(["submission:dev:choice:001"]);
    expect(result.factRefs).toEqual([
      "fact:fc:taihemen:bronze-lions:objects@dev-v1",
    ]);
    expect(provider.calls).toHaveLength(1);
  });

  it("exposes an error when the model references unknown evidence", async () => {
    const provider = createProvider({
      ...validDraft,
      evidenceRefs: ["submission:invented"],
    });

    await expect(
      runSpotFeedback(taihemenBronzeLionsFixture, provider, agentOptions),
    ).rejects.toMatchObject({ code: "MISSING_REFERENCE" });
  });

  it("exposes an error when the model uses a prohibited personality claim", async () => {
    const provider = createProvider({
      ...validDraft,
      speechText: "你就是最勇敢的孩子。",
    });

    await expect(
      runSpotFeedback(taihemenBronzeLionsFixture, provider, agentOptions),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });

  it("does not pass a low-confidence transcript to the model", async () => {
    const provider = createProvider(validDraft);
    const request: SpotFeedbackRequestInput = {
      ...taihemenBronzeLionsFixture,
      requestId: "dev-request:low-confidence:001",
      evidence: [
        {
          id: "submission:dev:asr:low-confidence",
          type: "verified_transcript",
          verification: "verified",
          value: "也许识别错了的儿童原话",
          confidence: 0.4,
        },
      ],
    };

    await expect(
      runSpotFeedback(request, provider, agentOptions),
    ).rejects.toMatchObject({ code: "NO_USABLE_EVIDENCE" });
    expect(provider.calls).toHaveLength(0);
  });

  it("short-circuits to deterministic safety guidance", async () => {
    const provider = createProvider(validDraft);
    const request: SpotFeedbackRequestInput = {
      ...taihemenBronzeLionsFixture,
      requestId: "dev-request:safety:001",
      evidence: [
        {
          id: "submission:dev:safety:001",
          type: "verified_transcript",
          verification: "verified",
          value: "我找不到妈妈了",
          confidence: 0.99,
        },
      ],
    };

    const result = await runSpotFeedback(request, provider, agentOptions);

    expect(result.providerName).toBe("deterministic-policy");
    expect(result.nextMove).toBe("safety_handoff");
    expect(result.safety).toEqual({
      level: "critical",
      code: "stop_and_find_adult",
    });
    expect(provider.calls).toHaveLength(0);
  });

  it("offers another input method instead of escalating private information", async () => {
    const provider = createProvider(validDraft);
    const request: SpotFeedbackRequestInput = {
      ...taihemenBronzeLionsFixture,
      requestId: "dev-request:privacy:001",
      evidence: [
        {
          id: "submission:dev:privacy:001",
          type: "verified_transcript",
          verification: "verified",
          value: "我的电话号码是……",
          confidence: 0.99,
        },
      ],
    };

    const result = await runSpotFeedback(request, provider, agentOptions);

    expect(result.nextMove).toBe("offer_choice");
    expect(result.safety.code).toBe("privacy_input");
    expect(provider.calls).toHaveLength(0);
  });

  it("lets a tired child end without an emergency handoff", async () => {
    const provider = createProvider(validDraft);
    const request: SpotFeedbackRequestInput = {
      ...taihemenBronzeLionsFixture,
      requestId: "dev-request:distress:001",
      evidence: [
        {
          id: "submission:dev:distress:001",
          type: "verified_transcript",
          verification: "verified",
          value: "我累了，不想继续",
          confidence: 0.99,
        },
      ],
    };

    const result = await runSpotFeedback(request, provider, agentOptions);

    expect(result.nextMove).toBe("end");
    expect(result.safety.code).toBe("emotional_distress");
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects a memory candidate based only on an uploaded photo", async () => {
    const provider = createProvider({
      ...validDraft,
      evidenceRefs: ["submission:dev:photo:001"],
      memoryCandidate: {
        text: "孩子喜欢铜狮。",
        evidenceRefs: ["submission:dev:photo:001"],
      },
    });
    const request: SpotFeedbackRequestInput = {
      ...taihemenBronzeLionsFixture,
      requestId: "dev-request:photo-memory:001",
      evidence: [
        {
          id: "submission:dev:photo:001",
          type: "photo_uploaded",
          verification: "uploaded_only",
        },
      ],
    };

    await expect(
      runSpotFeedback(request, provider, agentOptions),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });

  it("exposes an error when the provider times out", async () => {
    const provider = createProvider(validDraft, 50);

    await expect(
      runSpotFeedback(taihemenBronzeLionsFixture, provider, { timeoutMs: 5 }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AgentError>>({ code: "PROVIDER_TIMEOUT" }),
    );
  });
});
