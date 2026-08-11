import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { createAgentApi } from "./app.js";
import { createDevelopmentProvider } from "./development-provider.js";
import type { ApiErrorBody } from "./http-contract.js";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 8787;
const AGENT_TIMEOUT_MS = 4_000;
const MAX_REQUEST_BODY_BYTES = 128 * 1024;
const CONSOLE_HTML_PATH = new URL("../public/index.html", import.meta.url);
const CONSOLE_SCRIPT_PATH = new URL("../public/console.js", import.meta.url);

class TransportError extends Error {
  public override readonly name = "TransportError";

  public constructor(
    public readonly statusCode: number,
    public readonly code: "REQUEST_TOO_LARGE" | "UNEXPECTED_ERROR",
    message: string,
  ) {
    super(message);
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new TransportError(
        413,
        "REQUEST_TOO_LARGE",
        `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`,
      );
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function copyRequestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const method = request.method;
  const path = request.url;
  const host = request.headers.host;

  if (method === undefined) {
    throw new TransportError(500, "UNEXPECTED_ERROR", "HTTP method is missing");
  }
  if (path === undefined) {
    throw new TransportError(500, "UNEXPECTED_ERROR", "HTTP URL is missing");
  }
  if (host === undefined) {
    throw new TransportError(400, "UNEXPECTED_ERROR", "Host header is missing");
  }

  const url = new URL(path, `http://${host}`);
  const headers = copyRequestHeaders(request);

  if (["GET", "HEAD"].includes(method)) {
    return new Request(url, { method, headers });
  }

  const body = await readRequestBody(request);
  return new Request(url, { method, headers, body: body.toString("utf8") });
}

async function writeWebResponse(
  response: Response,
  outgoing: ServerResponse,
): Promise<void> {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

function writeTransportError(error: unknown, outgoing: ServerResponse): void {
  const transportError =
    error instanceof TransportError
      ? error
      : new TransportError(
          500,
          "UNEXPECTED_ERROR",
          error instanceof Error ? error.message : "A non-Error value was thrown",
        );

  const body: ApiErrorBody = {
    status: "error",
    error: {
      code: transportError.code,
      message: transportError.message,
      issues: [],
    },
  };
  outgoing.statusCode = transportError.statusCode;
  outgoing.setHeader("content-type", "application/json; charset=utf-8");
  outgoing.end(JSON.stringify(body));
}

const handleApiRequest = createAgentApi({
  provider: createDevelopmentProvider(),
  timeoutMs: AGENT_TIMEOUT_MS,
});

const server = createServer((request, response) => {
  void (async () => {
    const path = request.url;
    if (request.method === "GET" && path === "/") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(await readFile(CONSOLE_HTML_PATH));
      return;
    }
    if (request.method === "GET" && path === "/console.js") {
      response.setHeader("content-type", "text/javascript; charset=utf-8");
      response.end(await readFile(CONSOLE_SCRIPT_PATH));
      return;
    }

    const webRequest = await toWebRequest(request);
    await writeWebResponse(await handleApiRequest(webRequest), response);
  })().catch((error: unknown) => writeTransportError(error, response));
});

server.listen(SERVER_PORT, SERVER_HOST, () => {
  process.stdout.write(
    `Longlingji Agent development console: http://${SERVER_HOST}:${SERVER_PORT}\n`,
  );
});
