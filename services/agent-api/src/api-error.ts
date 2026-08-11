import type { ApiErrorCode } from "./http-contract.js";

export class ApiError extends Error {
  public override readonly name = "ApiError";

  public constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly issues: readonly string[],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
