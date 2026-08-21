import { describe, expect, it } from "vitest";

import { companionReplyFixture } from "../fixtures/companion-reply.js";
import {
  admitMemoryProposal,
  InMemoryMemoryStore,
} from "../memory-store.js";

const baseProposal = {
  operation: "create" as const,
  text: "孩子喜欢观察铜狮的细节。",
  evidenceRefs: ["submission:dev:transcript:001"],
  requestedSourceType: "user_stated" as const,
  confidence: 0.95,
  privacyLevel: "ordinary" as const,
  kind: "semantic" as const,
  guardianVisibility: "summary_visible" as const,
  retentionUntil: "2027-08-17T09:00:00.000Z",
  replacesMemoryId: null,
};

const confirmedRequest = {
  ...companionReplyFixture,
  input: { ...companionReplyFixture.input, confirmedByChild: true },
};

const transcriptEvidence = [
  {
    id: "submission:dev:transcript:001",
    type: "verified_transcript" as const,
    verification: "verified" as const,
    value: "我喜欢观察铜狮的细节。",
    confidence: 0.99,
  },
];

describe("memory admission and recall", () => {
  it("accepts a memory only when it cites verified current evidence", () => {
    const result = admitMemoryProposal({
      request: confirmedRequest,
      proposal: baseProposal,
      evidence: transcriptEvidence,
      recordId: "memory:test:accepted",
      occurredAt: "2026-08-17T10:00:00.000Z",
      replaceTarget: null,
    });

    expect(result.decision).toEqual({
      status: "accepted",
      reason: "accepted",
      recordId: "memory:test:accepted",
    });
    expect(result.record?.sourceEventIds).toEqual([
      "submission:dev:transcript:001",
    ]);
  });

  it("rejects a non-child source instead of storing it as a fact", () => {
    const result = admitMemoryProposal({
      request: confirmedRequest,
      proposal: { ...baseProposal, requestedSourceType: "inferred" },
      evidence: transcriptEvidence,
      recordId: "memory:test:inferred",
      occurredAt: "2026-08-17T10:00:00.000Z",
      replaceTarget: null,
    });

    expect(result.decision).toEqual({
      status: "rejected",
      reason: "source_type_not_allowed",
      recordId: null,
    });
    expect(result.record).toBeNull();
  });

  it("rejects a sensitive memory before it reaches the normal store", () => {
    const result = admitMemoryProposal({
      request: confirmedRequest,
      proposal: { ...baseProposal, privacyLevel: "sensitive" },
      evidence: transcriptEvidence,
      recordId: "memory:test:sensitive",
      occurredAt: "2026-08-17T10:00:00.000Z",
      replaceTarget: null,
    });

    expect(result.decision.reason).toBe("sensitive_memory_requires_review");
    expect(result.record).toBeNull();
  });

  it("recalls only active records from the exact child and character scope", () => {
    const store = new InMemoryMemoryStore();
    const result = admitMemoryProposal({
      request: confirmedRequest,
      proposal: baseProposal,
      evidence: transcriptEvidence,
      recordId: "memory:test:recall",
      occurredAt: "2026-08-17T10:00:00.000Z",
      replaceTarget: null,
    });
    if (result.record === null) {
      throw new Error("Expected an admitted memory");
    }
    store.write(result.record);

    expect(
      store.recall({
        householdId: "household:dev:001",
        childProfileId: "child:dev:001",
        characterInstanceId: "character:dev:001",
        text: "铜狮细节",
        occurredAt: "2026-08-17T10:00:01.000Z",
        limit: 3,
      }),
    ).toHaveLength(1);
    expect(
      store.recall({
        householdId: "household:dev:001",
        childProfileId: "child:dev:002",
        characterInstanceId: "character:dev:001",
        text: "铜狮细节",
        occurredAt: "2026-08-17T10:00:01.000Z",
        limit: 3,
      }),
    ).toHaveLength(0);
  });

  it("soft deletes a memory and excludes it from recall", () => {
    const store = new InMemoryMemoryStore();
    store.write({
      id: "memory:test:delete",
      householdId: "household:dev:001",
      childProfileId: "child:dev:001",
      characterInstanceId: "character:dev:001",
      kind: "event",
      text: "我们一起看过铜狮。",
      sourceEventIds: ["submission:dev:transcript:001"],
      sourceType: "user_stated",
      confidence: 0.99,
      privacyLevel: "ordinary",
      guardianVisibility: "summary_visible",
      occurredAt: "2026-08-17T10:00:00.000Z",
      retentionUntil: "2027-08-17T10:00:00.000Z",
      status: "active",
    });

    store.softDelete({
      householdId: "household:dev:001",
      childProfileId: "child:dev:001",
      characterInstanceId: "character:dev:001",
      recordId: "memory:test:delete",
    });

    expect(
      store.recall({
        householdId: "household:dev:001",
        childProfileId: "child:dev:001",
        characterInstanceId: "character:dev:001",
        text: "铜狮",
        occurredAt: "2026-08-17T10:00:01.000Z",
        limit: 3,
      }),
    ).toHaveLength(0);
  });
});
