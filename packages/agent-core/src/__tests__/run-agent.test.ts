import { describe, expect, it } from "vitest";

import type {
  ModelDraftOutput,
  SpotFeedbackRequestInput,
} from "../contracts.js";
import { taihemenBronzeLionsFixture } from "../fixtures/taihemen-bronze-lions.js";
import { MockProvider } from "../providers/mock-provider.js";
import { runSpotFeedback } from "../run-agent.js";

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
    const provider = new MockProvider({ response: validDraft });

    const result = await runSpotFeedback(
      taihemenBronzeLionsFixture,
      provider,
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.evidenceRefs).toEqual(["submission:dev:choice:001"]);
    expect(result.factRefs).toEqual([
      "fact:fc:taihemen:bronze-lions:objects@dev-v1",
    ]);
    expect(provider.calls).toHaveLength(1);
  });

  it("falls back when the model references unknown evidence", async () => {
    const provider = new MockProvider({
      response: { ...validDraft, evidenceRefs: ["submission:invented"] },
    });

    const result = await runSpotFeedback(
      taihemenBronzeLionsFixture,
      provider,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("missing_reference");
  });

  it("falls back when the model uses a prohibited personality claim", async () => {
    const provider = new MockProvider({
      response: { ...validDraft, speechText: "你就是最勇敢的孩子。" },
    });

    const result = await runSpotFeedback(
      taihemenBronzeLionsFixture,
      provider,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("policy_violation");
  });

  it("does not pass a low-confidence transcript to the model", async () => {
    const provider = new MockProvider({ response: validDraft });
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

    const result = await runSpotFeedback(request, provider);

    expect(result.fallbackReason).toBe("no_usable_evidence");
    expect(provider.calls).toHaveLength(0);
  });

  it("short-circuits to deterministic safety guidance", async () => {
    const provider = new MockProvider({ response: validDraft });
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

    const result = await runSpotFeedback(request, provider);

    expect(result.providerName).toBe("deterministic-policy");
    expect(result.nextMove).toBe("safety_handoff");
    expect(result.safety).toEqual({
      level: "critical",
      code: "stop_and_find_adult",
    });
    expect(provider.calls).toHaveLength(0);
  });

  it("offers another input method instead of escalating private information", async () => {
    const provider = new MockProvider({ response: validDraft });
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

    const result = await runSpotFeedback(request, provider);

    expect(result.nextMove).toBe("offer_choice");
    expect(result.safety.code).toBe("privacy_input");
    expect(provider.calls).toHaveLength(0);
  });

  it("lets a tired child end without an emergency handoff", async () => {
    const provider = new MockProvider({ response: validDraft });
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

    const result = await runSpotFeedback(request, provider);

    expect(result.nextMove).toBe("end");
    expect(result.safety.code).toBe("emotional_distress");
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects a memory candidate based only on an uploaded photo", async () => {
    const provider = new MockProvider({
      response: {
        ...validDraft,
        evidenceRefs: ["submission:dev:photo:001"],
        memoryCandidate: {
          text: "孩子喜欢铜狮。",
          evidenceRefs: ["submission:dev:photo:001"],
        },
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

    const result = await runSpotFeedback(request, provider);

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("policy_violation");
  });

  it("falls back when the provider times out", async () => {
    const provider = new MockProvider({ response: validDraft, delayMs: 50 });

    const result = await runSpotFeedback(
      taihemenBronzeLionsFixture,
      provider,
      { timeoutMs: 5 },
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("provider_timeout");
  });
});
