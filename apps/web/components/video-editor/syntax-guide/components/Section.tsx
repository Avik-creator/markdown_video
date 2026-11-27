"use client"

import type React from "react"

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground dark:text-foreground border-b border-border dark:border-border pb-2">{title}</h3>
      {children}
    </div>
  )
}
