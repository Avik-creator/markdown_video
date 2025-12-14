import React from "react"

export function highlightSyntax(line: string, language: string): React.ReactNode {
  const keywords = [
    "import",
    "export",
    "from",
    "const",
    "let",
    "var",
    "function",
    "async",
    "await",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "interface",
    "type",
    "new",
    "this",
    "true",
    "false",
    "null",
    "undefined",
  ]

  if (line.trim().startsWith("//")) {
    return <span className="text-emerald-400/70 italic">{line}</span>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const stringRegex = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g
  let match
  let keyCounter = 0

  while ((match = stringRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const keywordPart = highlightKeywords(line.slice(lastIndex, match.index), keywords)
      // Extract children if it's a fragment, otherwise use as-is
      const children = React.isValidElement(keywordPart) && keywordPart.type === React.Fragment
        ? React.Children.toArray((keywordPart as React.ReactElement<{ children?: React.ReactNode }>).props.children)
        : [keywordPart]

      children.forEach((child, idx) => {
        if (React.isValidElement(child)) {
          parts.push(React.cloneElement(child, { key: `syntax-${keyCounter++}-${idx}` }))
        } else {
          parts.push(
            <span key={`syntax-${keyCounter++}-${idx}`}>{child}</span>
          )
        }
      })
    }
    parts.push(
      <span key={`string-${keyCounter++}`} className="text-amber-300">
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    const keywordPart = highlightKeywords(line.slice(lastIndex), keywords)
    // Extract children if it's a fragment, otherwise use as-is
    const children = React.isValidElement(keywordPart) && keywordPart.type === React.Fragment
      ? React.Children.toArray((keywordPart as React.ReactElement<{ children?: React.ReactNode }>).props.children)
      : [keywordPart]

    children.forEach((child, idx) => {
      if (React.isValidElement(child)) {
        parts.push(React.cloneElement(child, { key: `syntax-${keyCounter++}-${idx}` }))
      } else {
        parts.push(
          <span key={`syntax-${keyCounter++}-${idx}`}>{child}</span>
        )
      }
    })
  }

  return parts.length > 0 ? <>{parts}</> : highlightKeywords(line, keywords)
}

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g")
  let lastIndex = 0
  let match
  let keyCounter = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index)
      if (textPart) {
        parts.push(
          <span key={`text-${keyCounter++}`}>{textPart}</span>
        )
      }
    }
    parts.push(
      <span key={`keyword-${keyCounter++}`} className="text-purple-400 font-medium">
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const textPart = text.slice(lastIndex)
    if (textPart) {
      parts.push(
        <span key={`text-${keyCounter++}`}>{textPart}</span>
      )
    }
  }

  return parts.length > 0 ? <>{parts}</> : <span key="text-fallback">{text}</span>
}
