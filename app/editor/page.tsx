import type { Metadata } from "next"
import { headers } from "next/headers"
import { VideoEditor } from "@components/video-editor/video-editor"
import { ShareLinkError, type ShareLinkErrorKind } from "@components/video-editor/share-link-error"
import { ShareProjectGate } from "@components/video-editor/share-project-gate"
import { enforceProjectReadRateLimit } from "@/lib/rate-limit"
import { parseProjectMarkdown } from "@/lib/project-storage"
import { redis } from "@/lib/redis"
import { decodeShareMarkdownPayload } from "@/lib/share-link"

export const metadata: Metadata = {
  title: "Editor",
  description:
    "Create and edit markdown videos with a powerful visual editor. Add scenes, animations, code blocks, and export to video.",
  openGraph: {
    title: "Markdown Video Editor",
    description: "Create and edit markdown videos with a powerful visual editor.",
  },
  twitter: {
    title: "Markdown Video Editor",
    description: "Create and edit markdown videos with a powerful visual editor.",
  },
}

type EditorSearchParams = {
  md?: string | string[]
  project?: string | string[]
  embed?: string | string[]
}

type ShareResolution =
  | { status: "none" }
  | { status: "ready"; markdown: string }
  | { status: "error"; kind: ShareLinkErrorKind }

// Project IDs are generated as randomBytes(8).toString("base64url").
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

async function resolveSharedMarkdown(mdParam: string | undefined, projectParam: string | undefined): Promise<ShareResolution> {
  let sharedMarkdown: string | null = null

  if (mdParam !== undefined) {
    const decoded = decodeShareMarkdownPayload(mdParam)
    if (!decoded.ok) {
      return { status: "error", kind: "invalid-markdown" }
    }
    sharedMarkdown = decoded.markdown
  }

  if (projectParam !== undefined) {
    if (projectParam === "too-large") {
      return { status: "error", kind: "legacy-too-large" }
    }

    if (!PROJECT_ID_PATTERN.test(projectParam)) {
      return { status: "error", kind: "project-not-found" }
    }

    // Valid-shaped project IDs hit the same shared project lookup budget as
    // /api/projects before touching Redis. Malformed IDs return above without
    // reading request headers or consuming any of that budget, and ordinary
    // editor visits never enter this branch. Project storage and distributed
    // rate limiting use the same Redis dependency, so a rate-limit failure is
    // surfaced as temporary project unavailability rather than bypassed.
    // Keep the framework's headers() call outside try/catch so any rendering
    // control-flow exception retains Next.js semantics. Rate-limit enforcement
    // itself handles expected Redis failures by returning a 503 Response; this
    // catch is only a defense against unexpected implementation errors.
    const requestHeaders = await headers()
    try {
      const rateLimitResponse = await enforceProjectReadRateLimit({ headers: requestHeaders })
      if (rateLimitResponse) {
        return { status: "error", kind: "project-unavailable" }
      }
    } catch (error) {
      console.error("Error rate limiting shared project lookup:", error)
      return { status: "error", kind: "project-unavailable" }
    }

    try {
      // The Upstash client auto-deserializes JSON, so stored values may be the
      // versioned wrapper object, a legacy plain string, or a corrupted scalar;
      // parseProjectMarkdown normalizes all three (see lib/project-storage).
      const storedValue = await redis.get(`project:${projectParam}`)
      const parsedMarkdown = parseProjectMarkdown(storedValue)
      if (parsedMarkdown === null) {
        return { status: "error", kind: "project-not-found" }
      }
      sharedMarkdown = parsedMarkdown
    } catch (error) {
      console.error("Error fetching shared project from Redis:", error)
      return { status: "error", kind: "project-unavailable" }
    }
  }

  if (sharedMarkdown !== null) {
    return { status: "ready", markdown: sharedMarkdown }
  }

  return { status: "none" }
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<EditorSearchParams>
}) {
  const params = await searchParams
  const isEmbed = firstSearchParam(params.embed) === "true"
  const shareResolution = await resolveSharedMarkdown(firstSearchParam(params.md), firstSearchParam(params.project))

  if (shareResolution.status === "error") {
    return <ShareLinkError kind={shareResolution.kind} isEmbed={isEmbed} />
  }

  if (shareResolution.status === "ready") {
    return <ShareProjectGate initialMarkdown={shareResolution.markdown} isEmbed={isEmbed} />
  }

  return <VideoEditor isEmbed={isEmbed} />
}
