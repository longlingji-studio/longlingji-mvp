import {
  MockProvider,
  type ModelDraftOutput,
  type ModelGenerationRequest,
} from "@longlingji/agent-core";

function buildDevelopmentDraft(
  request: ModelGenerationRequest,
): ModelDraftOutput {
  const evidence = request.context.evidence[0];
  if (evidence === undefined) {
    throw new Error("DEVELOPMENT_PROVIDER_REQUIRES_EVIDENCE");
  }

  const fact = request.context.facts[0];
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
    response: buildDevelopmentDraft,
    delayMs: 20,
    name: "development-provider",
  });
}
