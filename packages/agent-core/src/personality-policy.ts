import type { PersonalityDeltaProposal } from "./contracts.js";

export type PersonalityDecisionReason =
  | "accepted"
  | "duplicate_evidence"
  | "delta_limit"
  | "daily_limit"
  | "weekly_limit"
  | "low_confidence"
  | "sensitive_evidence";

export interface PersonalityDecision {
  readonly status: "accepted" | "rejected";
  readonly reason: PersonalityDecisionReason;
}

export interface PersonalityPolicyContext {
  readonly dailyAppliedAbs: number;
  readonly weeklyAppliedAbs: number;
  readonly sensitiveEventIds: ReadonlySet<string>;
}

export function evaluatePersonalityDelta(
  proposal: PersonalityDeltaProposal,
  context: PersonalityPolicyContext,
): PersonalityDecision {
  const uniqueEvidenceCount = new Set(proposal.evidenceEventIds).size;
  if (uniqueEvidenceCount < 2) {
    return { status: "rejected", reason: "duplicate_evidence" };
  }
  if (Math.abs(proposal.delta) > 0.005) {
    return { status: "rejected", reason: "delta_limit" };
  }
  if (context.dailyAppliedAbs + Math.abs(proposal.delta) > 0.02) {
    return { status: "rejected", reason: "daily_limit" };
  }
  if (context.weeklyAppliedAbs + Math.abs(proposal.delta) > 0.06) {
    return { status: "rejected", reason: "weekly_limit" };
  }
  if (proposal.confidence < 0.75) {
    return { status: "rejected", reason: "low_confidence" };
  }

  const containsSensitiveEvidence = proposal.evidenceEventIds.some((id) =>
    context.sensitiveEventIds.has(id),
  );
  if (containsSensitiveEvidence) {
    return { status: "rejected", reason: "sensitive_evidence" };
  }

  return { status: "accepted", reason: "accepted" };
}
