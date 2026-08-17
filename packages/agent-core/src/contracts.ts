import { z } from "zod";

const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._@-]*$/u, "ID must be stable ASCII");

export const agentSceneSchema = z.enum([
  "spot_feedback",
  "companion_reply",
  "recommendation_copy",
  "journey_diary",
]);

export const childAgeBandSchema = z.enum(["6_7", "8_10"]);
export const contentModeSchema = z.enum(["development_only", "published"]);

export const evidenceTypeSchema = z.enum([
  "choice",
  "verified_transcript",
  "photo_uploaded",
  "audio_uploaded",
]);

export const evidenceVerificationSchema = z.enum([
  "verified",
  "unverified",
  "uploaded_only",
]);

export const evidenceSchema = z
  .object({
    id: stableIdSchema,
    type: evidenceTypeSchema,
    verification: evidenceVerificationSchema,
    value: z.string().trim().min(1).max(800).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const contentFactSchema = z
  .object({
    id: stableIdSchema,
    text: z.string().trim().min(1).max(500),
    reviewStatus: z.enum(["approved", "draft", "rejected"]),
  })
  .strict();

export const confirmedMemorySchema = z
  .object({
    id: stableIdSchema,
    text: z.string().trim().min(1).max(300),
    evidenceRefs: z.array(stableIdSchema).max(3),
    status: z.literal("confirmed"),
  })
  .strict();

export const safetyCodeSchema = z.enum([
  "none",
  "stop_and_find_adult",
  "privacy_input",
  "emotional_distress",
]);

export const spotFeedbackRequestSchema = z
  .object({
    schemaVersion: z.literal("agent-request.v1"),
    requestId: stableIdSchema,
    scene: z.literal("spot_feedback"),
    contentMode: contentModeSchema,
    childAgeBand: childAgeBandSchema,
    contentSnapshotId: stableIdSchema,
    questSnapshotId: stableIdSchema,
    facts: z.array(contentFactSchema).max(20),
    evidence: z.array(evidenceSchema).max(20),
    memory: confirmedMemorySchema.nullable(),
    reportedSafetyCode: safetyCodeSchema.default("none"),
  })
  .strict();

export const nextMoveSchema = z.enum([
  "respond",
  "invite",
  "offer_choice",
  "quiet",
  "end",
  "safety_handoff",
]);

export const safetySchema = z
  .object({
    level: z.enum(["none", "attention", "critical"]),
    code: safetyCodeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const noSafety = value.level === "none" && value.code === "none";
    const hasSafety = value.level !== "none" && value.code !== "none";
    if (!noSafety && !hasSafety) {
      context.addIssue({
        code: "custom",
        message: "Safety level and code must agree",
      });
    }
  });

export const memoryCandidateSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    evidenceRefs: z.array(stableIdSchema).min(1).max(3),
  })
  .strict();

export const memoryKindSchema = z.enum([
  "event",
  "semantic",
  "relationship",
  "growth",
  "reflection",
]);

export const memorySourceTypeSchema = z.enum([
  "user_stated",
  "observed",
  "inferred",
  "guardian_provided",
]);

export const memoryPrivacyLevelSchema = z.enum([
  "ordinary",
  "sensitive",
  "highly_sensitive",
]);

export const memoryGuardianVisibilitySchema = z.enum([
  "summary_visible",
  "safety_only",
  "hidden",
]);

export const memoryStatusSchema = z.enum([
  "active",
  "disputed",
  "deleted",
  "expired",
]);

export const memoryRecordSchema = z
  .object({
    id: stableIdSchema,
    householdId: stableIdSchema,
    childProfileId: stableIdSchema,
    characterInstanceId: stableIdSchema,
    kind: memoryKindSchema,
    text: z.string().trim().min(1).max(300),
    sourceEventIds: z.array(stableIdSchema).min(1).max(5),
    sourceType: memorySourceTypeSchema,
    confidence: z.number().min(0).max(1),
    privacyLevel: memoryPrivacyLevelSchema,
    guardianVisibility: memoryGuardianVisibilitySchema,
    occurredAt: z.string().trim().min(1).max(64),
    retentionUntil: z.string().trim().min(1).max(64),
    status: memoryStatusSchema,
  })
  .strict();

export const memoryProposalSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    evidenceRefs: z.array(stableIdSchema).min(1).max(3),
    requestedSourceType: memorySourceTypeSchema,
    confidence: z.number().min(0).max(1),
    privacyLevel: memoryPrivacyLevelSchema,
    kind: memoryKindSchema,
    guardianVisibility: memoryGuardianVisibilitySchema,
    retentionUntil: z.string().trim().min(1).max(64),
  })
  .strict();

export const memoryDecisionSchema = z
  .object({
    status: z.enum(["not_requested", "accepted", "rejected"]),
    reason: z
      .enum([
        "accepted",
        "missing_evidence",
        "media_only_evidence",
        "low_confidence",
        "inferred_not_persisted",
        "sensitive_memory_requires_review",
      ])
      .nullable(),
    recordId: stableIdSchema.nullable(),
  })
  .strict();

export const personalityTraitIdSchema = z.enum([
  "courage",
  "patience",
  "expression",
  "exploration",
  "cultural_connection",
]);

export const personalityTraitSchema = z
  .object({
    traitId: personalityTraitIdSchema,
    value: z.number().min(0).max(1),
  })
  .strict();

export const personalityStateSchema = z
  .object({
    personalityVersion: z.number().int().nonnegative(),
    baselineArchetype: stableIdSchema,
    traits: z.array(personalityTraitSchema).max(5),
    mood: z
      .object({
        valence: z.number().min(0).max(1),
        arousal: z.number().min(0).max(1),
        curiosity: z.number().min(0).max(1),
        fatigue: z.number().min(0).max(1),
      })
      .strict(),
    relationship: z
      .object({
        familiarity: z.number().min(0).max(1),
        trust: z.number().min(0).max(1),
        sharedExperienceCount: z.number().int().nonnegative(),
      })
      .strict(),
    scene: z
      .object({
        quietHours: z.boolean(),
        initiative: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict();

export const personalityDeltaProposalSchema = z
  .object({
    traitId: personalityTraitIdSchema,
    delta: z.number().min(-0.005).max(0.005),
    evidenceEventIds: z.array(stableIdSchema).min(2).max(5),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1).max(240),
  })
  .strict();

export const embodimentCommandSchema = z
  .object({
    state: z.enum([
      "idle",
      "listening",
      "thinking",
      "speaking",
      "reacting",
      "error",
    ]),
    emotionId: z.enum([
      "neutral",
      "happy",
      "curious",
      "thinking",
      "concerned",
      "surprised",
    ]),
    intensity: z.number().min(0).max(1),
    attentionTarget: z.enum(["child", "spot", "none"]),
    speechSync: z.enum(["before", "during", "after", "none"]),
    hapticPattern: z.enum(["none", "soft_short", "double_short", "soft_long"]),
    sfxId: z.enum(["none", "curious_ping", "soft_chime", "success_tone"]),
  })
  .strict();

export const companionInputSchema = z
  .object({
    evidenceId: stableIdSchema,
    type: z.enum(["choice", "verified_transcript"]),
    text: z.string().trim().min(1).max(800),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const companionReplyRequestSchema = z
  .object({
    schemaVersion: z.literal("agent-request.v1"),
    requestId: stableIdSchema,
    scene: z.literal("companion_reply"),
    householdId: stableIdSchema,
    childProfileId: stableIdSchema,
    characterInstanceId: stableIdSchema,
    childAgeBand: childAgeBandSchema,
    locale: z.string().trim().min(2).max(16),
    input: companionInputSchema,
    facts: z.array(contentFactSchema).max(20),
    personality: personalityStateSchema,
    reportedSafetyCode: safetyCodeSchema.default("none"),
  })
  .strict();

export const companionKnowledgeStatusSchema = z.enum([
  "grounded",
  "unknown",
  "not_needed",
]);

export const companionModelOutputSchema = z
  .object({
    scene: z.literal("companion_reply"),
    speechText: z.string().trim().min(1).max(240),
    knowledgeStatus: companionKnowledgeStatusSchema,
    knowledgeRefs: z.array(stableIdSchema).max(2),
    memoryRefs: z.array(stableIdSchema).max(3),
    nextMove: nextMoveSchema,
    memoryProposal: memoryProposalSchema.nullable(),
    safety: safetySchema,
    embodiment: embodimentCommandSchema,
  })
  .strict();

export const companionResultSchema = companionModelOutputSchema.extend({
  schemaVersion: z.literal("agent-response.v1"),
  requestId: stableIdSchema,
  providerName: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(80),
  memoryDecision: memoryDecisionSchema,
});

export const modelDraftOutputSchema = z
  .object({
    scene: z.literal("spot_feedback"),
    speechText: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(stableIdSchema).max(3),
    factRefs: z.array(stableIdSchema).max(1),
    nextMove: nextMoveSchema,
    memoryCandidate: memoryCandidateSchema.nullable(),
    safety: safetySchema,
  })
  .strict();

export const agentResultSchema = modelDraftOutputSchema.extend({
  schemaVersion: z.literal("agent-response.v1"),
  requestId: stableIdSchema,
  providerName: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(80),
});

export type SpotFeedbackRequestInput = z.input<
  typeof spotFeedbackRequestSchema
>;
export type SpotFeedbackRequest = z.output<typeof spotFeedbackRequestSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ContentFact = z.infer<typeof contentFactSchema>;
export type SafetyCode = z.infer<typeof safetyCodeSchema>;
export type ModelDraftOutput = z.infer<typeof modelDraftOutputSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export type MemoryProposal = z.infer<typeof memoryProposalSchema>;
export type MemoryDecision = z.infer<typeof memoryDecisionSchema>;
export type PersonalityState = z.infer<typeof personalityStateSchema>;
export type PersonalityDeltaProposal = z.infer<
  typeof personalityDeltaProposalSchema
>;
export type EmbodimentCommand = z.infer<typeof embodimentCommandSchema>;
export type CompanionReplyRequestInput = z.input<
  typeof companionReplyRequestSchema
>;
export type CompanionReplyRequest = z.output<typeof companionReplyRequestSchema>;
export type CompanionModelOutput = z.infer<typeof companionModelOutputSchema>;
export type CompanionResult = z.infer<typeof companionResultSchema>;
