"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@components/ui/button"

export type ShareLinkErrorKind =
  | "invalid-markdown"
  | "project-not-found"
  | "project-unavailable"
  | "rate-limited"
  | "legacy-too-large"

interface ShareLinkErrorProps {
  kind: ShareLinkErrorKind
  isEmbed?: boolean
}

const ERROR_CONTENT: Record<ShareLinkErrorKind, { title: string; description: string }> = {
  "invalid-markdown": {
    title: "This share link is corrupted",
    description:
      "The markdown data in this link is malformed or incomplete, so it was not loaded. Ask the sender to create and send a new link.",
  },
  "project-not-found": {
    title: "Shared project unavailable",
    description:
      "This temporary project has expired or does not exist. Shared projects are kept for 7 days. Ask the sender for a fresh link.",
  },
  "project-unavailable": {
    title: "Could not load the shared project",
    description:
      "Temporary project storage is not responding right now. Try opening the link again later, or ask the sender to export the project instead.",
  },
  "rate-limited": {
    title: "Too many requests",
    description:
      "This shared project link is being opened too frequently right now, so the load was skipped. Wait a few seconds and try the link again.",
  },
  "legacy-too-large": {
    title: "This legacy share link is incomplete",
    description:
      "An older version of Markdown Video created this placeholder when a project was too large. The project itself is not in the link, so ask the sender to create a new one.",
  },
}

export function ShareLinkError({ kind, isEmbed = false }: ShareLinkErrorProps) {
  const content = ERROR_CONTENT[kind]

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4 text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div
        role="alert"
        aria-labelledby="share-link-error-title"
        className={`w-full rounded-xl border border-gray-200 bg-gray-50 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 ${
          isEmbed ? "max-w-sm p-5" : "max-w-md p-8"
        }`}
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 id="share-link-error-title" className="mt-4 font-serif text-xl font-semibold">
          {content.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-neutral-400">{content.description}</p>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-neutral-300">
          Your local project was not changed.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            asChild
            className="border-0 bg-gray-900 text-white hover:bg-gray-800 dark:bg-neutral-100 dark:text-gray-900 dark:hover:bg-neutral-200"
          >
            <Link href="/editor" target={isEmbed ? "_blank" : undefined} rel={isEmbed ? "noreferrer" : undefined}>
              Open your editor
            </Link>
          </Button>
          {!isEmbed && (
            <Button
              asChild
              variant="outline"
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Link href="/">Back to home</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
