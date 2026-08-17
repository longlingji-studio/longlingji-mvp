import {
  memoryRecordSchema,
  type CompanionReplyRequest,
  type Evidence,
  type MemoryDecision,
  type MemoryProposal,
  type MemoryRecord,
} from "./contracts.js";

export interface MemoryRecallQuery {
  readonly householdId: string;
  readonly childProfileId: string;
  readonly characterInstanceId: string;
  readonly text: string;
  readonly limit: number;
}

export interface MemoryStore {
  write(record: MemoryRecord): MemoryRecord;
  recall(query: MemoryRecallQuery): readonly MemoryRecord[];
  softDelete(scope: {
    readonly householdId: string;
    readonly childProfileId: string;
    readonly characterInstanceId: string;
    readonly recordId: string;
  }): void;
}

function tokenize(value: string): readonly string[] {
  const segments = value
    .toLocaleLowerCase()
    .split(/[\s,，。！？!?、；;：:]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
  const tokens = new Set<string>();

  for (const segment of segments) {
    tokens.add(segment);
    if (/^[\u4e00-\u9fff]+$/u.test(segment)) {
      for (let index = 0; index < segment.length - 1; index += 1) {
        tokens.add(segment.slice(index, index + 2));
      }
    }
  }

  return [...tokens];
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  public write(record: MemoryRecord): MemoryRecord {
    const parsed = memoryRecordSchema.parse(record);
    if (this.records.has(parsed.id)) {
      throw new Error(`MEMORY_ID_ALREADY_EXISTS:${parsed.id}`);
    }
    this.records.set(parsed.id, parsed);
    return parsed;
  }

  public recall(query: MemoryRecallQuery): readonly MemoryRecord[] {
    if (!Number.isInteger(query.limit)) {
      throw new RangeError("Memory recall limit must be an integer");
    }
    if (query.limit <= 0) {
      throw new RangeError("Memory recall limit must be positive");
    }
    if (query.limit > 8) {
      throw new RangeError("Memory recall limit must not exceed 8");
    }

    const queryTokens = new Set(tokenize(query.text));
    return [...this.records.values()]
      .filter((record) => {
        if (record.status !== "active") {
          return false;
        }
        if (record.privacyLevel === "highly_sensitive") {
          return false;
        }
        if (record.householdId !== query.householdId) {
          return false;
        }
        if (record.childProfileId !== query.childProfileId) {
          return false;
        }
        return record.characterInstanceId === query.characterInstanceId;
      })
      .map((record) => {
        const recordTokens = tokenize(record.text);
        const score = recordTokens.reduce(
          (total, token) => (queryTokens.has(token) ? total + 1 : total),
          0,
        );
        return { record, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }
        return right.record.occurredAt.localeCompare(left.record.occurredAt);
      })
      .slice(0, query.limit)
      .map((item) => item.record);
  }

  public softDelete(scope: {
    readonly householdId: string;
    readonly childProfileId: string;
    readonly characterInstanceId: string;
    readonly recordId: string;
  }): void {
    const record = this.records.get(scope.recordId);
    if (record === undefined) {
      throw new Error(`MEMORY_NOT_FOUND:${scope.recordId}`);
    }
    if (record.householdId !== scope.householdId) {
      throw new Error("MEMORY_SCOPE_MISMATCH");
    }
    if (record.childProfileId !== scope.childProfileId) {
      throw new Error("MEMORY_SCOPE_MISMATCH");
    }
    if (record.characterInstanceId !== scope.characterInstanceId) {
      throw new Error("MEMORY_SCOPE_MISMATCH");
    }

    this.records.set(scope.recordId, { ...record, status: "deleted" });
  }
}

export interface MemoryAdmissionInput {
  readonly request: CompanionReplyRequest;
  readonly proposal: MemoryProposal;
  readonly evidence: readonly Evidence[];
  readonly recordId: string;
  readonly occurredAt: string;
}

export interface MemoryAdmissionResult {
  readonly decision: MemoryDecision;
  readonly record: MemoryRecord | null;
}

function rejectedMemoryDecision(
  reason: Exclude<MemoryDecision["reason"], "accepted" | null>,
): MemoryAdmissionResult {
  return {
    decision: { status: "rejected", reason, recordId: null },
    record: null,
  };
}

export function admitMemoryProposal(
  input: MemoryAdmissionInput,
): MemoryAdmissionResult {
  if (input.proposal.requestedSourceType === "inferred") {
    return rejectedMemoryDecision("inferred_not_persisted");
  }
  if (input.proposal.confidence < 0.85) {
    return rejectedMemoryDecision("low_confidence");
  }
  if (input.proposal.privacyLevel !== "ordinary") {
    return rejectedMemoryDecision("sensitive_memory_requires_review");
  }

  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const citedEvidence = input.proposal.evidenceRefs.map((id) =>
    evidenceById.get(id),
  );
  if (citedEvidence.some((item) => item === undefined)) {
    return rejectedMemoryDecision("missing_evidence");
  }

  for (const evidence of citedEvidence) {
    if (evidence === undefined) {
      return rejectedMemoryDecision("missing_evidence");
    }
    if (["photo_uploaded", "audio_uploaded"].includes(evidence.type)) {
      return rejectedMemoryDecision("media_only_evidence");
    }
    if (evidence.verification !== "verified") {
      return rejectedMemoryDecision("missing_evidence");
    }
    if (evidence.value === undefined) {
      return rejectedMemoryDecision("missing_evidence");
    }
    if (evidence.type === "verified_transcript") {
      if (evidence.confidence === undefined) {
        return rejectedMemoryDecision("low_confidence");
      }
      if (evidence.confidence < 0.85) {
        return rejectedMemoryDecision("low_confidence");
      }
    }
  }

  const record: MemoryRecord = {
    id: input.recordId,
    householdId: input.request.householdId,
    childProfileId: input.request.childProfileId,
    characterInstanceId: input.request.characterInstanceId,
    kind: input.proposal.kind,
    text: input.proposal.text,
    sourceEventIds: input.proposal.evidenceRefs,
    sourceType: input.proposal.requestedSourceType,
    confidence: input.proposal.confidence,
    privacyLevel: input.proposal.privacyLevel,
    guardianVisibility: input.proposal.guardianVisibility,
    occurredAt: input.occurredAt,
    retentionUntil: input.proposal.retentionUntil,
    status: "active",
  };

  return {
    decision: { status: "accepted", reason: "accepted", recordId: record.id },
    record,
  };
}
