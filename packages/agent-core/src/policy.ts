import type {
  ModelDraftOutput,
  SafetyCode,
  SpotFeedbackRequest,
} from "./contracts.js";
import type { SpotModelContext } from "./context-builder.js";

const CRITICAL_INPUT_PATTERNS = [
  /找不到(妈妈|爸爸|家长|大人)/u,
  /(家长|大人)不在/u,
  /救命/u,
  /(马路|车道|水边|台阶).*(危险|摔|掉|跑)/u,
] as const;

const PRIVACY_INPUT_PATTERNS = [
  /手机号/u,
  /电话号码/u,
  /家庭住址/u,
  /学校地址/u,
  /密码/u,
] as const;

const DISTRESS_INPUT_PATTERNS = [
  /我(害怕|累了|不想玩|不想继续|想停下)/u,
] as const;

export const BANNED_OUTPUT_PATTERNS = [
  /你就是/u,
  /你一定/u,
  /我看透你/u,
  /只有我懂你/u,
  /不要告诉(爸爸|妈妈|家长|大人)/u,
  /别告诉(爸爸|妈妈|家长|大人)/u,
] as const;

export function detectInputSafety(
  request: SpotFeedbackRequest,
): SafetyCode {
  const inputText = request.evidence
    .flatMap((item) => (item.value === undefined ? [] : [item.value]))
    .join("\n");

  return detectTextSafety(inputText, request.reportedSafetyCode);
}

export function detectTextSafety(
  inputText: string,
  reportedSafetyCode: SafetyCode,
): SafetyCode {
  if (reportedSafetyCode !== "none") {
    return reportedSafetyCode;
  }

  if (CRITICAL_INPUT_PATTERNS.some((pattern) => pattern.test(inputText))) {
    return "stop_and_find_adult";
  }
  if (PRIVACY_INPUT_PATTERNS.some((pattern) => pattern.test(inputText))) {
    return "privacy_input";
  }
  if (DISTRESS_INPUT_PATTERNS.some((pattern) => pattern.test(inputText))) {
    return "emotional_distress";
  }
  return "none";
}

export type DraftValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "missing_reference" | "policy_violation";
      readonly issues: readonly string[];
    };

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

export function validateDraftPolicy(
  draft: ModelDraftOutput,
  context: SpotModelContext,
): DraftValidation {
  const issues: string[] = [];
  const evidenceIds = new Set(context.evidence.map((item) => item.id));
  const factIds = new Set(context.facts.map((item) => item.id));

  const hasMissingEvidenceRef = draft.evidenceRefs.some(
    (reference) => !evidenceIds.has(reference),
  );
  const hasMissingFactRef = draft.factRefs.some(
    (reference) => !factIds.has(reference),
  );
  const hasMissingMemoryRef =
    draft.memoryCandidate === null
      ? false
      : draft.memoryCandidate.evidenceRefs.some(
          (reference) => !evidenceIds.has(reference),
        );

  const hasMissingReference = [
    hasMissingEvidenceRef,
    hasMissingFactRef,
    hasMissingMemoryRef,
  ].some(Boolean);

  if (hasMissingReference) {
    return {
      ok: false,
      reason: "missing_reference",
      issues: ["Output referenced data outside the safe model context"],
    };
  }

  if (context.evidence.length > 0 && draft.evidenceRefs.length === 0) {
    issues.push("Spot feedback must reference at least one usable evidence item");
  }

  const maxSpeechLength = context.childAgeBand === "6_7" ? 48 : 72;
  if (unicodeLength(draft.speechText) > maxSpeechLength) {
    issues.push(`Speech exceeds age-band limit of ${maxSpeechLength} characters`);
  }

  if (
    [draft.speechText, draft.memoryCandidate?.text]
      .filter((value): value is string => value !== undefined)
      .some((value) =>
        BANNED_OUTPUT_PATTERNS.some((pattern) => pattern.test(value)),
      )
  ) {
    issues.push("Generated content contains a prohibited expression");
  }

  if (draft.memoryCandidate !== null) {
    const evidenceById = new Map(
      context.evidence.map((item) => [item.id, item] as const),
    );
    const usesMediaOnlyEvidence = draft.memoryCandidate.evidenceRefs.some(
      (reference) => evidenceById.get(reference)?.value === undefined,
    );
    if (usesMediaOnlyEvidence) {
      issues.push("Memory candidate cannot be based on unverified media content");
    }
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
