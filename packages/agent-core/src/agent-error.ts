export const AGENT_ERROR_CODES = [
  "NO_USABLE_EVIDENCE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_FAILURE",
  "MODEL_OUTPUT_INVALID",
  "MISSING_REFERENCE",
  "POLICY_VIOLATION",
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

export class AgentError extends Error {
  public override readonly name = "AgentError";

  public constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly issues: readonly string[],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
