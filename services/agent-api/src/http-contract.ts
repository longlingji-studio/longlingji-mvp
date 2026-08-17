import {
  AGENT_ERROR_CODES,
  agentResultSchema,
  companionResultSchema,
  journeyCatalogSchema,
  landmarkSchema,
  questSchema,
  questProgressRecordSchema,
  spotSchema,
  zoneSchema,
} from "@longlingji/agent-core";
import { z } from "zod";

export const API_ROUTES = {
  health: "/api/v1/health",
  developmentFixture: "/api/v1/development/spot-feedback-fixture",
  developmentCompanionFixture: "/api/v1/development/companion-reply-fixture",
  developmentJourneyCatalog: "/api/v1/development/journey-catalog",
  journeyZones: "/api/v1/journey/zones",
  journeyLandmarks: "/api/v1/journey/landmarks",
  journeySpots: "/api/v1/journey/spots",
  journeyQuests: "/api/v1/journey/quests",
  journeyQuestProgress: "/api/v1/journey/quest-progress",
  spotFeedback: "/api/v1/agent/spot-feedback",
  companionReply: "/api/v1/agent/companion-reply",
} as const;

const HTTP_ERROR_CODES = [
  "INVALID_JSON",
  "INVALID_REQUEST",
  "METHOD_NOT_ALLOWED",
  "ROUTE_NOT_FOUND",
  "REQUEST_TOO_LARGE",
  "UNEXPECTED_ERROR",
] as const;

export const API_ERROR_CODES = [
  ...HTTP_ERROR_CODES,
  ...AGENT_ERROR_CODES,
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiSuccessSchema = z
  .object({
    status: z.literal("ok"),
    data: z.union([
      agentResultSchema,
      companionResultSchema,
      journeyCatalogSchema,
      z.object({ items: z.array(zoneSchema) }).strict(),
      z.object({ items: z.array(landmarkSchema) }).strict(),
      z.object({ items: z.array(spotSchema) }).strict(),
      z.object({ items: z.array(questSchema) }).strict(),
      questProgressRecordSchema,
    ]),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    status: z.literal("error"),
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1),
        issues: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type ApiSuccessBody = z.infer<typeof apiSuccessSchema>;
