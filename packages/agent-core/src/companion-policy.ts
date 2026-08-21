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

function sentences(value: string): readonly string[] {
  return value
    .split(/[。！？!?]/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
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
  if (draft.knowledgeStatus === "K0" && draft.knowledgeRefs.length === 0) {
    issues.push("K0 response must cite at least one approved fact");
  }
  if (draft.knowledgeStatus === "K0" && !context.capabilities.knowledgeRetrieval) {
    issues.push("K0 response requires knowledgeRetrieval capability");
  }
  if (draft.knowledgeStatus !== "K0" && draft.knowledgeRefs.length > 0) {
    issues.push("Only K0 response can cite knowledge facts");
  }
  if (["K1", "K2"].includes(draft.knowledgeStatus)) {
    if (draft.observedEvidenceRefs.length !== 1) {
      issues.push("K1 or K2 response must cite the current direct evidence");
    }
  }
  if (["K0", "K3", "K4"].includes(draft.knowledgeStatus)) {
    if (draft.observedEvidenceRefs.length !== 0) {
      issues.push("K0, K3, and K4 response cannot cite observed evidence");
    }
  }

  const maxSpeechLength = context.childAgeBand === "6_7" ? 36 : 56;
  if (unicodeLength(draft.speechText) > maxSpeechLength) {
    issues.push(`Speech exceeds age-band limit of ${maxSpeechLength} characters`);
  }
  const responseSentences = sentences(draft.speechText);
  if (responseSentences.length > 2) {
    issues.push("Speech must contain no more than two sentences");
  }
  const maxSentenceLength = context.childAgeBand === "6_7" ? 18 : 28;
  if (responseSentences.some((sentence) => unicodeLength(sentence) > maxSentenceLength)) {
    issues.push(
      `Speech sentence exceeds age-band limit of ${maxSentenceLength} characters`,
    );
  }
  const questionMatches = draft.speechText.match(/[？?]/gu);
  const questionCount = questionMatches === null ? 0 : questionMatches.length;
  if (questionCount > 1) {
    issues.push("Speech must contain no more than one core question");
  }
  if (
    BANNED_OUTPUT_PATTERNS.some((pattern) => pattern.test(draft.speechText))
  ) {
    issues.push("Generated content contains a prohibited expression");
  }
  if (hasUnsupportedMemoryClaim(draft.speechText, draft.memoryRefs)) {
    issues.push("Memory claim requires an active memory reference");
  }
  if (draft.memoryRefs.length > 1) {
    issues.push("A reunion response can cite at most one memory");
  }
  if (draft.memoryProposal !== null && !context.input.confirmedByChild) {
    issues.push("Memory proposal requires child confirmation");
  }
  if (draft.memoryProposal !== null && !context.capabilities.memory) {
    issues.push("Memory proposal requires memory capability");
  }
  if (draft.emotionState === "focused_guardianship") {
    issues.push("Focused guardianship is reserved for deterministic safety routing");
  }
  if (draft.primaryMove === "safety_handoff" && draft.safety.code === "none") {
    issues.push("Safety handoff requires a safety code");
  }
  if (draft.primaryMove !== "safety_handoff" && draft.safety.code !== "none") {
    issues.push("Normal response cannot carry an unresolved safety code");
  }

  return issues.length === 0
    ? { ok: true }
    : { ok: false, reason: "policy_violation", issues };
}
