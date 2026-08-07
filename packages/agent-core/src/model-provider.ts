import type { ModelContext } from "./context-builder.js";

export interface ModelGenerationRequest {
  readonly promptVersion: string;
  readonly systemPrompt: string;
  readonly context: ModelContext;
}

export interface ModelProviderOptions {
  readonly signal: AbortSignal;
}

export interface ModelProvider {
  readonly name: string;
  generate(
    request: ModelGenerationRequest,
    options: ModelProviderOptions,
  ): Promise<unknown>;
}
