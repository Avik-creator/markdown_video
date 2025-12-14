import type { Metadata } from "next"
import { VideoEditor } from "@/components/video-editor/video-editor"
import { redis } from "@/lib/redis"

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

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ md?: string; project?: string; embed?: string }>
}) {
  const params = await searchParams;
  let initialMarkdown = "";
  const isEmbed = params.embed === "true";

  // Handle base64 encoded markdown
  if (params.md) {
    try {
      initialMarkdown = decodeURIComponent(Buffer.from(params.md, "base64").toString("utf-8"));
    } catch {
      // Invalid base64, ignore
    }
  }

  // Handle Redis project ID
  if (params.project && params.project !== "too-large") {
    try {
      const key = `project:${params.project}`;
      const redisMarkdown = await redis.get<string>(key);
      if (redisMarkdown) {
        initialMarkdown = redisMarkdown;
      }
    } catch (error) {
      console.error("Error fetching from Redis:", error);
    }
  }

  return <VideoEditor initialMarkdown={initialMarkdown} isEmbed={isEmbed} />
}
