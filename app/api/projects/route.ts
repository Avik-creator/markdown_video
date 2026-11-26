import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  enforceProjectReadRateLimit,
  enforceProjectWriteRateLimit,
  type RateLimitRequestLike,
} from "@/lib/rate-limit";
import {
  parseProjectMarkdown,
  serializeProjectMarkdown,
} from "@/lib/project-storage";
import {
  REDIS_CONFIGURATION_MESSAGE,
  isRedisConfigured,
  redis,
} from "@/lib/redis";

const MAX_PROJECT_BODY_BYTES = 1024 * 1024; // 1 MiB
const PROJECT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const RETRY_AFTER_SECONDS = "30";

const createProjectSchema = z.object({
  markdown: z.string().min(1),
});

// Project IDs are generated with randomBytes(8).toString("base64url"), which
// always produces 11 URL-safe characters.
const projectIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

function redisNotConfiguredResponse() {
  return NextResponse.json(
    { error: REDIS_CONFIGURATION_MESSAGE },
    {
      status: 503,
      headers: { "Retry-After": RETRY_AFTER_SECONDS },
    }
  );
}

function redisOperationUnavailableResponse() {
  return NextResponse.json(
    { error: "Project storage is temporarily unavailable" },
    {
      status: 503,
      headers: { "Retry-After": RETRY_AFTER_SECONDS },
    }
  );
}

function requestTooLargeResponse() {
  return NextResponse.json(
    { error: "Request body is too large. The maximum size is 1 MiB." },
    { status: 413 }
  );
}

async function preExecutionErrorResponse(
  request: NextRequest,
  enforceRateLimit: (request: RateLimitRequestLike) => Promise<Response | null>
) {
  if (!isRedisConfigured()) {
    return redisNotConfiguredResponse();
  }

  return enforceRateLimit(request);
}

type RequestBodyResult =
  | { status: "ok"; body: string }
  | { status: "too-large" }
  | { status: "unreadable" };

async function readRequestBodyWithLimit(request: NextRequest): Promise<RequestBodyResult> {
  if (!request.body) {
    return { status: "ok", body: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > MAX_PROJECT_BODY_BYTES) {
        try {
          await reader.cancel("Request body too large");
        } catch {
          // The stream may already have errored; the body is still rejected.
        }
        return { status: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { status: "unreadable" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { status: "ok", body: new TextDecoder().decode(bytes) };
}

export async function POST(request: NextRequest) {
  // Writes use the dedicated per-hour write policy, enforced before any body
  // reading or storage so rejected requests cost no bandwidth or Redis space.
  const preExecutionError = await preExecutionErrorResponse(
    request,
    enforceProjectWriteRateLimit
  );
  if (preExecutionError) {
    return preExecutionError;
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_PROJECT_BODY_BYTES) {
      return requestTooLargeResponse();
    }
  }

  const bodyResult = await readRequestBodyWithLimit(request);
  if (bodyResult.status === "too-large") {
    return requestTooLargeResponse();
  }
  if (bodyResult.status === "unreadable") {
    return NextResponse.json({ error: "Unable to read request body" }, { status: 400 });
  }
  const rawBody = bodyResult.body;

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON in request body" }, { status: 400 });
  }

  const parsedBody = createProjectSchema.safeParse(jsonBody);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Markdown is required" }, { status: 400 });
  }

  // Generate a unique project ID
  const projectId = randomBytes(8).toString("base64url");
  const key = `project:${projectId}`;

  try {
    // Store in Redis with 7 day expiration. The markdown is wrapped in a
    // versioned object so the Upstash client's automatic JSON deserialization
    // round-trips it type-safely even when the document is valid JSON itself
    // (e.g. the entire markdown is `42` or `true`); see lib/project-storage.
    await redis.set(key, serializeProjectMarkdown(parsedBody.data.markdown), {
      ex: PROJECT_TTL_SECONDS,
    });
  } catch (error) {
    console.error("Error storing project in Redis:", error);
    return redisOperationUnavailableResponse();
  }

  return NextResponse.json({ projectId });
}

export async function GET(request: NextRequest) {
  const preExecutionError = await preExecutionErrorResponse(
    request,
    enforceProjectReadRateLimit
  );
  if (preExecutionError) {
    return preExecutionError;
  }

  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  const parsedProjectId = projectIdSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const key = `project:${parsedProjectId.data}`;

  // Fetch as unknown: the Upstash client auto-deserializes JSON, so legacy
  // plain-string writes whose content was valid JSON (e.g. `42`) may come
  // back as non-strings. parseProjectMarkdown normalizes the versioned
  // wrapper, legacy strings, and corrupted scalars into markdown or null.
  let storedValue: unknown;
  try {
    storedValue = await redis.get(key);
  } catch (error) {
    console.error("Error retrieving project from Redis:", error);
    return redisOperationUnavailableResponse();
  }

  const markdown = parseProjectMarkdown(storedValue);
  if (markdown === null) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ markdown });
}
