import { z } from "zod";

import {
  evidenceSchema,
  type Evidence,
} from "./contracts.js";
import { VERIFIED_TRANSCRIPT_CONFIDENCE } from "./context-builder.js";
import {
  questSchema,
  type Quest,
} from "./journey.js";

const scopeSchema = z
  .object({
    householdId: z.string().min(1),
    childProfileId: z.string().min(1),
  })
  .strict();

export const questProgressRecordSchema = z
  .object({
    id: z.string().min(1),
    householdId: z.string().min(1),
    childProfileId: z.string().min(1),
    questId: z.string().min(1),
    status: z.enum(["in_progress", "completed"]),
    evidenceIds: z.array(z.string().min(1)).max(5),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1).nullable(),
  })
  .strict();

const startQuestCommandSchema = z
  .object({
    schemaVersion: z.literal("quest-request.v1"),
    action: z.literal("start"),
    householdId: z.string().min(1),
    childProfileId: z.string().min(1),
    questId: z.string().min(1),
  })
  .strict();

const submitQuestCommandSchema = z
  .object({
    schemaVersion: z.literal("quest-request.v1"),
    action: z.literal("submit"),
    householdId: z.string().min(1),
    childProfileId: z.string().min(1),
    questId: z.string().min(1),
    evidence: z.array(evidenceSchema).min(1).max(5),
  })
  .strict();

export const questProgressCommandSchema = z.discriminatedUnion("action", [
  startQuestCommandSchema,
  submitQuestCommandSchema,
]);

export type QuestProgressRecord = z.infer<typeof questProgressRecordSchema>;
export type QuestProgressCommand = z.infer<typeof questProgressCommandSchema>;

export interface QuestProgressStore {
  start(
    quest: Quest,
    scope: { readonly householdId: string; readonly childProfileId: string },
    startedAt: string,
  ): QuestProgressRecord;
  complete(
    quest: Quest,
    scope: { readonly householdId: string; readonly childProfileId: string },
    evidence: readonly Evidence[],
    completedAt: string,
  ): QuestProgressRecord;
}

function progressId(
  quest: Quest,
  scope: { readonly householdId: string; readonly childProfileId: string },
): string {
  return `progress:${scope.householdId}:${scope.childProfileId}:${quest.id}`;
}

function progressKey(
  questId: string,
  scope: { readonly householdId: string; readonly childProfileId: string },
): string {
  return `${scope.householdId}:${scope.childProfileId}:${questId}`;
}

function assertAcceptedEvidence(
  quest: Quest,
  evidence: readonly Evidence[],
): void {
  for (const item of evidence) {
    if (!quest.acceptedEvidenceTypes.includes(item.type as "choice" | "verified_transcript")) {
      throw new Error(`QUEST_EVIDENCE_TYPE_NOT_ACCEPTED:${item.type}`);
    }
    if (item.verification !== "verified") {
      throw new Error(`QUEST_EVIDENCE_NOT_VERIFIED:${item.id}`);
    }
    if (item.value === undefined) {
      throw new Error(`QUEST_EVIDENCE_VALUE_MISSING:${item.id}`);
    }
    if (item.type === "verified_transcript") {
      if (item.confidence === undefined) {
        throw new Error(`QUEST_EVIDENCE_CONFIDENCE_MISSING:${item.id}`);
      }
      if (item.confidence < VERIFIED_TRANSCRIPT_CONFIDENCE) {
        throw new Error(`QUEST_EVIDENCE_CONFIDENCE_LOW:${item.id}`);
      }
    }
  }
}

export class InMemoryQuestProgressStore implements QuestProgressStore {
  private readonly records = new Map<string, QuestProgressRecord>();

  public start(
    quest: Quest,
    scope: { readonly householdId: string; readonly childProfileId: string },
    startedAt: string,
  ): QuestProgressRecord {
    const key = progressKey(quest.id, scope);
    if (this.records.has(key)) {
      throw new Error(`QUEST_ALREADY_STARTED:${quest.id}`);
    }
    const record = questProgressRecordSchema.parse({
      id: progressId(quest, scope),
      householdId: scope.householdId,
      childProfileId: scope.childProfileId,
      questId: quest.id,
      status: "in_progress",
      evidenceIds: [],
      startedAt,
      completedAt: null,
    });
    this.records.set(key, record);
    return record;
  }

  public complete(
    quest: Quest,
    scope: { readonly householdId: string; readonly childProfileId: string },
    evidence: readonly Evidence[],
    completedAt: string,
  ): QuestProgressRecord {
    const key = progressKey(quest.id, scope);
    const current = this.records.get(key);
    if (current === undefined) {
      throw new Error(`QUEST_NOT_STARTED:${quest.id}`);
    }
    if (current.status === "completed") {
      throw new Error(`QUEST_ALREADY_COMPLETED:${quest.id}`);
    }
    assertAcceptedEvidence(quest, evidence);
    const record = questProgressRecordSchema.parse({
      ...current,
      status: "completed",
      evidenceIds: evidence.map((item) => item.id),
      completedAt,
    });
    this.records.set(key, record);
    return record;
  }
}

export function runQuestProgress(
  input: unknown,
  questLookup: (questId: string) => Quest,
  store: QuestProgressStore,
  now: string,
): QuestProgressRecord {
  const command = questProgressCommandSchema.parse(input);
  const scope = scopeSchema.parse({
    householdId: command.householdId,
    childProfileId: command.childProfileId,
  });
  const quest = questSchema.parse(questLookup(command.questId));
  if (quest.reviewStatus !== "approved") {
    throw new Error(`QUEST_NOT_PUBLISHED:${quest.id}`);
  }

  if (command.action === "start") {
    return store.start(quest, scope, now);
  }

  return store.complete(quest, scope, command.evidence, now);
}
