import { createHash, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    ...headers,
  })
  response.end(body)
}

export async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? ""
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json")
  }

  const declaredLength = Number(request.headers["content-length"])
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, `Request body must not exceed ${maxBytes} bytes`)
  }

  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.byteLength
    if (byteLength > maxBytes) {
      throw new HttpError(413, `Request body must not exceed ${maxBytes} bytes`)
    }
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new HttpError(400, "Malformed JSON request body")
  }
}

function digestSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Compare bearer tokens through fixed-length digests so neither token length
 * nor prefix information determines comparison time.
 */
export function isAuthorizedBearer(
  authorizationHeader: string | undefined,
  sharedSecret: string,
) {
  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader ?? "")
  if (!match) {
    return false
  }
  return timingSafeEqual(digestSecret(match[1]!), digestSecret(sharedSecret))
}
