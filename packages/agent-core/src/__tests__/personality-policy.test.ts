import { describe, expect, it } from "vitest";

import { personalityDeltaProposalSchema } from "../contracts.js";
import { evaluatePersonalityDelta } from "../personality-policy.js";

const validProposal = personalityDeltaProposalSchema.parse({
  traitId: "exploration",
  delta: 0.005,
  evidenceEventIds: ["event:001", "event:002"],
  confidence: 0.9,
  rationale: "两次独立探索事件都记录了孩子主动观察。",
});

describe("personality update gate", () => {
  it("accepts a small evidence-backed change", () => {
    expect(
      evaluatePersonalityDelta(validProposal, {
        dailyAppliedAbs: 0,
        weeklyAppliedAbs: 0,
        sensitiveEventIds: new Set(),
      }),
    ).toEqual({ status: "accepted", reason: "accepted" });
  });

  it("rejects duplicate events even when the array contains two IDs", () => {
    expect(
      evaluatePersonalityDelta(
        { ...validProposal, evidenceEventIds: ["event:001", "event:001"] },
        {
          dailyAppliedAbs: 0,
          weeklyAppliedAbs: 0,
          sensitiveEventIds: new Set(),
        },
      ),
    ).toEqual({ status: "rejected", reason: "duplicate_evidence" });
  });

  it("rejects a change that would exceed the daily limit", () => {
    expect(
      evaluatePersonalityDelta(validProposal, {
        dailyAppliedAbs: 0.02,
        weeklyAppliedAbs: 0,
        sensitiveEventIds: new Set(),
      }),
    ).toEqual({ status: "rejected", reason: "daily_limit" });
  });

  it("rejects sensitive evidence from automatic personality updates", () => {
    expect(
      evaluatePersonalityDelta(validProposal, {
        dailyAppliedAbs: 0,
        weeklyAppliedAbs: 0,
        sensitiveEventIds: new Set(["event:002"]),
      }),
    ).toEqual({ status: "rejected", reason: "sensitive_evidence" });
  });
});
