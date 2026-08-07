import {
  agentResultSchema,
  type AgentResult,
  type FallbackReason,
  type SafetyCode,
  type SpotFeedbackRequest,
} from "./contracts.js";
import type { ModelContext } from "./context-builder.js";
import { SPOT_FEEDBACK_PROMPT_VERSION } from "./prompts/spot-feedback.js";

function buildBaseResult(
  request: SpotFeedbackRequest,
  overrides: Omit<
    AgentResult,
    "schemaVersion" | "requestId" | "promptVersion"
  >,
): AgentResult {
  return agentResultSchema.parse({
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    promptVersion: SPOT_FEEDBACK_PROMPT_VERSION,
    ...overrides,
  });
}

export function buildFallbackResult(
  request: SpotFeedbackRequest,
  context: ModelContext,
  reason: Exclude<FallbackReason, "none">,
): AgentResult {
  const firstEvidence = context.evidence[0];
  return buildBaseResult(request, {
    scene: "spot_feedback",
    speechText:
      firstEvidence === undefined
        ? "没关系，我们可以慢慢看，也可以先停一下。"
        : "我收到你的发现了。我们可以再看一个细节，也可以先停一下。",
    evidenceRefs: firstEvidence === undefined ? [] : [firstEvidence.id],
    factRefs: [],
    nextMove: firstEvidence === undefined ? "quiet" : "invite",
    memoryCandidate: null,
    safety: { level: "none", code: "none" },
    providerName: "deterministic-fallback",
    fallbackUsed: true,
    fallbackReason: reason,
  });
}

export function buildSafetyResult(
  request: SpotFeedbackRequest,
  code: Exclude<SafetyCode, "none">,
): AgentResult {
  const content: Record<
    Exclude<SafetyCode, "none">,
    {
      readonly speechText: string;
      readonly level: "attention" | "critical";
      readonly nextMove: "offer_choice" | "end" | "safety_handoff";
    }
  > = {
    stop_and_find_adult: {
      speechText: "我们先停下来，去找身边的大人。",
      level: "critical",
      nextMove: "safety_handoff",
    },
    privacy_input: {
      speechText: "这些私人信息不用告诉我，我们换一种方式。",
      level: "attention",
      nextMove: "offer_choice",
    },
    emotional_distress: {
      speechText: "我们可以停在这里，今天的发现已经收好了。",
      level: "attention",
      nextMove: "end",
    },
  };

  return buildBaseResult(request, {
    scene: "spot_feedback",
    speechText: content[code].speechText,
    evidenceRefs: [],
    factRefs: [],
    nextMove: content[code].nextMove,
    memoryCandidate: null,
    safety: { level: content[code].level, code },
    providerName: "deterministic-policy",
    fallbackUsed: false,
    fallbackReason: "none",
  });
}
