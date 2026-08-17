import type {
  ModelGenerationRequest,
  ModelProvider,
  ModelProviderOptions,
} from "../model-provider.js";

export interface OpenAICompatibleProviderConfig {
  readonly name: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl: typeof fetch;
}

interface ChatResponse {
  readonly choices: readonly {
    readonly message: {
      readonly content: string;
    };
  }[];
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== "object") {
    return false;
  }
  if (value === null) {
    return false;
  }
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    return false;
  }
  if (choices.length === 0) {
    return false;
  }
  const first = choices[0];
  if (typeof first !== "object") {
    return false;
  }
  if (first === null) {
    return false;
  }
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object") {
    return false;
  }
  if (message === null) {
    return false;
  }
  return typeof (message as { content?: unknown }).content === "string";
}

export class OpenAICompatibleProvider implements ModelProvider {
  public readonly name: string;

  public constructor(private readonly config: OpenAICompatibleProviderConfig) {
    this.name = config.name;
  }

  public async generate(
    request: ModelGenerationRequest,
    options: ModelProviderOptions,
  ): Promise<unknown> {
    const response = await this.config.fetchImpl(this.config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: request.systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              promptVersion: request.promptVersion,
              agentContext: request.context,
            }),
          },
        ],
      }),
      signal: options.signal,
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`MODEL_HTTP_${response.status}:${rawBody}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      throw new Error(`MODEL_RESPONSE_NOT_JSON:${message}`);
    }

    if (!isChatResponse(payload)) {
      throw new Error("MODEL_RESPONSE_SHAPE_INVALID");
    }

    const firstChoice = payload.choices[0];
    if (firstChoice === undefined) {
      throw new Error("MODEL_RESPONSE_SHAPE_INVALID");
    }
    const content = firstChoice.message.content;
    try {
      return JSON.parse(content);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      throw new Error(`MODEL_CONTENT_NOT_JSON:${message}`);
    }
  }
}
