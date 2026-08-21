import { describe, expect, it } from "vitest";

import type { CompanionModelOutput } from "../contracts.js";
import {
  companionMemoryFixture,
  companionReplyFixture,
} from "../fixtures/companion-reply.js";
import { InMemoryMemoryStore } from "../memory-store.js";
import { MockProvider } from "../providers/mock-provider.js";
import { runCompanionReply } from "../run-companion.js";

function createSeededMemoryStore(): InMemoryMemoryStore {
  const store = new InMemoryMemoryStore();
  store.write(companionMemoryFixture);
  return store;
}

const options = {
  timeoutMs: 100,
  memoryStore: createSeededMemoryStore(),
  occurredAt: "2026-08-17T10:00:00.000Z",
  createMemoryId: () => "memory:test:001",
} as const;

const validOutput: CompanionModelOutput = {
  scene: "companion_reply",
  speechText: "我记得这段共同经历。你还想继续看看吗？",
  knowledgeStatus: "K0",
  knowledgeRefs: ["fact:fc:taihemen:bronze-lions:objects@dev-v1"],
  observedEvidenceRefs: [],
  memoryRefs: ["memory:dev:bronze-lions:001"],
  primaryMove: "invite",
  emotionState: "reunion",
  memoryProposal: null,
  safety: { level: "S0", code: "none" },
  embodiment: {
    state: "speaking",
    emotionId: "curious",
    intensity: 0.7,
    attentionTarget: "child",
    speechSync: "during",
    hapticPattern: "none",
    sfxId: "curious_ping",
  },
};

function provider(response: unknown): MockProvider {
  return new MockProvider({ response, delayMs: 0, name: "test-provider" });
}

describe("runCompanionReply", () => {
  it("returns a K0 companion response with scoped memory references", async () => {
    const result = await runCompanionReply(
      companionReplyFixture,
      provider(validOutput),
      options,
    );

    expect(result.scene).toBe("companion_reply");
    expect(result.knowledgeRefs).toEqual([
      "fact:fc:taihemen:bronze-lions:objects@dev-v1",
    ]);
    expect(result.memoryDecision.status).toBe("not_requested");
    expect(result.sourceTrace).toHaveLength(1);
  });

  it("allows the model to say it does not know without inventing a fact", async () => {
    const result = await runCompanionReply(
      { ...companionReplyFixture, facts: [] },
      provider({
        ...validOutput,
        speechText: "这个我还不确定，我们可以一起看看。",
        knowledgeStatus: "K3",
        knowledgeRefs: [],
        memoryRefs: [],
      }),
      options,
    );

    expect(result.knowledgeStatus).toBe("K3");
    expect(result.knowledgeRefs).toHaveLength(0);
  });

  it("rejects a memory claim when no active memory is cited", async () => {
    await expect(
      runCompanionReply(
        companionReplyFixture,
        provider({ ...validOutput, speechText: "我记得你喜欢鹅肝。", memoryRefs: [] }),
        options,
      ),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });

  it("rejects a client memory snapshot instead of accepting it as context", async () => {
    await expect(
      runCompanionReply(
        {
          ...companionReplyFixture,
          memories: [],
        },
        provider({ ...validOutput, memoryRefs: ["memory:client:fake"] }),
        options,
      ),
    ).rejects.toThrow();
  });

  it("writes a memory only after the proposal passes the evidence gate", async () => {
    const memoryStore = new InMemoryMemoryStore();
    const result = await runCompanionReply(
      {
        ...companionReplyFixture,
        input: { ...companionReplyFixture.input, confirmedByChild: true },
      },
      provider({
        ...validOutput,
        memoryRefs: [],
        memoryProposal: {
          operation: "create",
          text: "孩子主动问起了上次的铜狮。",
          evidenceRefs: ["submission:dev:transcript:001"],
          requestedSourceType: "user_stated",
          confidence: 0.95,
          privacyLevel: "ordinary",
          kind: "event",
          guardianVisibility: "summary_visible",
          retentionUntil: "2027-08-17T10:00:00.000Z",
          replacesMemoryId: null,
        },
      }),
      { ...options, memoryStore },
    );

    expect(result.memoryDecision.status).toBe("accepted");
    expect(memoryStore.recall({
      householdId: "household:dev:001",
      childProfileId: "child:dev:001",
      characterInstanceId: "character:dev:001",
      text: "铜狮",
      occurredAt: "2026-08-17T10:00:01.000Z",
      limit: 3,
    })).toHaveLength(1);
  });

  it("does not call the model for a child safety event", async () => {
    const testProvider = provider(validOutput);
    const result = await runCompanionReply(
      {
        ...companionReplyFixture,
        input: {
          ...companionReplyFixture.input,
          text: "我找不到妈妈了",
        },
      },
      testProvider,
      options,
    );

    expect(result.safety.code).toBe("lost_child");
    expect(testProvider.calls).toHaveLength(0);
  });
});
