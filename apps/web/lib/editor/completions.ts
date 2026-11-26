import { getAllDirectives, type DirectiveDoc } from "@markdown-video/core";
import { parseLocalizationStringsBlock } from "@markdown-video/core";
import { normalizeDirective, parseDirective } from "@markdown-video/core";

export interface Completion {
  label: string;
  /** Text that replaces the range [from, to). */
  insert: string;
  detail?: string;
}

export interface CompletionResult {
  from: number;
  to: number;
  items: Completion[];
}

const DOCS = getAllDirectives();
const DOC_BY_NAME = new Map(DOCS.map((d) => [d.name, d]));

// Directives whose first argument is a bare enum value rather than key:value.
const POSITIONAL: Record<string, string> = Object.fromEntries(
  DOCS.flatMap((doc) => {
    const firstPositional = doc.properties?.find(
      (property) => property.context === "positional" && property.values
    );
    return firstPositional ? [[doc.name, firstPositional.name]] : [];
  })
);

function docFor(name: string): DirectiveDoc | undefined {
  return DOC_BY_NAME.get(normalizeDirective(name));
}

function valuesFor(doc: DirectiveDoc | undefined, property: string): string[] {
  const lower = property.toLowerCase();
  const prop = doc?.properties?.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      (p.aliases?.some((alias) => alias.toLowerCase() === lower) ?? false)
  );
  if (!prop) return [];
  if (prop.values) return prop.values;
  if (prop.type === "boolean") return ["true", "false"];
  return [];
}

function filter(items: Completion[], prefix: string): Completion[] {
  const p = prefix.toLowerCase();
  const matches = items.filter((i) => i.label.toLowerCase().startsWith(p));
  // Nothing to offer once the word is already complete.
  if (matches.length === 1 && matches[0].label.toLowerCase() === p) return [];
  return matches;
}

function result(from: number, to: number, items: Completion[]): CompletionResult | null {
  return items.length > 0 ? { from, to, items } : null;
}

/** Keys defined by document-level !strings blocks, in first-seen order. */
function localizationKeysInDocument(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const keys: string[] = [];
  let insideScene = false;
  let inFence = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line === "---") {
      insideScene = false;
      continue;
    }

    const directive = parseDirective(line);
    if (!directive) continue;
    if (directive.canonicalName === "scene") {
      insideScene = true;
      continue;
    }
    if (directive.canonicalName !== "strings" || insideScene) continue;

    const parsed = parseLocalizationStringsBlock(lines, index + 1);
    for (const key of Object.keys(parsed.localizationStrings)) {
      if (!keys.includes(key)) keys.push(key);
    }
    index = parsed.endIndex - 1;
  }

  return keys;
}

function isI18nKeyProperty(doc: DirectiveDoc | undefined, key: string): boolean {
  const lower = key.toLowerCase();
  return (
    (doc?.name === "text" || doc?.name === "mockup") &&
    (doc.properties ?? []).some(
      (property) =>
        property.name === "i18nKey" &&
        (property.name.toLowerCase() === lower ||
          (property.aliases?.some((alias) => alias.toLowerCase() === lower) ?? false))
    )
  );
}

function i18nKeyCompletions(
  text: string,
  cursor: number,
  typedPrefix: string
): CompletionResult | null {
  const items = localizationKeysInDocument(text).map((key) => ({
    label: key,
    insert: key,
    detail: "Localization key",
  }));
  return result(cursor - typedPrefix.length, cursor, filter(items, typedPrefix));
}

/**
 * Completions for the cursor position, or null when there is nothing to offer.
 * Handles directive names after "!", values for directive arguments
 * ("!chart type:b"), and values for block properties ("animation: sl").
 */
export function getCompletions(text: string, cursor: number): CompletionResult | null {
  const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
  const before = text.slice(lineStart, cursor);
  const trimmed = before.trimStart();

  if (insideCodeFence(text, lineStart)) return null;

  // "!tra" -> directive names
  const directiveName = trimmed.match(/^!([\w-]*)$/);
  if (directiveName) {
    const prefix = directiveName[1].toLowerCase();
    // Directives whose own name matches come before alias-only matches.
    const byName = DOCS.filter((d) => d.name.startsWith(prefix));
    const byAlias = DOCS.filter(
      (d) => !d.name.startsWith(prefix) && d.aliases.some((a) => a.startsWith(prefix))
    );
    const items = [...byName, ...byAlias].map((d) => ({
      label: d.name,
      insert: `!${d.name}`,
      detail: d.description,
    }));
    if (items.length === 1 && items[0].label === prefix) return null;
    return result(cursor - prefix.length - 1, cursor, items);
  }

  // "!chart type:b" or "!transition sl" -> argument values
  const directiveArgs = trimmed.match(/^!([\w-]+)\s+(.*)$/);
  if (directiveArgs) {
    const doc = docFor(directiveArgs[1]);
    const args = directiveArgs[2];

    const keyValue = args.match(/(?:^|\s)(\w+):([\w-]*)$/);
    if (keyValue) {
      const [, key, value] = keyValue;
      if (isI18nKeyProperty(doc, key)) {
        return i18nKeyCompletions(text, cursor, value);
      }
      const items = valuesFor(doc, key).map((v) => ({ label: v, insert: v }));
      return result(cursor - value.length, cursor, filter(items, value));
    }

    const positional = doc && POSITIONAL[doc.name];
    const firstWord = args.match(/^(\w*)$/);
    if (positional && firstWord) {
      const items = valuesFor(doc, positional).map((v) => ({ label: v, insert: v }));
      return result(cursor - firstWord[1].length, cursor, filter(items, firstWord[1]));
    }

    // "!chart ty" -> property names that take a fixed set of values
    const word = args.match(/(?:^|\s)(\w+)$/);
    if (word && doc) {
      const items = (doc.properties ?? [])
        .filter((p) => (p.values || p.type === "boolean") && p.name !== positional)
        .map((p) => ({ label: `${p.name}:`, insert: `${p.name}:`, detail: p.description }));
      return result(cursor - word[1].length, cursor, filter(items, word[1]));
    }
    return null;
  }

  // "animation: sl" inside a !text or !code block -> property values
  const blockProperty = trimmed.match(/^(\w+):\s*([\w-]*)$/);
  if (blockProperty) {
    const [, key, value] = blockProperty;
    const doc = enclosingBlock(text, lineStart);
    if (isI18nKeyProperty(doc, key)) {
      return i18nKeyCompletions(text, cursor, value);
    }
    const items = valuesFor(doc, key).map((v) => ({ label: v, insert: v }));
    return result(cursor - value.length, cursor, filter(items, value));
  }

  // "fonts" inside a property-only block -> canonical property names
  const bareProperty = trimmed.match(/^(\w+)$/);
  if (bareProperty) {
    const doc = enclosingBlock(text, lineStart);
    const items = doc && PROPERTY_NAME_COMPLETION_BLOCKS.has(doc.name)
      ? (doc.properties ?? [])
        .filter((p) => p.values || p.type === "boolean")
        .map((p) => ({ label: `${p.name}:`, insert: `${p.name}:`, detail: p.description }))
      : [];
    return result(cursor - bareProperty[1].length, cursor, filter(items, bareProperty[1]));
  }

  return null;
}

const PROPERTY_NAME_COMPLETION_BLOCKS = new Set([
  "code",
  "terminal",
  "export",
  "particles",
  "presenter",
]);

const BLOCK_PROPERTY_DIRECTIVES = new Set([
  "text",
  "code",
  "terminal",
  "mockup",
  "particles",
  "presenter",
  "export",
]);

/**
 * The directive block containing this line, tracked forward so a closed code
 * fence does not look like part of the preceding !code block.
 */
function enclosingBlock(text: string, lineStart: number): DirectiveDoc | undefined {
  const lines = text.slice(0, lineStart).split("\n");
  let current: DirectiveDoc | undefined;
  let inFence = false;

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      if (!inFence && current?.name === "code") current = undefined;
      continue;
    }
    if (inFence) continue;
    if (line === "---") {
      current = undefined;
      continue;
    }

    const name = line.match(/^!([\w-]+)/)?.[1];
    if (!name) continue;
    const doc = docFor(name);
    current = doc && BLOCK_PROPERTY_DIRECTIVES.has(doc.name) ? doc : undefined;
  }

  return current;
}

function insideCodeFence(text: string, lineStart: number): boolean {
  let open = false;
  for (const line of text.slice(0, lineStart).split("\n")) {
    if (line.trim().startsWith("```")) open = !open;
  }
  return open;
}
