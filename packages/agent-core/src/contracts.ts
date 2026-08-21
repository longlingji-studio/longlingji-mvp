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
    source: z
      .object({
        sourceId: stableIdSchema,
        title: z.string().trim().min(1).max(240),
        url: z.string().url().max(500),
        verifiedAt: z.string().datetime({ offset: true }),
        knowledgeVersion: stableIdSchema,
      })
      .strict(),
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

export const safetyLevelSchema = z.enum(["S0", "S1", "S2", "S3", "S4"]);

export const safetyCodeSchema = z.enum([
  "none",
  "emotional_distress",
  "quiet_hours_boundary",
  "environment_risk",
  "privacy_input",
  "private_image",
  "lost_child",
  "stranger_danger",
  "family_violence",
  "self_harm",
  "medical_emergency",
]);

const safetyLevelByCode = {
  none: "S0",
  emotional_distress: "S1",
  quiet_hours_boundary: "S1",
  environment_risk: "S2",
  privacy_input: "S3",
  private_image: "S3",
  lost_child: "S4",
  stranger_danger: "S4",
  family_violence: "S4",
  self_harm: "S4",
  medical_emergency: "S4",
} as const;

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
    reportedSafetyCode: safetyCodeSchema,
  })
  .strict();

export const primaryMoveSchema = z.enum([
  "respond",
  "answer",
  "invite",
  "offer_choice",
  "quiet",
  "end",
  "safety_handoff",
]);

export const safetySchema = z
  .object({
    level: safetyLevelSchema,
    code: safetyCodeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (safetyLevelByCode[value.code] !== value.level) {
      context.addIssue({
        code: "custom",
        message: "Safety level must match the declared safety code",
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
    occurredAt: z.string().datetime({ offset: true }),
    retentionUntil: z.string().datetime({ offset: true }),
    status: memoryStatusSchema,
  })
  .strict();

const memoryProposalBaseSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    evidenceRefs: z.array(stableIdSchema).min(1).max(3),
    requestedSourceType: memorySourceTypeSchema,
    confidence: z.number().min(0).max(1),
    privacyLevel: memoryPrivacyLevelSchema,
    kind: memoryKindSchema,
    guardianVisibility: memoryGuardianVisibilitySchema,
    retentionUntil: z.string().datetime({ offset: true }),
  })
  .strict();

export const memoryProposalSchema = z.discriminatedUnion("operation", [
  memoryProposalBaseSchema.extend({
    operation: z.literal("create"),
    replacesMemoryId: z.null(),
  }),
  memoryProposalBaseSchema.extend({
    operation: z.literal("replace"),
    replacesMemoryId: stableIdSchema,
  }),
]);

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
        "source_type_not_allowed",
        "memory_requires_confirmation",
        "replace_target_not_found",
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
    confirmedByChild: z.boolean(),
  })
  .strict();

export const capabilitySnapshotSchema = z
  .object({
    camera: z.boolean(),
    microphone: z.boolean(),
    location: z.boolean(),
    network: z.boolean(),
    knowledgeRetrieval: z.boolean(),
    memory: z.boolean(),
  })
  .strict();

export const interactionContextSchema = z
  .object({
    isPublic: z.boolean(),
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
    interaction: interactionContextSchema,
    capabilities: capabilitySnapshotSchema,
    reportedSafetyCode: safetyCodeSchema,
  })
  .strict();

export const companionKnowledgeStatusSchema = z.enum(["K0", "K1", "K2", "K3", "K4"]);

export const emotionStateSchema = z.enum([
  "initial_awakening",
  "curious",
  "surprised",
  "quiet_companionship",
  "confused_correction",
  "focused_guardianship",
  "reunion",
]);

export const companionModelOutputSchema = z
  .object({
    scene: z.literal("companion_reply"),
    speechText: z.string().trim().min(1).max(240),
    knowledgeStatus: companionKnowledgeStatusSchema,
    knowledgeRefs: z.array(stableIdSchema).max(2),
    observedEvidenceRefs: z.array(stableIdSchema).max(1),
    memoryRefs: z.array(stableIdSchema).max(1),
    primaryMove: primaryMoveSchema,
    emotionState: emotionStateSchema,
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
  sourceTrace: z
    .array(
      z
        .object({
          factId: stableIdSchema,
          sourceId: stableIdSchema,
          title: z.string().trim().min(1).max(240),
          url: z.string().url().max(500),
          verifiedAt: z.string().datetime({ offset: true }),
          knowledgeVersion: stableIdSchema,
        })
        .strict(),
    )
    .max(2),
  capabilityCheck: capabilitySnapshotSchema,
});

export const modelDraftOutputSchema = z
  .object({
    scene: z.literal("spot_feedback"),
    speechText: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(stableIdSchema).max(3),
    factRefs: z.array(stableIdSchema).max(1),
    primaryMove: primaryMoveSchema,
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
export type SafetyLevel = z.infer<typeof safetyLevelSchema>;
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
export type CapabilitySnapshot = z.infer<typeof capabilitySnapshotSchema>;
export type CompanionReplyRequestInput = z.input<
  typeof companionReplyRequestSchema
>;
export type CompanionReplyRequest = z.output<typeof companionReplyRequestSchema>;
export type CompanionModelOutput = z.infer<typeof companionModelOutputSchema>;
export type CompanionResult = z.infer<typeof companionResultSchema>;
