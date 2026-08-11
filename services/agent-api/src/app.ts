import {
  AgentError,
  runSpotFeedback,
  taihemenBronzeLionsFixture,
  type ModelProvider,
} from "@longlingji/agent-core";
import { ZodError } from "zod";

import { ApiError } from "./api-error.js";
import {
  API_ROUTES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiSuccessBody,
} from "./http-contract.js";

export interface AgentApiDependencies {
  readonly provider: ModelProvider;
  readonly timeoutMs: number;
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function agentErrorStatus(code: AgentError["code"]): number {
  switch (code) {
    case "PROVIDER_TIMEOUT":
      return 504;
    case "PROVIDER_FAILURE":
      return 502;
    case "NO_USABLE_EVIDENCE":
    case "MODEL_OUTPUT_INVALID":
    case "MISSING_REFERENCE":
    case "POLICY_VIOLATION":
      return 422;
  }
}

function visibleErrorBody(
  code: ApiErrorCode,
  message: string,
  issues: readonly string[],
): ApiErrorBody {
  return {
    status: "error",
    error: { code, message, issues: [...issues] },
  };
}

function formatZodIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "$" : issue.path.map(String).join(".");
    return `${path}: ${issue.message}`;
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      visibleErrorBody(error.code, error.message, error.issues),
      error.statusCode,
    );
  }

  if (error instanceof ZodError) {
    return jsonResponse(
      visibleErrorBody(
        "INVALID_REQUEST",
        "Request does not match spotFeedbackRequestSchema",
        formatZodIssues(error),
      ),
      400,
    );
  }

  if (error instanceof AgentError) {
    return jsonResponse(
      visibleErrorBody(error.code, error.message, error.issues),
      agentErrorStatus(error.code),
    );
  }

  const message =
    error instanceof Error ? error.message : "A non-Error value was thrown";
  return jsonResponse(visibleErrorBody("UNEXPECTED_ERROR", message, []), 500);
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new ApiError(400, "INVALID_JSON", message, [], { cause: error });
  }
}

function assertMethod(request: Request, expectedMethod: "GET" | "POST"): void {
  if (request.method !== expectedMethod) {
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      `Expected ${expectedMethod}, received ${request.method}`,
      [],
    );
  }
}

export function createAgentApi(
  dependencies: AgentApiDependencies,
): (request: Request) => Promise<Response> {
  if (!Number.isFinite(dependencies.timeoutMs)) {
    throw new RangeError("Agent API timeoutMs must be finite");
  }
  if (dependencies.timeoutMs <= 0) {
    throw new RangeError("Agent API timeoutMs must be positive");
  }

  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);

      if (url.pathname === API_ROUTES.health) {
        assertMethod(request, "GET");
        return jsonResponse({ status: "ok" }, 200);
      }

      if (url.pathname === API_ROUTES.developmentFixture) {
        assertMethod(request, "GET");
        return jsonResponse(
          { status: "ok", data: taihemenBronzeLionsFixture },
          200,
        );
      }

      if (url.pathname === API_ROUTES.spotFeedback) {
        assertMethod(request, "POST");
        const input = await parseJson(request);
        const result = await runSpotFeedback(input, dependencies.provider, {
          timeoutMs: dependencies.timeoutMs,
        });
        const body: ApiSuccessBody = { status: "ok", data: result };
        return jsonResponse(body, 200);
      }

      throw new ApiError(
        404,
        "ROUTE_NOT_FOUND",
        `No API route exists for ${url.pathname}`,
        [],
      );
    } catch (error: unknown) {
      return errorResponse(error);
    }
  };
}
