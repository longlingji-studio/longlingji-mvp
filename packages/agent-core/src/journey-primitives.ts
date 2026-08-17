import { z } from "zod";

export const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._@-]*$/u, "ID must be stable ASCII");

export const contentModeSchema = z.enum(["development_only", "published"]);

export const contentFactSchema = z
  .object({
    id: stableIdSchema,
    text: z.string().trim().min(1).max(500),
    reviewStatus: z.enum(["approved", "draft", "rejected"]),
  })
  .strict();
