import {
  MockProvider,
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
    });

    const response = await api(
      new Request(`${API_BASE_URL}${API_ROUTES.health}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("runs spot feedback through the HTTP contract", async () => {
    const provider = createDevelopmentProvider();
    const api = createAgentApi({ provider, timeoutMs: 100 });

    const response = await api(
      postRequest(JSON.stringify(taihemenBronzeLionsFixture)),
    );
    const body = apiSuccessSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.data.providerName).toBe("development-provider");
    expect(body.data.requestId).toBe(taihemenBronzeLionsFixture.requestId);
    expect(provider.calls).toHaveLength(1);
  });

  it("exposes malformed JSON instead of replacing it", async () => {
    const api = createAgentApi({
      provider: createDevelopmentProvider(),
      timeoutMs: 100,
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
    const api = createAgentApi({ provider, timeoutMs: 100 });

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
    const api = createAgentApi({ provider, timeoutMs: 100 });

    const response = await api(
      postRequest(JSON.stringify(taihemenBronzeLionsFixture)),
    );
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("PROVIDER_FAILURE");
    expect(body.error.message).toBe("MODEL_UPSTREAM_UNAVAILABLE");
    expect(provider.calls).toHaveLength(1);
  });
});
