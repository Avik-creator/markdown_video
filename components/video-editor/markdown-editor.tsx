"use client";
import { useVideoStore } from "@/lib/use-video-store";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { FileText, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import CornerMarkers from "@components/CornerMarkers";

const EXAMPLE_TEMPLATES = {
  intro: `!scene
!text
Welcome to My Video
animation: bounceIn
size: 2xl

!duration 3s
!background #3b82f6
!transition fade`,
  code: `!scene
!code
highlight: 2-4
typing: true
speed: 40
\`\`\`typescript
const greeting = "Hello"
console.log(greeting)
// More code here
\`\`\`

!duration 4s
!background #1e1e2e
!transition slide`,
  text: `!scene
!text
Add your message here
animation: slideUp
size: lg

!duration 3s
!background #8b5cf6`,
  terminal: `!scene
!terminal
$ npm install next
$ npm run dev
> Ready on http://localhost:3000

!duration 5s
!background #0d0d0d
!transition slide`,
  chart: `!scene
!chart type:bar animate:true
React: 85
Vue: 70
Angular: 60

!duration 5s
!background #1e1e2e
!transition fade`,
  mockup: `!scene
!mockup device:iphone

!presenter position:bottom-right
!duration 4s
!background #1a1a24
!transition zoom`,
  particles: `!scene
!text
Celebration Time!
animation: bounceIn
size: 2xl

!particles type:confetti intensity:high
!duration 4s
!background #ec4899
!transition fade`,
};

function getLineClassName(line: string): string {
  const trimmed = line.trim();

  if (trimmed === "---") return "text-orange-400";
  if (trimmed.startsWith("//")) return "text-gray-500 dark:text-neutral-500";
  if (trimmed.startsWith("+") && !trimmed.startsWith("++"))
    return "text-green-400";
  if (
    trimmed.startsWith("-") &&
    !trimmed.startsWith("--") &&
    !trimmed.startsWith("---")
  )
    return "text-red-400";
  if (trimmed.startsWith("!")) return "text-pink-400";
  if (trimmed.startsWith("```")) return "text-emerald-400";
  if (trimmed.startsWith("$") || trimmed.startsWith(">"))
    return "text-cyan-400";
  if (trimmed.includes(":")) return "text-purple-400";

  return "text-gray-400 dark:text-neutral-500";
}

export function MarkdownEditor() {
  const markdown = useVideoStore((state) => state.markdown);
  const setMarkdown = useVideoStore((state) => state.setMarkdown);
  const highlightRange = useVideoStore((state) => state.highlightRange);
  const setHighlightRange = useVideoStore((state) => state.setHighlightRange);
  const [localMarkdown, setLocalMarkdown] = useState(markdown);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMarkdown(localMarkdown);
    }, 500);
    return () => clearTimeout(timeout);
  }, [localMarkdown, setMarkdown]);

  useEffect(() => {
    setLocalMarkdown(markdown);
  }, [markdown]);

  // Scroll to highlighted lines when highlight range changes
  useEffect(() => {
    if (highlightRange && textareaRef.current && lineNumbersRef.current && highlightOverlayRef.current) {
      const lineHeight = 20; // Must match the lineHeight in styles
      const targetScrollTop = (highlightRange.startLine - 1) * lineHeight;
      const containerHeight = textareaRef.current.clientHeight;

      // Scroll to center the highlighted lines in view
      const scrollPosition = Math.max(0, targetScrollTop - containerHeight / 3);

      textareaRef.current.scrollTop = scrollPosition;
      lineNumbersRef.current.scrollTop = scrollPosition;
      highlightOverlayRef.current.scrollTop = scrollPosition;

      // Also set cursor position to the start of the highlighted line
      const lines = localMarkdown.split("\n");
      let charPosition = 0;
      for (let i = 0; i < highlightRange.startLine - 1 && i < lines.length; i++) {
        charPosition += lines[i].length + 1; // +1 for newline
      }

      // Focus and set selection
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charPosition, charPosition);
    }
  }, [highlightRange, localMarkdown]);

  const insertTemplate = (type: keyof typeof EXAMPLE_TEMPLATES) => {
    const template = EXAMPLE_TEMPLATES[type];
    const separator = localMarkdown.trim() ? "\n\n---\n\n" : "";
    const newMarkdown = localMarkdown + separator + template;
    setLocalMarkdown(newMarkdown);

    // Focus textarea after insert
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 0);
  };

  const toggleCommentLines = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = localMarkdown;

    // Get the lines that are selected
    const beforeSelection = text.substring(0, start);
    const selectedText = text.substring(start, end);
    const afterSelection = text.substring(end);

    // Find the start of the first line
    const lineStart = beforeSelection.lastIndexOf("\n") + 1;
    // Find the end of the last line
    const lineEnd =
      afterSelection.indexOf("\n") === -1
        ? text.length
        : end + afterSelection.indexOf("\n");

    const beforeLines = text.substring(0, lineStart);
    const selectedLines = text.substring(lineStart, lineEnd);
    const afterLines = text.substring(lineEnd);

    // Check if all selected lines are commented
    const lines = selectedLines.split("\n");
    const allCommented = lines.every((line) => line.trim().startsWith("//"));

    let newLines: string[];
    if (allCommented) {
      // Uncomment
      newLines = lines.map((line) => {
        const match = line.match(/^(\s*)\/\/\s?(.*)$/);
        return match ? match[1] + match[2] : line;
      });
    } else {
      // Comment
      newLines = lines.map((line) => {
        if (line.trim() === "") return line;
        const match = line.match(/^(\s*)(.*)$/);
        return match ? match[1] + "// " + match[2] : "// " + line;
      });
    }

    const newMarkdown = beforeLines + newLines.join("\n") + afterLines;
    setLocalMarkdown(newMarkdown);

    // Restore selection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = lineStart;
        textareaRef.current.selectionEnd =
          lineStart + newLines.join("\n").length;
      }
    }, 0);
  }, [localMarkdown]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    if (highlightOverlayRef.current && textareaRef.current) {
      highlightOverlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightRange) {
      setHighlightRange(null);
    }
  }, [highlightRange, setHighlightRange]);

  const lines = localMarkdown.split("\n");
  const lineCount = lines.length;

  return (
    <div className="w-80 bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            Editor
          </h2>
          {highlightRange && (
            <button
              onClick={clearHighlight}
              className="flex items-center gap-1 text-xs text-pink-500 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-900/50 hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
            >
              <MousePointerClick className="w-3 h-3" />
              Line {highlightRange.startLine}
              {highlightRange.endLine !== highlightRange.startLine && `-${highlightRange.endLine}`}
              <span className="text-pink-400 dark:text-pink-500">×</span>
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 px-2 py-0.5 rounded">
          {lineCount} lines
        </span>
      </div>

      {/* Quick insert buttons */}
      <div className="p-2 border-b border-gray-200 dark:border-neutral-800 flex gap-2 flex-wrap shrink-0 bg-gray-50/50 dark:bg-neutral-900/50">
        {Object.entries(EXAMPLE_TEMPLATES).map(([key]) => (
          <button
            key={key}
            onClick={() =>
              insertTemplate(key as keyof typeof EXAMPLE_TEMPLATES)
            }
            className={cn(
              "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
              "hover:translate-x-[-2px]"
            )}
          >
            <CornerMarkers />
            <span className="text-sm font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="w-10 bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 overflow-hidden shrink-0 select-none"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="py-3">
            {lines.map((_, i) => {
              const lineNum = i + 1;
              const isHighlighted = highlightRange &&
                lineNum >= highlightRange.startLine &&
                lineNum <= highlightRange.endLine;

              return (
                <div
                  key={i}
                  className={cn(
                    "text-xs font-mono text-right pr-2 transition-colors duration-200",
                    isHighlighted
                      ? "text-pink-500 dark:text-pink-400 font-semibold"
                      : "text-gray-400 dark:text-neutral-600"
                  )}
                  style={{ height: "20px", lineHeight: "20px" }}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor container with highlight overlay */}
        <div className="flex-1 relative overflow-hidden">
          {/* Highlight overlay */}
          <div
            ref={highlightOverlayRef}
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="py-3 px-3">
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const isHighlighted = highlightRange &&
                  lineNum >= highlightRange.startLine &&
                  lineNum <= highlightRange.endLine;

                const isFirstHighlighted = highlightRange && lineNum === highlightRange.startLine;
                const isLastHighlighted = highlightRange && lineNum === highlightRange.endLine;

                return (
                  <div
                    key={i}
                    className={cn(
                      "transition-all duration-300",
                      isHighlighted && "bg-pink-500/15 dark:bg-pink-500/20 border-l-2 border-pink-500",
                      isFirstHighlighted && "rounded-t-md",
                      isLastHighlighted && "rounded-b-md"
                    )}
                    style={{
                      height: "20px",
                      lineHeight: "20px",
                      marginLeft: isHighlighted ? "-12px" : "0",
                      paddingLeft: isHighlighted ? "10px" : "0",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={localMarkdown}
            onChange={(e) => {
              setLocalMarkdown(e.target.value);
              clearHighlight();
            }}
            onScroll={handleScroll}
            onClick={clearHighlight}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "/") {
                e.preventDefault();
                toggleCommentLines();
              }
            }}
            className="absolute inset-0 resize-none bg-transparent border-0 text-sm font-mono text-gray-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-0 p-3 overflow-auto whitespace-pre"
            wrap="off"
            placeholder="Enter your scene markdown..."
            spellCheck={false}
            style={{
              lineHeight: "20px",
              caretColor: "#ec4899",
              tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-linear-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 shrink-0">
        <p className="text-xs text-gray-600 dark:text-neutral-400 text-center">
          Press{" "}
          <kbd className="bg-white dark:bg-neutral-800 px-2 py-1 rounded text-xs font-mono text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-900 shadow-sm mx-1">
            ?
          </kbd>{" "}
          or click{" "}
          <span className="text-pink-600 dark:text-pink-400 font-medium">
            Guide
          </span>{" "}
          in header for syntax help
        </p>
      </div>
    </div>
  );
}
