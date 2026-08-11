import type {
  ContentFact,
  Evidence,
  SpotFeedbackRequest,
} from "./contracts.js";

export const VERIFIED_TRANSCRIPT_CONFIDENCE = 0.85;

export interface ModelFact {
  readonly id: string;
  readonly text: string;
}

export interface ModelEvidence {
  readonly id: string;
  readonly type: Evidence["type"];
  readonly value?: string;
}

export interface ModelContext {
  readonly scene: "spot_feedback";
  readonly contentMode: SpotFeedbackRequest["contentMode"];
  readonly childAgeBand: SpotFeedbackRequest["childAgeBand"];
  readonly contentSnapshotId: string;
  readonly questSnapshotId: string;
  readonly facts: readonly ModelFact[];
  readonly evidence: readonly ModelEvidence[];
  readonly memory: Readonly<{
    id: string;
    text: string;
    evidenceRefs: readonly string[];
  }> | null;
}

function toModelFact(fact: ContentFact): ModelFact | null {
  if (fact.reviewStatus !== "approved") {
    return null;
  }
  return { id: fact.id, text: fact.text };
}

function toModelEvidence(evidence: Evidence): ModelEvidence | null {
  if (evidence.type === "choice") {
    if (evidence.verification !== "verified") {
      return null;
    }
    if (evidence.value === undefined) {
      return null;
    }
    return { id: evidence.id, type: evidence.type, value: evidence.value };
  }

  if (evidence.type === "verified_transcript") {
    if (evidence.verification !== "verified") {
      return null;
    }
    if (evidence.value === undefined) {
      return null;
    }
    if (evidence.confidence === undefined) {
      return null;
    }
    if (evidence.confidence < VERIFIED_TRANSCRIPT_CONFIDENCE) {
      return null;
    }
    return { id: evidence.id, type: evidence.type, value: evidence.value };
  }

  if (["uploaded_only", "verified"].includes(evidence.verification)) {
    // P0 exposes only the existence of media, never an unverified interpretation.
    return { id: evidence.id, type: evidence.type };
  }

  return null;
}

export function buildModelContext(
  request: SpotFeedbackRequest,
): ModelContext {
  const facts = request.facts
    .map(toModelFact)
    .filter((fact): fact is ModelFact => fact !== null);
  const evidence = request.evidence
    .map(toModelEvidence)
    .filter((item): item is ModelEvidence => item !== null);

  return {
    scene: request.scene,
    contentMode: request.contentMode,
    childAgeBand: request.childAgeBand,
    contentSnapshotId: request.contentSnapshotId,
    questSnapshotId: request.questSnapshotId,
    facts,
    evidence,
    memory:
      request.memory === null
        ? null
        : {
            id: request.memory.id,
            text: request.memory.text,
            evidenceRefs: request.memory.evidenceRefs,
          },
  };
}
