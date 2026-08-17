import {
  companionModelOutputSchema,
  companionReplyRequestSchema,
  companionResultSchema,
  type MemoryDecision,
  type CompanionResult,
} from "./contracts.js";
import { AgentError } from "./agent-error.js";
import { buildCompanionModelContext } from "./companion-context.js";
import type { ModelProvider } from "./model-provider.js";
import {
  buildCompanionReplyGenerationRequest,
  COMPANION_REPLY_PROMPT_VERSION,
} from "./prompts/companion-reply.js";
import { detectTextSafety } from "./policy.js";
import { validateCompanionDraftPolicy } from "./companion-policy.js";
import {
  admitMemoryProposal,
  type MemoryStore,
} from "./memory-store.js";
import { buildCompanionSafetyResult } from "./safety-response.js";

export interface RunCompanionOptions {
  readonly timeoutMs: number;
  readonly memoryStore: MemoryStore;
  readonly occurredAt: string;
  readonly createMemoryId: () => string;
}

async function generateWithTimeout(
  provider: ModelProvider,
  timeoutMs: number,
  request: ReturnType<typeof buildCompanionReplyGenerationRequest>,
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

function assertTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs)) {
    throw new RangeError("timeoutMs must be finite");
  }
  if (timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be positive");
  }
}

function providerFailure(error: unknown): AgentError {
  const message =
    error instanceof Error ? error.message : "Provider threw a non-Error value";
  return new AgentError("PROVIDER_FAILURE", message, [], { cause: error });
}

export async function runCompanionReply(
  input: unknown,
  provider: ModelProvider,
  options: RunCompanionOptions,
): Promise<CompanionResult> {
  assertTimeout(options.timeoutMs);
  const request = companionReplyRequestSchema.parse(input);
  const safetyCode = detectTextSafety(
    request.input.text,
    request.reportedSafetyCode,
  );
  if (safetyCode !== "none") {
    return buildCompanionSafetyResult(request, safetyCode);
  }

  if (request.input.type === "verified_transcript") {
    if (request.input.confidence === undefined) {
      throw new AgentError(
        "NO_USABLE_EVIDENCE",
        "Verified transcript confidence is missing",
        [],
      );
    }
    if (request.input.confidence < 0.85) {
      throw new AgentError(
        "NO_USABLE_EVIDENCE",
        "Verified transcript confidence is below 0.85",
        [],
      );
    }
  }

  const recalledMemories = options.memoryStore.recall({
    householdId: request.householdId,
    childProfileId: request.childProfileId,
    characterInstanceId: request.characterInstanceId,
    text: request.input.text,
    limit: 8,
  });
  const context = buildCompanionModelContext(request, recalledMemories);
  const generationRequest = buildCompanionReplyGenerationRequest(context);
  let rawOutput: unknown;
  try {
    rawOutput = await generateWithTimeout(
      provider,
      options.timeoutMs,
      generationRequest,
    );
  } catch (error: unknown) {
    if (error instanceof AgentError) {
      throw error;
    }
    throw providerFailure(error);
  }

  const parsedDraft = companionModelOutputSchema.safeParse(rawOutput);
  if (!parsedDraft.success) {
    throw new AgentError(
      "MODEL_OUTPUT_INVALID",
      "Model output does not match companionModelOutputSchema",
      parsedDraft.error.issues.map((issue) => {
        const path = issue.path.length === 0 ? "$" : issue.path.map(String).join(".");
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const policyResult = validateCompanionDraftPolicy(parsedDraft.data, context);
  if (!policyResult.ok) {
    const code =
      policyResult.reason === "missing_reference"
        ? "MISSING_REFERENCE"
        : "POLICY_VIOLATION";
    throw new AgentError(code, policyResult.issues.join("; "), policyResult.issues);
  }

  let memoryDecision: MemoryDecision = {
    status: "not_requested",
    reason: null,
    recordId: null,
  };
  if (parsedDraft.data.memoryProposal !== null) {
    const evidence =
      request.input.confidence === undefined
        ? {
            id: request.input.evidenceId,
            type: request.input.type,
            verification: "verified" as const,
            value: request.input.text,
          }
        : {
            id: request.input.evidenceId,
            type: request.input.type,
            verification: "verified" as const,
            value: request.input.text,
            confidence: request.input.confidence,
          };
    const admission = admitMemoryProposal({
      request,
      proposal: parsedDraft.data.memoryProposal,
      evidence: [evidence],
      recordId: options.createMemoryId(),
      occurredAt: options.occurredAt,
    });
    memoryDecision = admission.decision;
    if (admission.record !== null) {
      options.memoryStore.write(admission.record);
    }
  }

  return companionResultSchema.parse({
    schemaVersion: "agent-response.v1",
    requestId: request.requestId,
    providerName: provider.name,
    promptVersion: COMPANION_REPLY_PROMPT_VERSION,
    ...parsedDraft.data,
    memoryDecision,
  });
}
