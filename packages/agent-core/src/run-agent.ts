import {
  agentResultSchema,
  modelDraftOutputSchema,
  spotFeedbackRequestSchema,
  type AgentResult,
  type SpotFeedbackRequestInput,
} from "./contracts.js";
import { buildModelContext } from "./context-builder.js";
import { buildFallbackResult, buildSafetyResult } from "./fallback.js";
import type { ModelProvider } from "./model-provider.js";
import { detectInputSafety, validateDraftPolicy } from "./policy.js";
import {
  buildSpotFeedbackGenerationRequest,
  SPOT_FEEDBACK_PROMPT_VERSION,
} from "./prompts/spot-feedback.js";

export interface RunAgentOptions {
  readonly timeoutMs?: number;
}

async function generateWithTimeout(
  provider: ModelProvider,
  timeoutMs: number,
  request: ReturnType<typeof buildSpotFeedbackGenerationRequest>,
): Promise<unknown> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("PROVIDER_TIMEOUT"));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      provider.generate(request, { signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function runSpotFeedback(
  input: SpotFeedbackRequestInput,
  provider: ModelProvider,
  options: RunAgentOptions = {},
): Promise<AgentResult> {
  // Contract errors are programming/integration errors and should fail loudly.
  const request = spotFeedbackRequestSchema.parse(input);
  const safetyCode = detectInputSafety(request);
  if (safetyCode !== "none") {
    return buildSafetyResult(request, safetyCode);
  }

  const context = buildModelContext(request);
  if (context.evidence.length === 0) {
    return buildFallbackResult(request, context, "no_usable_evidence");
  }

  const generationRequest = buildSpotFeedbackGenerationRequest(context);
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number");
  }
  let rawOutput: unknown;
  try {
    rawOutput = await generateWithTimeout(
      provider,
      timeoutMs,
      generationRequest,
    );
  } catch (error: unknown) {
    const reason =
      error instanceof Error && error.message === "PROVIDER_TIMEOUT"
        ? "provider_timeout"
        : "provider_error";
    return buildFallbackResult(request, context, reason);
  }

  const parsedDraft = modelDraftOutputSchema.safeParse(rawOutput);
  if (!parsedDraft.success) {
    return buildFallbackResult(request, context, "invalid_output");
  }

  const policyResult = validateDraftPolicy(parsedDraft.data, context);
  if (!policyResult.ok) {
    return buildFallbackResult(request, context, policyResult.reason);
  }

  return agentResultSchema.parse({
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    providerName: provider.name,
    promptVersion: SPOT_FEEDBACK_PROMPT_VERSION,
    fallbackUsed: false,
    fallbackReason: "none",
    ...parsedDraft.data,
  });
}
