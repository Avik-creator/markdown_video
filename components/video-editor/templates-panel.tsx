"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Play, Sparkles, Code, Monitor, LogOut, Settings } from "lucide-react"
import { TEMPLATES } from "@/lib/templates"
import type { Template } from "@/lib/types"
import { useVideoStore } from "@/lib/use-video-store"
import { cn } from "@/lib/utils"

interface TemplatesPanelProps {
  onClose: () => void
}

const categoryIcons = {
  intro: Sparkles,
  tutorial: Code,
  demo: Monitor,
  outro: LogOut,
  custom: Settings,
}

const categoryColors = {
  intro: "text-pink-400 bg-pink-500/10",
  tutorial: "text-emerald-400 bg-emerald-500/10",
  demo: "text-blue-400 bg-blue-500/10",
  outro: "text-amber-400 bg-amber-500/10",
  custom: "text-purple-400 bg-purple-500/10",
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const Icon = categoryIcons[template.category]
  const colorClass = categoryColors[template.category]

  return (
    <div className="bg-[#1a1a24] rounded-lg border border-white/10 overflow-hidden hover:border-white/20 transition-colors group">
      {/* Preview gradient */}
      <div className="h-20 bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={cn("w-8 h-8 opacity-30", colorClass.split(" ")[0])} />
        </div>
        <div className="absolute bottom-2 left-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-full", colorClass)}>{template.category}</span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-white mb-1">{template.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>

        <Button
          size="sm"
          onClick={onSelect}
          className="w-full gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10"
        >
          <Play className="w-3 h-3" />
          Use Template
        </Button>
      </div>
    </div>
  )
}

export function TemplatesPanel({ onClose }: TemplatesPanelProps) {
  const setMarkdown = useVideoStore((state) => state.setMarkdown)
  const [activeCategory, setActiveCategory] = useState<Template["category"] | "all">("all")

  const filteredTemplates =
    activeCategory === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.category === activeCategory)

  const handleSelectTemplate = (template: Template) => {
    setMarkdown(template.markdown)
    onClose()
  }

  return (
    <div className="w-96 bg-[#0f0f14] border-l border-white/10 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <h2 className="font-semibold text-white">Templates</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Category filter */}
      <div className="p-3 border-b border-white/10 flex gap-1 flex-wrap shrink-0">
        {["all", "intro", "tutorial", "demo", "outro", "custom"].map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant="ghost"
            onClick={() => setActiveCategory(cat as Template["category"] | "all")}
            className={cn(
              "text-xs h-7 capitalize",
              activeCategory === cat ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white",
            )}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} onSelect={() => handleSelectTemplate(template)} />
          ))}
        </div>
      </div>
    </div>
  )
}
