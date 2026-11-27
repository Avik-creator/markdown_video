import {
  collectVariableDefinitions,
  isSceneDirective,
  parseDirective,
  substituteVariables,
} from "@markdown-video/core";
import {
  normalizeRelativeAssetFilename,
  type AssetKind,
} from "./asset-store";

export interface AssetReference {
  kind: AssetKind;
  /** Normalized filename such as `theme.mp3` or `art/logo.png`. */
  filename: string;
  /** Exact markdown spelling, normally `./theme.mp3`. */
  rawSrc: string;
  lineNumber: number;
}

interface InlineToken {
  key?: string;
  value: string;
}

function unquote(value: string): string {
  return value.replace(/^(['"])([\s\S]*)\1$/, "$2");
}

/** Lightweight inline-argument tokenizer matching the key:value dialect. */
export function tokenizeInlineArgs(args: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;

  while (index < args.length) {
    while (index < args.length && /\s/.test(args[index])) index += 1;
    if (index >= args.length) break;

    const start = index;
    let quote: string | null = null;
    while (index < args.length) {
      const char = args[index];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (/\s/.test(char)) {
        break;
      }
      index += 1;
    }

    const raw = args.slice(start, index);
    const keyMatch = raw.match(/^([A-Za-z][\w-]*):(.*)$/);
    if (keyMatch) {
      tokens.push({ key: keyMatch[1].toLowerCase(), value: unquote(keyMatch[2]) });
    } else {
      tokens.push({ value: unquote(raw) });
    }
  }

  return tokens;
}

/**
 * Extract document-relative asset references after variable substitution.
 * This intentionally covers media directives rather than every arbitrary
 * string prop, so hidden/non-media key:value pairs do not create diagnostics.
 */
export function extractRelativeAssetReferences(markdown: string): AssetReference[] {
  const lines = markdown.split(/\r?\n/);
  const variables = collectVariableDefinitions(lines);
  const references: AssetReference[] = [];
  let inFence = false;
  let insideScene = false;

  for (const [zeroIndex, rawLine] of lines.entries()) {
    const lineNumber = zeroIndex + 1;
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !trimmed.startsWith("!")) continue;
    if (trimmed === "---") {
      insideScene = false;
      continue;
    }

    const substituted = substituteVariables(trimmed, variables);
    if (isSceneDirective(substituted)) {
      insideScene = true;
      continue;
    }

    const directive = parseDirective(substituted);
    if (!directive) continue;
    const tokens = tokenizeInlineArgs(directive.args);

    const addReference = (kind: AssetKind, src: string | undefined) => {
      if (!src) return;
      const filename = normalizeRelativeAssetFilename(src);
      if (!filename) return;
      references.push({ kind, filename, rawSrc: src, lineNumber });
    };

    if (directive.canonicalName === "music" && !insideScene) {
      addReference("audio", tokens.find((token) => !token.key)?.value);
      continue;
    }

    if (directive.canonicalName === "image") {
      addReference("image", tokens.find((token) => token.key === "src")?.value);
      continue;
    }

    // Mockup image content uses the same `src` property. Non-image mockup
    // types ignore it, but treating it as a candidate is safe and keeps the
    // reference in sync if the user switches content types.
    if (directive.canonicalName === "mockup") {
      addReference("image", tokens.find((token) => token.key === "src")?.value);
    }
  }

  return references;
}

export function uniqueAssetReferences(
  references: readonly AssetReference[]
): AssetReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.kind}:${reference.filename}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Markdown spelling used for uploaded assets. */
export function assetReference(filename: string): string {
  return `./${filename}`;
}

/** Quote only when whitespace requires it; upload sanitization removes quotes. */
export function markdownMediaValue(filename: string): string {
  const reference = assetReference(filename);
  return /\s/.test(reference) ? `"${reference}"` : reference;
}

export function assetReferenceSnippet(kind: AssetKind, filename: string): string {
  const value = markdownMediaValue(filename);
  return kind === "audio"
    ? `!music ${value} volume:0.4 fade:1s`
    : `!image src:${value} fit:contain`;
}

/**
 * Insert markdown at the cursor when possible; otherwise append on a fresh
 * line. Selection replacement is intentionally avoided so users do not lose
 * selected scene content accidentally.
 */
export function textWithInsertedReference(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string
): { text: string; cursor: number } {
  if (selectionStart !== selectionEnd) {
    return { text, cursor: selectionStart };
  }

  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);
  const needsPrefixNewline = before.length > 0 && !before.endsWith("\n");
  const needsSuffixNewline = after.length > 0 && !after.startsWith("\n");
  const inserted = `${needsPrefixNewline ? "\n" : ""}${snippet}${
    needsSuffixNewline ? "\n" : ""
  }`;
  return {
    text: before + inserted + after,
    cursor: selectionStart + inserted.length,
  };
}
