import type {
  CompanionReplyRequest,
  ContentFact,
  MemoryRecord,
} from "./contracts.js";
import type { CompanionModelContext, ModelFact } from "./context-builder.js";

function toApprovedFact(fact: ContentFact): ModelFact | null {
  if (fact.reviewStatus !== "approved") {
    return null;
  }
  return { id: fact.id, text: fact.text };
}

function isScopedActiveMemory(
  memory: MemoryRecord,
  request: CompanionReplyRequest,
): boolean {
  if (memory.householdId !== request.householdId) {
    return false;
  }
  if (memory.childProfileId !== request.childProfileId) {
    return false;
  }
  if (memory.characterInstanceId !== request.characterInstanceId) {
    return false;
  }
  return memory.status === "active";
}

export function buildCompanionModelContext(
  request: CompanionReplyRequest,
  memories: readonly MemoryRecord[],
): CompanionModelContext {
  const facts = request.facts
    .map(toApprovedFact)
    .filter((fact): fact is ModelFact => fact !== null);
  const scopedMemories = memories.filter((memory) =>
    isScopedActiveMemory(memory, request),
  );

  const input =
    request.input.confidence === undefined
      ? {
          evidenceId: request.input.evidenceId,
          type: request.input.type,
          text: request.input.text,
        }
      : {
          evidenceId: request.input.evidenceId,
          type: request.input.type,
          text: request.input.text,
          confidence: request.input.confidence,
        };

  return {
    scene: request.scene,
    householdId: request.householdId,
    childProfileId: request.childProfileId,
    characterInstanceId: request.characterInstanceId,
    childAgeBand: request.childAgeBand,
    locale: request.locale,
    input,
    facts,
    memories: [...scopedMemories],
    personality: request.personality,
  };
}
