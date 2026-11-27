/**
 * Storage format for shared projects in Redis.
 *
 * `@upstash/redis` auto-deserializes GET responses with JSON.parse, so a
 * markdown document consisting of `42` reads back as the number 42, `true` as
 * the boolean true, and `[1,2,3]` as an array — corrupting any document that
 * happens to be valid JSON. To make the round-trip type-safe, new writes store
 * the markdown wrapped in a versioned object ({"v":1,"markdown":"..."}), which
 * always deserializes back into the same object shape no matter what the
 * markdown contains.
 *
 * Reads must still tolerate two legacy shapes left over from plain-string
 * writes (which expire within 7 days of their creation thanks to the TTL):
 *
 * - plain strings, passed through unchanged, and
 * - corrupted scalars (number/boolean), converted back with String() on a
 *   best-effort basis — `42` and `true` render as their original source text,
 *   though formatting-sensitive JSON values (whitespace, exponent notation)
 *   cannot always be reconstructed exactly.
 *
 * One unavoidable ambiguity: a legacy plain-string write whose entire markdown
 * was exactly the wrapper JSON shape (e.g. the text {"v":1,"markdown":"x"})
 * deserializes into an object indistinguishable from a new-format write and
 * will be read as its inner markdown. This collision is inherent to the
 * JSON-parsing storage layer, only affects legacy entries, and disappears with
 * them.
 */

export const PROJECT_STORAGE_VERSION = 1;

export type StoredProject = {
  v: typeof PROJECT_STORAGE_VERSION;
  markdown: string;
};

/**
 * Wrap markdown in the versioned storage object. The Upstash client serializes
 * objects with JSON.stringify on write, so the stored payload is always valid
 * JSON that parses back into this exact shape on read.
 */
export function serializeProjectMarkdown(markdown: string): StoredProject {
  return { v: PROJECT_STORAGE_VERSION, markdown };
}

function isStoredProject(value: unknown): value is StoredProject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.v === PROJECT_STORAGE_VERSION && typeof record.markdown === "string";
}

/**
 * Interpret a raw facade string (lib/kv returns plain strings on every
 * backend) as a storage value for parseProjectMarkdown: canonical JSON
 * becomes the parsed value, while anything else — legacy plain-string
 * markdown writes are the important case — is passed through as the string
 * itself. JSON-looking scalars intentionally parse to numbers/booleans so
 * that legacy corrupted documents (e.g. a markdown of exactly `42`) hit the
 * same scalar-recovery path they did when the Upstash client performed the
 * deserialization.
 */
export function parseProjectJson(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    // Number fidelity protection mirrors the Upstash client's deserializer:
    // when the numeric value does not round-trip to the exact source text
    // (`3.140`, `1e5`, padded whitespace), the original string is preserved
    // instead of corrupting formatting-sensitive markdown.
    if (typeof parsed === "number" && parsed.toString() !== raw) {
      return raw;
    }
    return parsed;
  } catch {
    return raw;
  }
}

/**
 * Parse a raw Redis GET result back into markdown, accepting the versioned
 * wrapper object, legacy plain strings, and legacy JSON-corrupted scalars.
 * Returns null when the value is missing, empty, or has an unrecognized shape
 * (callers treat null as "project not found", matching the behavior of a
 * missing key).
 */
export function parseProjectMarkdown(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (isStoredProject(value)) {
    return value.markdown.length > 0 ? value.markdown : null;
  }

  // Legacy plain-string write: passthrough.
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }

  // Legacy scalar corruption: a document consisting of exactly `42`, `true`,
  // or a similar JSON scalar was auto-deserialized into a number/boolean.
  // String() restores the canonical source text for the common cases.
  if (typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return null;
    }
    return String(value);
  }

  // Arrays, objects without the wrapper shape, and anything else are
  // unrecoverable corruption (the original formatting is lost); treat them as
  // not found rather than serving garbage.
  return null;
}
