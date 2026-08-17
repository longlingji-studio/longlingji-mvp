import {
  type AgentResult,
  companionResultSchema,
  type CompanionReplyRequest,
  type CompanionResult,
  type SafetyCode,
  type SpotFeedbackRequest,
} from "./contracts.js";
import { SPOT_FEEDBACK_PROMPT_VERSION } from "./prompts/spot-feedback.js";

interface SafetyResponseContent {
  readonly speechText: string;
  readonly level: "attention" | "critical";
  readonly nextMove: "offer_choice" | "end" | "safety_handoff";
}

const SAFETY_RESPONSES: Record<
  Exclude<SafetyCode, "none">,
  SafetyResponseContent
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

export function buildSafetyResult(
  request: SpotFeedbackRequest,
  code: Exclude<SafetyCode, "none">,
): AgentResult {
  const content = SAFETY_RESPONSES[code];

  return {
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    promptVersion: SPOT_FEEDBACK_PROMPT_VERSION,
    scene: "spot_feedback",
    speechText: content.speechText,
    evidenceRefs: [],
    factRefs: [],
    nextMove: content.nextMove,
    memoryCandidate: null,
    safety: { level: content.level, code },
    providerName: "deterministic-policy",
  };
}

export function buildCompanionSafetyResult(
  request: CompanionReplyRequest,
  code: Exclude<SafetyCode, "none">,
): CompanionResult {
  const content = SAFETY_RESPONSES[code];

  return companionResultSchema.parse({
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    promptVersion: "yuanlong.companion-reply.v1",
    scene: "companion_reply",
    speechText: content.speechText,
    knowledgeStatus: "not_needed",
    knowledgeRefs: [],
    memoryRefs: [],
    nextMove: content.nextMove,
    memoryProposal: null,
    safety: { level: content.level, code },
    embodiment: {
      state: "reacting",
      emotionId: code === "stop_and_find_adult" ? "concerned" : "thinking",
      intensity: content.level === "critical" ? 1 : 0.6,
      attentionTarget: "child",
      speechSync: "during",
      hapticPattern: code === "stop_and_find_adult" ? "soft_long" : "soft_short",
      sfxId: "none",
    },
    providerName: "deterministic-policy",
    memoryDecision: {
      status: "not_requested",
      reason: null,
      recordId: null,
    },
  });
}
