import {
  InMemoryJourneyCatalogStore,
  InMemoryMemoryStore,
  MockProvider,
  InMemoryQuestProgressStore,
  companionMemoryFixture,
  companionReplyFixture,
  journeyCatalogFixture,
  taihemenBronzeLionsFixture,
} from "@longlingji/agent-core";
import { describe, expect, it } from "vitest";

import { createAgentApi } from "../app.js";
import { createDevelopmentProvider } from "../development-provider.js";
import {
  API_ROUTES,
  apiErrorSchema,
  apiSuccessSchema,
} from "../http-contract.js";

const API_BASE_URL = "http://agent-api.test";

function createMemoryStore(seedFixture = false): InMemoryMemoryStore {
  const store = new InMemoryMemoryStore();
  if (seedFixture) {
    store.write(companionMemoryFixture);
  }
  return store;
}

function createJourneyStore(): InMemoryJourneyCatalogStore {
  return new InMemoryJourneyCatalogStore(journeyCatalogFixture);
}

function postRequest(body: string): Request {
  return new Request(`${API_BASE_URL}${API_ROUTES.spotFeedback}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("Agent API", () => {
  it("returns a visible health response", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.health}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("runs spot feedback through the HTTP contract", async () => {
    const provider = createDevelopmentProvider();
    const api = createAgentApi({
      provider,
      timeoutMs: 100,
      memoryStore: createMemoryStore(true),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(
      postRequest(JSON.stringify(taihemenBronzeLionsFixture)),
    );
    const body = apiSuccessSchema.parse(await response.json());

    expect(response.status).toBe(200);
    if (!("providerName" in body.data)) {
      throw new Error("Expected an Agent result");
    }
    expect(body.data.providerName).toBe("development-provider");
    expect(body.data.requestId).toBe(taihemenBronzeLionsFixture.requestId);
    expect(provider.calls).toHaveLength(1);
  });

  it("exposes malformed JSON instead of replacing it", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(postRequest("{not-json"));
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("exposes missing request fields", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(postRequest(JSON.stringify({ scene: "spot_feedback" })));
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.issues.length).toBeGreaterThan(0);
  });

  it("exposes invalid model output", async () => {
    const provider = new MockProvider({
      response: { answer: "wrong shape" },
      delayMs: 0,
      name: "invalid-output-provider",
    });
    const api = createAgentApi({
      provider,
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(
      postRequest(JSON.stringify(taihemenBronzeLionsFixture)),
    );
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("MODEL_OUTPUT_INVALID");
    expect(provider.calls).toHaveLength(1);
  });

  it("calls a failing provider once and exposes the failure", async () => {
    const provider = new MockProvider({
      response: () => {
        throw new Error("MODEL_UPSTREAM_UNAVAILABLE");
      },
      delayMs: 0,
      name: "failing-provider",
    });
    const api = createAgentApi({
      provider,
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(
      postRequest(JSON.stringify(taihemenBronzeLionsFixture)),
    );
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("PROVIDER_FAILURE");
    expect(body.error.message).toBe("MODEL_UPSTREAM_UNAVAILABLE");
    expect(provider.calls).toHaveLength(1);
  });

  it("runs the companion reply route with grounded memory references", async () => {
    const provider = createDevelopmentProvider();
    const api = createAgentApi({
      provider,
      timeoutMs: 100,
      memoryStore: createMemoryStore(true),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const response = await api(
      new Request(`${API_BASE_URL}/api/v1/agent/companion-reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(companionReplyFixture),
      }),
    );
    const body = apiSuccessSchema.parse(await response.json());

    expect(response.status).toBe(200);
    if (!("scene" in body.data)) {
      throw new Error("Expected a companion result");
    }
    expect(body.data.scene).toBe("companion_reply");
    if (body.data.scene !== "companion_reply") {
      throw new Error("Expected companion reply result");
    }
    expect(body.data.memoryRefs).toEqual(["memory:dev:bronze-lions:001"]);
  });

  it("returns the published journey hierarchy and requires parent query IDs", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });

    const zonesResponse = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.journeyZones}`),
    );
    const zonesBody = apiSuccessSchema.parse(await zonesResponse.json());
    expect(zonesResponse.status).toBe(200);
    expect(zonesBody.data).toEqual({ items: [journeyCatalogFixture.zones[0]] });

    const missingParentResponse = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.journeyLandmarks}`),
    );
    const missingParentBody = apiErrorSchema.parse(
      await missingParentResponse.json(),
    );
    expect(missingParentResponse.status).toBe(400);
    expect(missingParentBody.error.code).toBe("INVALID_REQUEST");
  });

  it("starts and completes a Journey quest through the HTTP contract", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
      memoryStore: createMemoryStore(),
      journeyStore: createJourneyStore(),
      questProgressStore: new InMemoryQuestProgressStore(),
    });
    const baseCommand = {
      schemaVersion: "quest-request.v1",
      householdId: "household:test:001",
      childProfileId: "child:test:001",
      questId: "quest:beijing:taihemen:bronze-lions:observe",
    } as const;

    const startResponse = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.journeyQuestProgress}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...baseCommand, action: "start" }),
      }),
    );
    expect(startResponse.status).toBe(200);

    const submitResponse = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.journeyQuestProgress}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...baseCommand,
          action: "submit",
          evidence: [
            {
              id: "evidence:test:001",
              type: "verified_transcript",
              verification: "verified",
              value: "一只脚下是绣球，一只脚下是幼狮。",
              confidence: 0.99,
            },
          ],
        }),
      }),
    );
    const submitBody = apiSuccessSchema.parse(await submitResponse.json());
    expect(submitResponse.status).toBe(200);
    expect(submitBody.data).toMatchObject({ status: "completed" });
  });
});
