"use client"

import type React from "react"

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-800 pb-2">{title}</h3>
      {children}
    </div>
  )
}
