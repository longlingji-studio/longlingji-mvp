import {
  modelDraftOutputSchema,
  spotFeedbackRequestSchema,
  type AgentResult,
} from "./contracts.js";
import { AgentError } from "./agent-error.js";
import { buildModelContext } from "./context-builder.js";
import type { ModelProvider } from "./model-provider.js";
import { detectInputSafety, validateDraftPolicy } from "./policy.js";
import {
  buildSpotFeedbackGenerationRequest,
  SPOT_FEEDBACK_PROMPT_VERSION,
} from "./prompts/spot-feedback.js";
import { buildSafetyResult } from "./safety-response.js";

export interface RunAgentOptions {
  readonly timeoutMs: number;
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
      reject(
        new AgentError(
          "PROVIDER_TIMEOUT",
          `Model provider exceeded ${timeoutMs} ms`,
          [],
        ),
      );
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
  input: unknown,
  provider: ModelProvider,
  options: RunAgentOptions,
): Promise<AgentResult> {
  // Contract errors are programming/integration errors and should fail loudly.
  const request = spotFeedbackRequestSchema.parse(input);
  const safetyCode = detectInputSafety(request);
  if (safetyCode !== "none") {
    return buildSafetyResult(request, safetyCode);
  }

  const context = buildModelContext(request);
  if (context.evidence.length === 0) {
    throw new AgentError(
      "NO_USABLE_EVIDENCE",
      "No verified evidence is available for spot feedback",
      [],
    );
  }

  const generationRequest = buildSpotFeedbackGenerationRequest(context);
  const timeoutMs = options.timeoutMs;
  if (!Number.isFinite(timeoutMs)) {
    throw new RangeError("timeoutMs must be finite");
  }
  if (timeoutMs <= 0) {
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
    if (error instanceof AgentError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Provider threw a non-Error value";
    throw new AgentError(
      "PROVIDER_FAILURE",
      message,
      [],
      { cause: error },
    );
  }

  const parsedDraft = modelDraftOutputSchema.safeParse(rawOutput);
  if (!parsedDraft.success) {
    throw new AgentError(
      "MODEL_OUTPUT_INVALID",
      "Model output does not match modelDraftOutputSchema",
      parsedDraft.error.issues.map((issue) => {
        const path = issue.path.length === 0 ? "$" : issue.path.map(String).join(".");
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const policyResult = validateDraftPolicy(parsedDraft.data, context);
  if (!policyResult.ok) {
    const code =
      policyResult.reason === "missing_reference"
        ? "MISSING_REFERENCE"
        : "POLICY_VIOLATION";
    throw new AgentError(code, policyResult.issues.join("; "), policyResult.issues);
  }

  return {
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    providerName: provider.name,
    promptVersion: SPOT_FEEDBACK_PROMPT_VERSION,
    ...parsedDraft.data,
  };
}
