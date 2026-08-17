import {
  AgentError,
  companionReplyFixture,
  runCompanionReply,
  runQuestProgress,
  runSpotFeedback,
  taihemenBronzeLionsFixture,
  type JourneyCatalogStore,
  type QuestProgressStore,
  type ModelProvider,
} from "@longlingji/agent-core";
import type { MemoryStore } from "@longlingji/agent-core";
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
  readonly memoryStore: MemoryStore;
  readonly journeyStore: JourneyCatalogStore;
  readonly questProgressStore: QuestProgressStore;
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

function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (value === null) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      `Missing query parameter: ${name}`,
      [],
    );
  }
  if (value.length === 0) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      `Query parameter is empty: ${name}`,
      [],
    );
  }
  return value;
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

      if (url.pathname === API_ROUTES.developmentCompanionFixture) {
        assertMethod(request, "GET");
        return jsonResponse(
          { status: "ok", data: companionReplyFixture },
          200,
        );
      }

      if (url.pathname === API_ROUTES.developmentJourneyCatalog) {
        assertMethod(request, "GET");
        const zones = dependencies.journeyStore.listZones();
        const landmarks = zones.flatMap((zone) =>
          dependencies.journeyStore.listLandmarks(zone.id),
        );
        const spots = landmarks.flatMap((landmark) =>
          dependencies.journeyStore.listSpots(landmark.id),
        );
        const quests = spots.flatMap((spot) =>
          dependencies.journeyStore.listQuests(spot.id),
        );
        return jsonResponse(
          { status: "ok", data: { zones, landmarks, spots, quests } },
          200,
        );
      }

      if (url.pathname === API_ROUTES.journeyZones) {
        assertMethod(request, "GET");
        return jsonResponse(
          { status: "ok", data: { items: dependencies.journeyStore.listZones() } },
          200,
        );
      }

      if (url.pathname === API_ROUTES.journeyLandmarks) {
        assertMethod(request, "GET");
        const zoneId = requiredQuery(url, "zoneId");
        return jsonResponse(
          {
            status: "ok",
            data: { items: dependencies.journeyStore.listLandmarks(zoneId) },
          },
          200,
        );
      }

      if (url.pathname === API_ROUTES.journeySpots) {
        assertMethod(request, "GET");
        const landmarkId = requiredQuery(url, "landmarkId");
        return jsonResponse(
          {
            status: "ok",
            data: { items: dependencies.journeyStore.listSpots(landmarkId) },
          },
          200,
        );
      }

      if (url.pathname === API_ROUTES.journeyQuests) {
        assertMethod(request, "GET");
        const spotId = requiredQuery(url, "spotId");
        return jsonResponse(
          {
            status: "ok",
            data: { items: dependencies.journeyStore.listQuests(spotId) },
          },
          200,
        );
      }

      if (url.pathname === API_ROUTES.journeyQuestProgress) {
        assertMethod(request, "POST");
        const input = await parseJson(request);
        const result = runQuestProgress(
          input,
          (questId) => dependencies.journeyStore.getQuest(questId),
          dependencies.questProgressStore,
          new Date().toISOString(),
        );
        return jsonResponse({ status: "ok", data: result }, 200);
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

      if (url.pathname === API_ROUTES.companionReply) {
        assertMethod(request, "POST");
        const input = await parseJson(request);
        const result = await runCompanionReply(input, dependencies.provider, {
          timeoutMs: dependencies.timeoutMs,
          memoryStore: dependencies.memoryStore,
          occurredAt: new Date().toISOString(),
          createMemoryId: () => `memory:api:${crypto.randomUUID()}`,
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
