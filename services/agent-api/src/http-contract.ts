import {
  AGENT_ERROR_CODES,
  agentResultSchema,
} from "@longlingji/agent-core";
import { z } from "zod";

export const API_ROUTES = {
  health: "/api/v1/health",
  developmentFixture: "/api/v1/development/spot-feedback-fixture",
  spotFeedback: "/api/v1/agent/spot-feedback",
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
    data: agentResultSchema,
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
