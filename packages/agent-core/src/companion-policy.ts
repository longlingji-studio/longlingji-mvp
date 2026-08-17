import type {
  CompanionModelOutput,
  MemoryRecord,
} from "./contracts.js";
import type { CompanionModelContext } from "./context-builder.js";
import { BANNED_OUTPUT_PATTERNS } from "./policy.js";

export type CompanionDraftValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "missing_reference" | "policy_violation";
      readonly issues: readonly string[];
    };

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

function hasUnsupportedMemoryClaim(
  speechText: string,
  memoryRefs: readonly string[],
): boolean {
  if (memoryRefs.length > 0) {
    return false;
  }
  return ["我记得你", "你以前说过", "上次你"].some((phrase) =>
    speechText.includes(phrase),
  );
}

function hasRecordReference(
  ids: readonly string[],
  records: readonly MemoryRecord[],
): boolean {
  const knownIds = new Set(records.map((record) => record.id));
  return ids.some((id) => !knownIds.has(id));
}

export function validateCompanionDraftPolicy(
  draft: CompanionModelOutput,
  context: CompanionModelContext,
): CompanionDraftValidation {
  const factIds = new Set(context.facts.map((fact) => fact.id));
  const evidenceIds = new Set([context.input.evidenceId]);

  if (draft.knowledgeRefs.some((id) => !factIds.has(id))) {
    return {
      ok: false,
      reason: "missing_reference",
      issues: ["Knowledge reference is outside the approved context"],
    };
  }
  if (hasRecordReference(draft.memoryRefs, context.memories)) {
    return {
      ok: false,
      reason: "missing_reference",
      issues: ["Memory reference is outside the scoped active context"],
    };
  }
  if (
    draft.memoryProposal !== null &&
    draft.memoryProposal.evidenceRefs.some((id) => !evidenceIds.has(id))
  ) {
    return {
      ok: false,
      reason: "missing_reference",
      issues: ["Memory proposal cites an event not present in the current turn"],
    };
  }

  const issues: string[] = [];
  if (draft.knowledgeStatus === "grounded" && draft.knowledgeRefs.length === 0) {
    issues.push("Grounded response must cite at least one approved fact");
  }
  if (
    ["unknown", "not_needed"].includes(draft.knowledgeStatus) &&
    draft.knowledgeRefs.length > 0
  ) {
    issues.push("Unknown or not-needed response cannot cite knowledge facts");
  }

  const maxSpeechLength = context.childAgeBand === "6_7" ? 48 : 72;
  if (unicodeLength(draft.speechText) > maxSpeechLength) {
    issues.push(`Speech exceeds age-band limit of ${maxSpeechLength} characters`);
  }
  if (
    BANNED_OUTPUT_PATTERNS.some((pattern) => pattern.test(draft.speechText))
  ) {
    issues.push("Generated content contains a prohibited expression");
  }
  if (hasUnsupportedMemoryClaim(draft.speechText, draft.memoryRefs)) {
    issues.push("Memory claim requires an active memory reference");
  }
  if (draft.nextMove === "safety_handoff" && draft.safety.code === "none") {
    issues.push("Safety handoff requires a safety code");
  }
  if (draft.nextMove !== "safety_handoff" && draft.safety.code !== "none") {
    issues.push("Normal response cannot carry an unresolved safety code");
  }

  return issues.length === 0
    ? { ok: true }
    : { ok: false, reason: "policy_violation", issues };
}
