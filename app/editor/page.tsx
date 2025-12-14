import type { Metadata } from "next"
import { VideoEditor } from "@/components/video-editor/video-editor"

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

export default function EditorPage() {
  return <VideoEditor />
}
