import type {
  ModelGenerationRequest,
  ModelProvider,
  ModelProviderOptions,
} from "../model-provider.js";

export interface MockProviderConfig {
  readonly response:
    | unknown
    | ((request: ModelGenerationRequest) => unknown | Promise<unknown>);
  readonly delayMs?: number;
  readonly name?: string;
}

async function waitForDelay(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const handle = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = (): void => {
      clearTimeout(handle);
      reject(new Error("PROVIDER_ABORTED"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class MockProvider implements ModelProvider {
  public readonly name: string;
  public readonly calls: ModelGenerationRequest[] = [];

  public constructor(private readonly config: MockProviderConfig) {
    this.name = config.name ?? "mock-provider";
  }

  public async generate(
    request: ModelGenerationRequest,
    options: ModelProviderOptions,
  ): Promise<unknown> {
    this.calls.push(request);
    await waitForDelay(this.config.delayMs ?? 0, options.signal);
    return typeof this.config.response === "function"
      ? this.config.response(request)
      : this.config.response;
  }
}
