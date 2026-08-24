"use client"

import { useState } from "react"
import { Button } from "@components/ui/button"
import { X, Play, Sparkles, Code, Monitor, LogOut, Settings, LayoutTemplate } from "lucide-react"
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

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const Icon = categoryIcons[template.category]

  return (
    <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden hover:border-gray-300 dark:hover:border-neutral-700 transition-colors group">
      {/* Preview area */}
      <div className="h-16 bg-white dark:bg-neutral-950 relative overflow-hidden border-b border-gray-200 dark:border-neutral-800">
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-6 h-6 text-gray-400 dark:text-neutral-600" />
        </div>
        <div className="absolute bottom-2 left-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 capitalize">
            {template.category}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-neutral-100 mb-1">{template.name}</h3>
        <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-2 mb-3">{template.description}</p>

        <Button
          size="sm"
          variant="outline"
          onClick={onSelect}
          className="w-full gap-2"
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
    <div className="w-80 bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-neutral-100">Templates</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Category filter */}
      <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex gap-1 flex-wrap shrink-0">
        {["all", "intro", "tutorial", "demo", "outro", "custom"].map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant="ghost"
            onClick={() => setActiveCategory(cat as Template["category"] | "all")}
            className={cn(
              "text-xs h-7 capitalize",
              activeCategory === cat 
                ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100" 
                : "text-gray-500 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800",
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
