import { z } from "zod";

const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._@-]*$/u, "ID must be stable ASCII");

export const agentSceneSchema = z.enum([
  "spot_feedback",
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
