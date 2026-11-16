import { getAllDirectives, type DirectiveDoc } from "@/lib/mcp/documentation";
import { normalizeDirective } from "@/lib/parser/utils";

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

// Directives whose first argument is a bare value rather than key:value.
const POSITIONAL: Record<string, string> = {
  transition: "type",
  camera: "effect",
};

function docFor(name: string): DirectiveDoc | undefined {
  return DOC_BY_NAME.get(normalizeDirective(name));
}

function valuesFor(doc: DirectiveDoc | undefined, property: string): string[] {
  const prop = doc?.properties?.find((p) => p.name === property);
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
  const directiveName = trimmed.match(/^!(\w*)$/);
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
  const directiveArgs = trimmed.match(/^!(\w+)\s+(.*)$/);
  if (directiveArgs) {
    const doc = docFor(directiveArgs[1]);
    const args = directiveArgs[2];

    const keyValue = args.match(/(?:^|\s)(\w+):([\w-]*)$/);
    if (keyValue) {
      const [, key, value] = keyValue;
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
    const items = valuesFor(doc, key).map((v) => ({ label: v, insert: v }));
    return result(cursor - value.length, cursor, filter(items, value));
  }

  return null;
}

/** The nearest directive above this line within the same scene. */
function enclosingBlock(text: string, lineStart: number): DirectiveDoc | undefined {
  const lines = text.slice(0, lineStart).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "---") return undefined;
    const name = line.match(/^!(\w+)/)?.[1];
    if (name) {
      const doc = docFor(name);
      if (doc?.name === "scene") return undefined;
      return doc;
    }
  }
  return undefined;
}

function insideCodeFence(text: string, lineStart: number): boolean {
  let open = false;
  for (const line of text.slice(0, lineStart).split("\n")) {
    if (line.trim().startsWith("```")) open = !open;
  }
  return open;
}
