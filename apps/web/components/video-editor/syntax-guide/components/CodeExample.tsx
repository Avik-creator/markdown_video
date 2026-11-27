"use client"

import { useState } from "react"
import { Button } from "@components/ui/button"
import { Copy, Check } from "lucide-react"

export function CodeExample({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg bg-surface dark:bg-surface border border-border dark:border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-panel dark:bg-panel border-b border-border dark:border-border">
        <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 text-xs font-mono text-foreground dark:text-foreground overflow-x-auto bg-surface dark:bg-surface">
        <code>{code}</code>
      </pre>
    </div>
  )
}
