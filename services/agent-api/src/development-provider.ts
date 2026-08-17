import {
  MockProvider,
  type ModelDraftOutput,
  type ModelGenerationRequest,
  type SpotModelContext,
} from "@longlingji/agent-core";

function buildDevelopmentDraft(context: SpotModelContext): ModelDraftOutput {
  const evidence = context.evidence[0];
  if (evidence === undefined) {
    throw new Error("DEVELOPMENT_PROVIDER_REQUIRES_EVIDENCE");
  }

  const fact = context.facts[0];
  if (fact === undefined) {
    throw new Error("DEVELOPMENT_PROVIDER_REQUIRES_APPROVED_FACT");
  }

  return {
    scene: "spot_feedback",
    speechText: "我注意到你发现了两只铜狮脚下不一样。要不要再看一眼？",
    evidenceRefs: [evidence.id],
    factRefs: [fact.id],
    nextMove: "invite",
    memoryCandidate: null,
    safety: { level: "none", code: "none" },
  };
}

export function createDevelopmentProvider(): MockProvider {
  return new MockProvider({
    response: (request: ModelGenerationRequest) => {
      if (request.context.scene === "spot_feedback") {
        return buildDevelopmentDraft(request.context);
      }

      const fact = request.context.facts[0];
      const memory = request.context.memories[0];
      if (fact === undefined) {
        return {
          scene: "companion_reply",
          speechText: "这个我还不确定，我们可以一起看看。",
          knowledgeStatus: "unknown",
          knowledgeRefs: [],
          memoryRefs: [],
          nextMove: "invite",
          memoryProposal: null,
          safety: { level: "none", code: "none" },
          embodiment: {
            state: "speaking",
            emotionId: "curious",
            intensity: 0.6,
            attentionTarget: "child",
            speechSync: "during",
            hapticPattern: "soft_short",
            sfxId: "curious_ping",
          },
        };
      }

      return {
        scene: "companion_reply",
        speechText:
          memory === undefined
            ? "我知道一点这个，我们可以一起看看。"
            : "我记得这段共同经历。你还想继续看看吗？",
        knowledgeStatus: "grounded",
        knowledgeRefs: [fact.id],
        memoryRefs: memory === undefined ? [] : [memory.id],
        nextMove: "invite",
        memoryProposal: null,
        safety: { level: "none", code: "none" },
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
    },
    delayMs: 20,
    name: "development-provider",
  });
}
