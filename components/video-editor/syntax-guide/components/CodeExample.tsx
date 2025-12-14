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
    <div className="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800">
        <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 text-xs font-mono text-gray-900 dark:text-neutral-100 overflow-x-auto bg-gray-50 dark:bg-neutral-900">
        <code>{code}</code>
      </pre>
    </div>
  )
}
