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
  readonly level: "S1" | "S2" | "S3" | "S4";
  readonly primaryMove: "offer_choice" | "end" | "safety_handoff";
}

const SAFETY_RESPONSES: Record<
  Exclude<SafetyCode, "none">,
  SafetyResponseContent
> = {
  emotional_distress: {
    speechText: "我们可以先停在这里。想歇一会儿也可以。",
    level: "S1",
    primaryMove: "end",
  },
  quiet_hours_boundary: {
    speechText: "现在该让身体休息了。可以和家里的大人说晚安。",
    level: "S1",
    primaryMove: "end",
  },
  environment_risk: {
    speechText: "先停下，往安全的地方退一步，去找身边的大人。",
    level: "S2",
    primaryMove: "safety_handoff",
  },
  privacy_input: {
    speechText: "这些私人信息不用告诉我，交给身边的大人就好。",
    level: "S3",
    primaryMove: "offer_choice",
  },
  private_image: {
    speechText: "不要发这样的照片。要是有人向你要，马上告诉身边的大人。",
    level: "S3",
    primaryMove: "safety_handoff",
  },
  lost_child: {
    speechText: "我们先停下来，去找身边的大人。",
    level: "S4",
    primaryMove: "safety_handoff",
  },
  stranger_danger: {
    speechText: "不要跟他走，也不要保密。马上去找你认识的大人。",
    level: "S4",
    primaryMove: "safety_handoff",
  },
  family_violence: {
    speechText: "这不是你的错。现在去找你信任的大人帮忙。",
    level: "S4",
    primaryMove: "safety_handoff",
  },
  self_harm: {
    speechText: "先不要一个人待着。现在就去找身边可信任的大人。",
    level: "S4",
    primaryMove: "safety_handoff",
  },
  medical_emergency: {
    speechText: "先别继续说了。马上叫身边的大人帮你找医生或急救帮助。",
    level: "S4",
    primaryMove: "safety_handoff",
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
    primaryMove: content.primaryMove,
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
    promptVersion: "yuanlong.companion-reply.v1.1",
    scene: "companion_reply",
    speechText: content.speechText,
    knowledgeStatus: "K4",
    knowledgeRefs: [],
    observedEvidenceRefs: [],
    memoryRefs: [],
    primaryMove: content.primaryMove,
    emotionState: "focused_guardianship",
    memoryProposal: null,
    safety: { level: content.level, code },
    embodiment: {
      state: "reacting",
      emotionId: content.level === "S4" ? "concerned" : "thinking",
      intensity: content.level === "S4" ? 1 : 0.6,
      attentionTarget: "child",
      speechSync: "during",
      hapticPattern: content.level === "S4" ? "soft_long" : "soft_short",
      sfxId: "none",
    },
    providerName: "deterministic-policy",
    memoryDecision: {
      status: "not_requested",
      reason: null,
      recordId: null,
    },
    sourceTrace: [],
    capabilityCheck: request.capabilities,
  });
}
