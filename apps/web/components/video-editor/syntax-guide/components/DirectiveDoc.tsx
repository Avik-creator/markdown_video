"use client"

export function DirectiveDoc({
  directive,
  description,
  options,
}: {
  directive: string
  description: string
  options?: readonly string[]
}) {
  return (
    <div className="space-y-1">
      <code className="text-xs bg-pink-500/10 dark:bg-pink-500/20 px-2 py-1 rounded text-pink-600 dark:text-pink-400 font-mono border border-pink-500/20">{directive}</code>
      <p className="text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed">{description}</p>
      {options && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {options.map((opt) => (
            <span key={opt} className="text-xs bg-surface dark:bg-surface px-2 py-0.5 rounded text-info dark:text-info border border-border dark:border-border font-mono">
              {opt}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
