/**
 * Schema-driven, round-trip-safe markdown directive editing.
 *
 * The parser is intentionally lossless about neither formatting nor duplicate
 * source constructs, so this module works one level lower: it uses the parser's
 * scene/source ranges to choose the semantically effective directive, then
 * patches only the relevant token or line. Every operation returns a new
 * document; callers can simply keep the original when `ok` is false.
 */

import {
  getDirectiveProperty,
  getDirectiveSchema,
  isOneOf,
  type AnyDirectiveSchema,
  type CanonicalDirectiveName,
  type DirectivePropertySchema,
  type DirectiveValueSchema,
} from "./directive-schema.js";
import { parseMarkdownFull } from "./parser/index.js";
import { isSceneDirective, parseDirective } from "./parser/utils.js";
import {
  classifyDirectivePropertyLine,
  parseNumericValue,
} from "./parser/parsers/schema-values.js";
import type { Scene, SceneSourceMap, SourceRange } from "./types.js";

export type DirectiveEditableScalar = string | number | boolean;

export interface DirectiveValueEdit {
  /** Zero-based index of the scene in document order. */
  sceneIndex: number;
  /** Canonical directive name or alias. */
  directive: string;
  /** Canonical property or positional-argument name. */
  valueName: string;
  /** New value, or null to remove the value/directive where removal is meaningful. */
  value: DirectiveEditableScalar | null;
  /** Required only when a name exists both as a property and positional argument. */
  kind?: "property" | "positional";
}

export type DirectiveEditAction = "updated" | "inserted" | "removed" | "noop";

export type DirectiveEditResult =
  | {
      ok: true;
      markdown: string;
      action: DirectiveEditAction;
      /** 1-indexed line most directly affected by the edit. */
      line: number;
    }
  | { ok: false; reason: string };

export interface InspectedDirectiveValue {
  kind: "property" | "positional";
  name: string;
  schema: DirectiveValueSchema;
  present: boolean;
  /** Effective source spelling after quote removal, exactly as authored. */
  rawValue?: string;
  /** Schema-normalized scalar for enum/number/boolean values; strings stay source text. */
  value?: DirectiveEditableScalar;
  /** 1-indexed line carrying the effective value. */
  line?: number;
  source?: "inline" | "block" | "positional";
}

export interface SceneDirectiveInspection {
  directiveName: CanonicalDirectiveName;
  present: boolean;
  range?: SourceRange;
  properties: InspectedDirectiveValue[];
  positional: InspectedDirectiveValue[];
}

// These directives have meaning inside a scene. Document-level metadata
// (music, export, locales, strings) is deliberately out of scope for scene edits.
const SCENE_SCOPED_DIRECTIVES = new Set<string>([
  "text",
  "code",
  "terminal",
  "diff",
  "chart",
  "mockup",
  "callout",
  "particles",
  "camera",
  "presenter",
  "layout",
  "transition",
  "duration",
  "background",
  "chapter",
  "locale",
  "image",
  "emoji",
  "qr",
  "countdown",
  "progress",
]);

// Grammar fact rather than presentation policy: these directive bodies may
// carry `key:value` lines. Text/code/terminal do not consume inline key/value
// properties in the general case, so they are block-only for safe insertion.
const BLOCK_PROPERTY_DIRECTIVES = new Set<string>([
  "text",
  "code",
  "terminal",
  "mockup",
  "particles",
  "presenter",
]);
const BLOCK_ONLY_PROPERTY_DIRECTIVES = new Set<string>(["text", "code", "terminal"]);

function supportsBlockProperties(directiveName: string): boolean {
  return BLOCK_PROPERTY_DIRECTIVES.has(directiveName);
}

function supportsInlineProperties(directiveName: string): boolean {
  return !BLOCK_ONLY_PROPERTY_DIRECTIVES.has(directiveName);
}

interface EditableLine {
  /** Full line without the LF separator, including a trailing CR when present. */
  raw: string;
  /** Line content without a trailing CR. */
  body: string;
  /** Carriage return suffix preserved when the line is rewritten. */
  cr: string;
}

function splitEditableLines(markdown: string): EditableLine[] {
  return markdown.split("\n").map((raw) => {
    const hasCr = raw.endsWith("\r");
    return {
      raw,
      body: hasCr ? raw.slice(0, -1) : raw,
      cr: hasCr ? "\r" : "",
    };
  });
}

function joinEditableLines(lines: readonly EditableLine[]): string {
  return lines.map((line) => line.body + line.cr).join("\n");
}

function replaceLineBody(lines: EditableLine[], index: number, body: string): void {
  lines[index] = { ...lines[index], body };
}

function insertLineBodies(
  lines: EditableLine[],
  index: number,
  bodies: readonly string[],
  cr: string
): void {
  lines.splice(
    index,
    0,
    ...bodies.map((body) => ({ raw: body + cr, body, cr }))
  );
}

function removeLineAt(lines: EditableLine[], index: number): void {
  lines.splice(index, 1);
}

interface DirectiveLineInfo {
  indent: string;
  name: string;
  canonicalName: string;
  /** Raw or reconstructed effective arguments used for parsing. */
  args: string;
  /** Character offset in the line body where the raw post-directive arguments begin. */
  argsStart: number;
  /** Colon-attached shorthand (`!zoom:1.2`) does not have stable raw token offsets. */
  colonAttached: boolean;
}

function parseDirectiveLineBody(body: string): DirectiveLineInfo | null {
  const match = body.match(/^(\s*)!(\w[\w-]*)(.*)$/);
  if (!match) return null;
  const [, indent, rawName, rawArgs] = match;
  const name = rawName.toLowerCase();
  const parsed = parseDirective(body.trim());
  if (!parsed) return null;
  const colonAttached = rawArgs.startsWith(":");
  return {
    indent,
    name,
    canonicalName: parsed.canonicalName,
    args: colonAttached ? `${name}${rawArgs}` : rawArgs,
    argsStart: indent.length + 1 + rawName.length,
    colonAttached,
  };
}

interface DetailedInlineToken {
  /** Start of the complete token in `args`, including a separated key. */
  start: number;
  /** End of the complete token in `args`. */
  end: number;
  raw: string;
  key?: string;
  value?: string;
  /** Start/end of the raw value text (including quotes) for key:value tokens. */
  valueStart?: number;
  valueEnd?: number;
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function scanInlineWord(args: string, start: number): number {
  let quote: '"' | "'" | null = null;
  let index = start;
  while (index < args.length) {
    const char = args[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (isWhitespace(char)) {
      break;
    }
    index++;
  }
  return index;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === "'") && last === first) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Position-preserving counterpart of the parser's inline tokenizer. It
 * intentionally mirrors the parser's forgiving quote and `key: value` rules;
 * when in doubt, the edit engine refuses to use unstable offsets instead of
 * inventing a grammar.
 */
function tokenizeInlineArgumentsDetailed(args: string): DetailedInlineToken[] {
  const tokens: DetailedInlineToken[] = [];
  let index = 0;

  while (index < args.length) {
    while (index < args.length && isWhitespace(args[index])) index++;
    if (index >= args.length) break;

    const start = index;
    const end = scanInlineWord(args, start);
    const raw = args.slice(start, end);
    const keyOnly = raw.match(/^([A-Za-z][\w-]*):$/);

    if (keyOnly) {
      let valueStart = end;
      while (valueStart < args.length && isWhitespace(args[valueStart])) valueStart++;
      if (valueStart < args.length) {
        const valueEnd = scanInlineWord(args, valueStart);
        const valueRaw = args.slice(valueStart, valueEnd);
        tokens.push({
          start,
          end: valueEnd,
          raw: args.slice(start, valueEnd),
          key: keyOnly[1],
          value: stripQuotes(valueRaw),
          valueStart,
          valueEnd,
        });
        index = valueEnd;
        continue;
      }
    }

    const keyValue = raw.match(/^([A-Za-z][\w-]*):(.+)$/);
    const isUrlSchemeToken =
      keyValue !== null &&
      (/^(https?|data|blob|file)$/i.test(keyValue[1]) || keyValue[2].startsWith("//"));

    if (keyValue && !isUrlSchemeToken) {
      const colonOffset = raw.indexOf(":");
      tokens.push({
        start,
        end,
        raw,
        key: keyValue[1],
        value: stripQuotes(keyValue[2]),
        valueStart: start + colonOffset + 1,
        valueEnd: end,
      });
    } else {
      tokens.push({ start, end, raw });
    }
    index = end;
  }

  return tokens;
}

function sameCanonicalName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function inlinePropertyToken(
  directiveName: string,
  propertyName: string,
  tokens: readonly DetailedInlineToken[]
): DetailedInlineToken | undefined {
  for (const token of tokens) {
    if (!token.key || token.value === undefined) continue;
    const property = getDirectiveProperty(directiveName, token.key);
    if (property && sameCanonicalName(property.name, propertyName)) {
      // The parser's getInlinePropertyValue returns the first matching inline
      // key, so the first duplicate is the effective one.
      return token;
    }
  }
  return undefined;
}

interface BlockPropertyOccurrence {
  line: number;
  rawValue: string;
  canonicalValue: string;
}

function findBlockPropertyOccurrences(
  lines: readonly EditableLine[],
  range: SourceRange,
  directiveName: string,
  propertyName: string
): BlockPropertyOccurrence[] {
  const occurrences: BlockPropertyOccurrence[] = [];
  const endLine = Math.min(range.endLine, lines.length);

  for (let lineNumber = range.startLine + 1; lineNumber <= endLine; lineNumber++) {
    const body = lines[lineNumber - 1]?.body ?? "";
    const trimmed = body.trim();

    // Parser-accurate scan limits: code properties end once the fenced block
    // starts; terminal properties end once commands/output start. Other block
    // directives intentionally scan every non-directive content line because
    // their parsers do the same.
    if (directiveName === "code" && trimmed.startsWith("```")) break;
    if (
      directiveName === "terminal" &&
      (trimmed.startsWith("$") || trimmed.startsWith(">") || trimmed.startsWith("```"))
    ) {
      break;
    }
    if (trimmed.startsWith("!") || trimmed === "---") break;

    const classification = classifyDirectivePropertyLine(directiveName, trimmed);
    if (
      classification.kind === "property" &&
      sameCanonicalName(classification.property.name, propertyName)
    ) {
      const rawValueMatch = trimmed.match(/^[A-Za-z][\w-]*\s*:\s*(.+)$/);
      occurrences.push({
        line: lineNumber,
        rawValue: rawValueMatch?.[1] ?? classification.property.value,
        canonicalValue: classification.property.value,
      });
    }
  }

  return occurrences;
}

interface SceneContext {
  lines: EditableLine[];
  scene: Scene;
  sceneRange: SourceRange;
  sceneCount: number;
}

function failure(reason: string): DirectiveEditResult {
  return { ok: false, reason };
}

function getSceneContext(markdown: string, sceneIndex: number): SceneContext | null {
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) return null;
  const parsed = parseMarkdownFull(markdown);
  const scene = parsed.scenes[sceneIndex];
  const sceneRange = scene?.sourceMap?.scene;
  if (!scene || !sceneRange) return null;

  const lines = splitEditableLines(markdown);
  if (
    !Number.isInteger(sceneRange.startLine) ||
    !Number.isInteger(sceneRange.endLine) ||
    sceneRange.startLine < 1 ||
    sceneRange.startLine > sceneRange.endLine ||
    sceneRange.endLine > lines.length ||
    !isSceneDirective(lines[sceneRange.startLine - 1]?.body.trim() ?? "")
  ) {
    return null;
  }

  return { lines, scene, sceneRange, sceneCount: parsed.scenes.length };
}

function sourceRangeForDirective(
  scene: Scene,
  directiveName: CanonicalDirectiveName
): SourceRange | undefined {
  const key = directiveName as keyof SceneSourceMap;
  return scene.sourceMap?.[key];
}

interface DirectiveOccurrence {
  range: SourceRange;
  lineIndex: number;
  info: DirectiveLineInfo;
}

function locateDirectiveOccurrence(
  context: SceneContext,
  directiveName: CanonicalDirectiveName
): DirectiveOccurrence | null {
  const range = sourceRangeForDirective(context.scene, directiveName);
  if (!range) return null;
  if (
    !Number.isInteger(range.startLine) ||
    !Number.isInteger(range.endLine) ||
    range.startLine < 1 ||
    range.startLine > range.endLine ||
    range.endLine > context.lines.length
  ) {
    return null;
  }

  const lineIndex = range.startLine - 1;
  const info = parseDirectiveLineBody(context.lines[lineIndex]?.body ?? "");
  if (!info || info.canonicalName !== directiveName) return null;
  return { range, lineIndex, info };
}

function parseInspectedValue(
  schema: DirectiveValueSchema,
  rawValue: string
): DirectiveEditableScalar | undefined {
  switch (schema.type) {
    case "enum": {
      const values = schema.values ?? [];
      if (schema.caseInsensitiveValues) {
        const lower = rawValue.toLowerCase();
        return values.find((option) => option.toLowerCase() === lower);
      }
      return isOneOf(values, rawValue) ? rawValue : undefined;
    }
    case "number":
      return parseNumericValue(rawValue, {
        allowSecondsUnit: schema.unit === "seconds",
      });
    case "boolean":
      if (rawValue === "true") return true;
      if (rawValue === "false") return false;
      return undefined;
    case "string":
    case "color":
    case "url":
    case "array":
    case "object":
      return rawValue;
    default:
      return undefined;
  }
}

function absentInspectedValue(
  kind: "property" | "positional",
  name: string,
  schema: DirectiveValueSchema
): InspectedDirectiveValue {
  return { kind, name, schema, present: false };
}

/**
 * Inspect the effective source-level values of one directive in one scene.
 * Values are raw markdown facts (not renderer defaults), making this suitable
 * for editors that need to distinguish "absent" from "explicitly defaulted".
 */
export function inspectSceneDirective(
  markdown: string,
  sceneIndex: number,
  directiveNameInput: string
): SceneDirectiveInspection | null {
  const directive = getDirectiveSchema(directiveNameInput);
  if (!directive || !SCENE_SCOPED_DIRECTIVES.has(directive.name)) return null;
  const context = getSceneContext(markdown, sceneIndex);
  if (!context) return null;

  const occurrence = locateDirectiveOccurrence(context, directive.name);
  const properties = (directive.properties ?? []).map((schema) =>
    absentInspectedValue("property", schema.name, schema)
  );
  const positional = (directive.positional ?? []).map((schema) =>
    absentInspectedValue("positional", schema.name, schema)
  );

  if (!occurrence) {
    return {
      directiveName: directive.name,
      present: false,
      properties,
      positional,
    };
  }

  const tokens = tokenizeInlineArgumentsDetailed(occurrence.info.args);
  const positionalTokens = tokens.filter((token) => token.key === undefined);

  const inspectedProperties = properties.map((inspection) => {
    if (!supportsInlineProperties(directive.name) && !supportsBlockProperties(directive.name)) {
      return inspection;
    }

    const blockOccurrences = supportsBlockProperties(directive.name)
      ? findBlockPropertyOccurrences(
          context.lines,
          occurrence.range,
          directive.name,
          inspection.name
        )
      : [];
    // Block properties are applied after inline arguments by the parser, so a
    // block occurrence is effective whenever one exists; the last duplicate wins.
    const block = blockOccurrences[blockOccurrences.length - 1];
    if (block) {
      return {
        ...inspection,
        present: true,
        rawValue: block.canonicalValue,
        value: parseInspectedValue(inspection.schema, block.canonicalValue),
        line: block.line,
        source: "block" as const,
      };
    }

    if (!supportsInlineProperties(directive.name) || occurrence.info.colonAttached) {
      return inspection;
    }
    const token = inlinePropertyToken(directive.name, inspection.name, tokens);
    if (!token || token.value === undefined) return inspection;
    return {
      ...inspection,
      present: true,
      rawValue: token.value,
      value: parseInspectedValue(inspection.schema, token.value),
      line: occurrence.range.startLine,
      source: "inline" as const,
    };
  });

  const inspectedPositional = positional.map((inspection, positionalIndex) => {
    // Background is intentionally rest-of-line syntax rather than tokenized
    // key/value syntax: gradients contain whitespace and commas by design.
    if (directive.name === "background" && positionalIndex === 0) {
      const rawValue = occurrence.info.args.trim();
      if (!rawValue) return inspection;
      return {
        ...inspection,
        present: true,
        rawValue,
        value: rawValue,
        line: occurrence.range.startLine,
        source: "positional" as const,
      };
    }

    if (occurrence.info.colonAttached) return inspection;
    const token = positionalTokens[positionalIndex];
    if (!token) return inspection;
    const rawValue = stripQuotes(token.raw);
    return {
      ...inspection,
      present: true,
      rawValue,
      value: parseInspectedValue(inspection.schema, rawValue),
      line: occurrence.range.startLine,
      source: "positional" as const,
    };
  });

  return {
    directiveName: directive.name,
    present: true,
    range: occurrence.range,
    properties: inspectedProperties,
    positional: inspectedPositional,
  };
}

function formatNumber(value: number): string {
  // Keep decimal input deterministic without trapping users in floating-point
  // artifacts such as 0.30000000000000004.
  return String(Number(value.toFixed(6)));
}

function normalizeScalarValue(
  schema: DirectiveValueSchema,
  value: DirectiveEditableScalar
): { ok: true; value: string } | { ok: false; reason: string } {
  switch (schema.type) {
    case "number": {
      const numeric =
        typeof value === "number"
          ? value
          : parseNumericValue(String(value), {
              allowSecondsUnit: schema.unit === "seconds",
            });
      if (numeric === undefined || !Number.isFinite(numeric)) {
        return { ok: false, reason: `${schema.name} must be a finite number` };
      }
      if (schema.min !== undefined) {
        const tooSmall = schema.exclusiveMin ? numeric <= schema.min : numeric < schema.min;
        if (tooSmall) {
          return {
            ok: false,
            reason: `${schema.name} must be ${schema.exclusiveMin ? "greater than" : "at least"} ${schema.min}`,
          };
        }
      }
      if (schema.max !== undefined && numeric > schema.max) {
        return { ok: false, reason: `${schema.name} must be at most ${schema.max}` };
      }
      return {
        ok: true,
        value: `${formatNumber(numeric)}${schema.unit === "seconds" ? "s" : ""}`,
      };
    }
    case "boolean": {
      if (typeof value === "boolean") return { ok: true, value: String(value) };
      if (value === "true" || value === "false") return { ok: true, value };
      return { ok: false, reason: `${schema.name} must be true or false` };
    }
    case "enum": {
      const raw = String(value);
      const values = schema.values ?? [];
      const canonical = schema.caseInsensitiveValues
        ? values.find((option) => option.toLowerCase() === raw.toLowerCase())
        : values.find((option) => option === raw);
      if (!canonical) {
        return {
          ok: false,
          reason: `${schema.name} must be one of: ${values.join(", ")}`,
        };
      }
      return { ok: true, value: canonical };
    }
    case "string":
    case "color":
    case "url": {
      const raw = String(value);
      if (!raw.trim()) return { ok: false, reason: `${schema.name} cannot be empty` };
      if (/[\r\n]/.test(raw)) {
        return { ok: false, reason: `${schema.name} must stay on one line` };
      }
      return { ok: true, value: raw.trim() };
    }
    case "array":
    case "object":
      return { ok: false, reason: `${schema.name} uses a structured multi-line value` };
    default:
      return { ok: false, reason: `Unsupported value type` };
  }
}

function quoteScalarForInlineValue(
  rawValue: string
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!/\s/.test(rawValue)) return { ok: true, value: rawValue };
  if (!rawValue.includes('"')) return { ok: true, value: `"${rawValue}"` };
  if (!rawValue.includes("'")) return { ok: true, value: `'${rawValue}'` };
  return {
    ok: false,
    reason: "Values containing both single and double quotes cannot be inlined safely",
  };
}

function serializePositionalValue(
  directiveName: string,
  schema: DirectiveValueSchema,
  normalizedValue: string
): { ok: true; value: string } | { ok: false; reason: string } {
  // Background is rest-of-line CSS/gradient syntax; quoting would become part
  // of the rendered value. Chapter titles, conversely, require quotes in the
  // parser's grammar even when they are one word.
  if (directiveName === "background") return { ok: true, value: normalizedValue };
  if (directiveName === "chapter" && schema.name === "title") {
    if (normalizedValue.includes('"')) {
      return { ok: false, reason: "Chapter titles cannot contain double quotes" };
    }
    return { ok: true, value: `"${normalizedValue}"` };
  }
  return quoteScalarForInlineValue(normalizedValue);
}

function appendInlineText(args: string, text: string): string {
  const trailing = args.match(/\s*$/)?.[0] ?? "";
  const core = args.slice(0, args.length - trailing.length);
  const separator = core.trim() ? " " : core.length > 0 ? "" : " ";
  return `${core}${separator}${text}${trailing}`;
}

function removeTokenFromArgs(args: string, token: DetailedInlineToken): string {
  let start = token.start;
  let end = token.end;

  if (start > 0 && isWhitespace(args[start - 1])) {
    start--;
  } else {
    while (end < args.length && isWhitespace(args[end])) end++;
  }

  return args.slice(0, start) + args.slice(end);
}

function replaceWholeTokenInArgs(
  args: string,
  token: DetailedInlineToken,
  replacement: string
): string {
  return args.slice(0, token.start) + replacement + args.slice(token.end);
}

function replaceTokenValueInArgs(
  args: string,
  token: DetailedInlineToken,
  replacement: string
): string | null {
  if (token.valueStart === undefined || token.valueEnd === undefined) return null;
  return args.slice(0, token.valueStart) + replacement + args.slice(token.valueEnd);
}

function rewriteLineArgs(
  lines: EditableLine[],
  lineIndex: number,
  info: DirectiveLineInfo,
  newArgs: string
): void {
  const body = lines[lineIndex].body;
  replaceLineBody(lines, lineIndex, body.slice(0, info.argsStart) + newArgs);
}

function replaceBlockPropertyLineValue(
  lines: EditableLine[],
  lineNumber: number,
  serializedValue: string
): boolean {
  const index = lineNumber - 1;
  const body = lines[index]?.body;
  if (body === undefined) return false;
  const match = body.match(/^(\s*[A-Za-z][\w-]*\s*:\s*)(.*?)(\s*)$/);
  if (!match) return false;
  replaceLineBody(lines, index, `${match[1]}${serializedValue}${match[3]}`);
  return true;
}

function resolveValueSchema(
  directive: AnyDirectiveSchema,
  edit: DirectiveValueEdit
): { kind: "property" | "positional"; schema: DirectiveValueSchema } | null {
  const property = getDirectiveProperty(directive.name, edit.valueName);
  const positional = directive.positional?.find((argument) =>
    sameCanonicalName(argument.name, edit.valueName)
  );

  if (edit.kind === "property") {
    return property ? { kind: "property", schema: property } : null;
  }
  if (edit.kind === "positional") {
    return positional ? { kind: "positional", schema: positional } : null;
  }
  if (property) return { kind: "property", schema: property };
  if (positional) return { kind: "positional", schema: positional };
  return null;
}

function successResult(
  originalMarkdown: string,
  lines: readonly EditableLine[],
  action: DirectiveEditAction,
  line: number
): DirectiveEditResult {
  const markdown = joinEditableLines(lines);
  return {
    ok: true,
    markdown,
    action: markdown === originalMarkdown ? "noop" : action,
    line,
  };
}

function validateRewrite(
  originalSceneCount: number,
  markdown: string,
  edit: DirectiveValueEdit,
  directive: AnyDirectiveSchema,
  kind: "property" | "positional",
  valueSchema: DirectiveValueSchema,
  normalizedValue: string | null
): boolean {
  const reparsed = parseMarkdownFull(markdown);
  if (reparsed.scenes.length !== originalSceneCount) return false;

  if (normalizedValue === null) {
    // Removal is already conservative. Duplicate source constructs can make an
    // older duplicate become effective again; that is surfaced through
    // inspection rather than treated as corruption.
    return true;
  }

  const inspection = inspectSceneDirective(markdown, edit.sceneIndex, directive.name);
  if (!inspection?.present) return false;
  const values = kind === "property" ? inspection.properties : inspection.positional;
  const inspected = values.find((value) => sameCanonicalName(value.name, valueSchema.name));
  if (!inspected?.present || inspected.rawValue === undefined) return false;

  const expected = parseInspectedValue(valueSchema, normalizedValue);
  const actual = inspected.value;
  if (expected === undefined || actual === undefined) {
    return inspected.rawValue === normalizedValue;
  }
  return actual === expected;
}

function finishEdit(
  originalMarkdown: string,
  context: SceneContext,
  lines: readonly EditableLine[],
  action: DirectiveEditAction,
  line: number,
  edit: DirectiveValueEdit,
  directive: AnyDirectiveSchema,
  kind: "property" | "positional",
  valueSchema: DirectiveValueSchema,
  normalizedValue: string | null
): DirectiveEditResult {
  const result = successResult(originalMarkdown, lines, action, line);
  if (!result.ok || result.action === "noop") return result;

  if (
    !validateRewrite(
      context.sceneCount,
      result.markdown,
      edit,
      directive,
      kind,
      valueSchema,
      normalizedValue
    )
  ) {
    return failure("Rewrite validation failed; original markdown was left unchanged");
  }
  return result;
}

function canonicalPropertyKey(schema: DirectivePropertySchema): string {
  return schema.name;
}

function insertMissingPropertyDirective(
  context: SceneContext,
  lines: EditableLine[],
  directive: AnyDirectiveSchema,
  property: DirectivePropertySchema,
  normalizedValue: string
): { action: DirectiveEditAction; line: number } | { error: string } {
  const serialized = quoteScalarForInlineValue(normalizedValue);
  if (!serialized.ok) return { error: serialized.reason };

  const sceneLine = context.lines[context.sceneRange.startLine - 1];
  const sceneInfo = parseDirectiveLineBody(sceneLine?.body ?? "");
  const indent = sceneInfo?.indent ?? "";
  const insertionIndex = context.sceneRange.startLine;

  if (supportsInlineProperties(directive.name)) {
    insertLineBodies(
      lines,
      insertionIndex,
      [`${indent}!${directive.name} ${property.name}:${serialized.value}`],
      sceneLine?.cr ?? ""
    );
  } else {
    insertLineBodies(
      lines,
      insertionIndex,
      [
        `${indent}!${directive.name}`,
        `${indent}${canonicalPropertyKey(property)}: ${serialized.value}`,
      ],
      sceneLine?.cr ?? ""
    );
  }

  return { action: "inserted", line: insertionIndex + 1 };
}

function applyPropertyEdit(
  originalMarkdown: string,
  context: SceneContext,
  edit: DirectiveValueEdit,
  directive: AnyDirectiveSchema,
  property: DirectivePropertySchema
): DirectiveEditResult {
  const lines = context.lines.map((line) => ({ ...line }));
  const occurrence = locateDirectiveOccurrence(context, directive.name);

  if (edit.value === null && property.required) {
    return failure(`${directive.name} ${property.name} is required and cannot be removed`);
  }

  const normalized =
    edit.value === null ? null : normalizeScalarValue(property, edit.value);
  if (normalized !== null && !normalized.ok) return failure(normalized.reason);
  const normalizedValue = normalized === null ? null : normalized.value;

  if (!occurrence) {
    if (edit.value === null || normalizedValue === null) {
      return successResult(originalMarkdown, lines, "noop", context.sceneRange.startLine);
    }
    const inserted = insertMissingPropertyDirective(
      context,
      lines,
      directive,
      property,
      normalizedValue
    );
    if ("error" in inserted) return failure(inserted.error);
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      inserted.action,
      inserted.line,
      edit,
      directive,
      "property",
      property,
      normalizedValue
    );
  }

  const tokens = tokenizeInlineArgumentsDetailed(occurrence.info.args);
  const inlineToken =
    supportsInlineProperties(directive.name) && !occurrence.info.colonAttached
      ? inlinePropertyToken(directive.name, property.name, tokens)
      : undefined;
  const blockOccurrences = supportsBlockProperties(directive.name)
    ? findBlockPropertyOccurrences(lines, occurrence.range, directive.name, property.name)
    : [];
  const block = blockOccurrences[blockOccurrences.length - 1];

  if (edit.value === null) {
    if (block) {
      removeLineAt(lines, block.line - 1);
      return finishEdit(
        originalMarkdown,
        context,
        lines,
        "removed",
        block.line,
        edit,
        directive,
        "property",
        property,
        null
      );
    }
    if (inlineToken) {
      rewriteLineArgs(
        lines,
        occurrence.lineIndex,
        occurrence.info,
        removeTokenFromArgs(occurrence.info.args, inlineToken)
      );
      return finishEdit(
        originalMarkdown,
        context,
        lines,
        "removed",
        occurrence.range.startLine,
        edit,
        directive,
        "property",
        property,
        null
      );
    }
    return successResult(originalMarkdown, lines, "noop", occurrence.range.startLine);
  }

  if (normalizedValue === null) return failure("Invalid empty value");
  const serialized = quoteScalarForInlineValue(normalizedValue);
  if (!serialized.ok) return failure(serialized.reason);

  if (block) {
    if (!replaceBlockPropertyLineValue(lines, block.line, serialized.value)) {
      return failure("Could not locate the block property value");
    }
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "updated",
      block.line,
      edit,
      directive,
      "property",
      property,
      normalizedValue
    );
  }

  if (inlineToken) {
    const newArgs = replaceTokenValueInArgs(
      occurrence.info.args,
      inlineToken,
      serialized.value
    );
    if (newArgs === null) return failure("Could not locate the inline property value");
    rewriteLineArgs(lines, occurrence.lineIndex, occurrence.info, newArgs);
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "updated",
      occurrence.range.startLine,
      edit,
      directive,
      "property",
      property,
      normalizedValue
    );
  }

  if (supportsBlockProperties(directive.name)) {
    insertLineBodies(
      lines,
      occurrence.range.startLine,
      [`${occurrence.info.indent}${property.name}: ${serialized.value}`],
      lines[occurrence.lineIndex]?.cr ?? ""
    );
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "inserted",
      occurrence.range.startLine + 1,
      edit,
      directive,
      "property",
      property,
      normalizedValue
    );
  }

  const newArgs = appendInlineText(
    occurrence.info.args,
    `${property.name}:${serialized.value}`
  );
  rewriteLineArgs(lines, occurrence.lineIndex, occurrence.info, newArgs);
  return finishEdit(
    originalMarkdown,
    context,
    lines,
    "inserted",
    occurrence.range.startLine,
    edit,
    directive,
    "property",
    property,
    normalizedValue
  );
}

function positionalIndexFor(
  directive: AnyDirectiveSchema,
  schema: DirectiveValueSchema
): number {
  return (directive.positional ?? []).findIndex((argument) =>
    sameCanonicalName(argument.name, schema.name)
  );
}

function buildPositionalDirectiveLine(
  directive: AnyDirectiveSchema,
  positionalIndex: number,
  serializedValue: string,
  indent: string
): string | null {
  const parts: string[] = [];
  const positionalSchemas = directive.positional ?? [];

  for (let index = 0; index < positionalIndex; index++) {
    const fallback = positionalSchemas[index]?.default;
    if (fallback === undefined) return null;
    const normalized = normalizeScalarValue(positionalSchemas[index], fallback);
    if (!normalized.ok) return null;
    const serialized = serializePositionalValue(
      directive.name,
      positionalSchemas[index],
      normalized.value
    );
    if (!serialized.ok) return null;
    parts.push(serialized.value);
  }
  parts.push(serializedValue);
  return `${indent}!${directive.name} ${parts.join(" ")}`;
}

function replaceBackgroundArgument(
  lines: EditableLine[],
  occurrence: DirectiveOccurrence,
  normalizedValue: string
): void {
  const args = occurrence.info.args;
  const leading = args.match(/^\s*/)?.[0] ?? " ";
  const trailing = args.match(/\s*$/)?.[0] ?? "";
  rewriteLineArgs(
    lines,
    occurrence.lineIndex,
    occurrence.info,
    `${leading || " "}${normalizedValue}${trailing}`
  );
}

function applyPositionalEdit(
  originalMarkdown: string,
  context: SceneContext,
  edit: DirectiveValueEdit,
  directive: AnyDirectiveSchema,
  positional: DirectiveValueSchema
): DirectiveEditResult {
  const lines = context.lines.map((line) => ({ ...line }));
  const occurrence = locateDirectiveOccurrence(context, directive.name);
  const positionalIndex = positionalIndexFor(directive, positional);
  if (positionalIndex < 0) return failure(`Unknown positional argument ${positional.name}`);

  if (edit.value === null && positional.required) {
    // For single-line scene metadata, removing the required positional value is
    // exactly removing the directive itself. Content-bearing positional
    // directives (notably diff/callout/emoji) are not safe to auto-strip.
    if (!["duration", "background", "transition", "chapter", "locale"].includes(directive.name)) {
      return failure(`${directive.name} ${positional.name} is required and cannot be removed`);
    }
  }

  const normalized =
    edit.value === null ? null : normalizeScalarValue(positional, edit.value);
  if (normalized !== null && !normalized.ok) return failure(normalized.reason);
  const normalizedValue = normalized === null ? null : normalized.value;

  if (!occurrence) {
    if (edit.value === null || normalizedValue === null) {
      return successResult(originalMarkdown, lines, "noop", context.sceneRange.startLine);
    }
    const serialized = serializePositionalValue(directive.name, positional, normalizedValue);
    if (!serialized.ok) return failure(serialized.reason);
    const sceneLine = context.lines[context.sceneRange.startLine - 1];
    const sceneInfo = parseDirectiveLineBody(sceneLine?.body ?? "");
    const line = buildPositionalDirectiveLine(
      directive,
      positionalIndex,
      serialized.value,
      sceneInfo?.indent ?? ""
    );
    if (!line) {
      return failure(
        `Cannot insert ${directive.name} ${positional.name} before its required positional arguments`
      );
    }
    const insertionIndex = context.sceneRange.startLine;
    insertLineBodies(lines, insertionIndex, [line], sceneLine?.cr ?? "");
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "inserted",
      insertionIndex + 1,
      edit,
      directive,
      "positional",
      positional,
      normalizedValue
    );
  }

  if (edit.value === null) {
    if (positionalIndex === 0 || positional.required) {
      removeLineAt(lines, occurrence.lineIndex);
      return finishEdit(
        originalMarkdown,
        context,
        lines,
        "removed",
        occurrence.range.startLine,
        edit,
        directive,
        "positional",
        positional,
        null
      );
    }
  }

  if (occurrence.info.colonAttached) {
    return failure("Colon-attached directive shorthand is not token-editable");
  }

  const tokens = tokenizeInlineArgumentsDetailed(occurrence.info.args);
  const positionalTokens = tokens.filter((token) => token.key === undefined);
  const target = positionalTokens[positionalIndex];

  if (edit.value === null) {
    if (!target) return successResult(originalMarkdown, lines, "noop", occurrence.range.startLine);
    if (positionalTokens.length > positionalIndex + 1) {
      return failure("Cannot remove a positional argument that later positional arguments depend on");
    }
    rewriteLineArgs(
      lines,
      occurrence.lineIndex,
      occurrence.info,
      removeTokenFromArgs(occurrence.info.args, target)
    );
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "removed",
      occurrence.range.startLine,
      edit,
      directive,
      "positional",
      positional,
      null
    );
  }

  if (normalizedValue === null) return failure("Invalid empty value");
  const serialized = serializePositionalValue(directive.name, positional, normalizedValue);
  if (!serialized.ok) return failure(serialized.reason);

  if (directive.name === "background" && positionalIndex === 0) {
    replaceBackgroundArgument(lines, occurrence, normalizedValue);
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "updated",
      occurrence.range.startLine,
      edit,
      directive,
      "positional",
      positional,
      normalizedValue
    );
  }

  if (target) {
    rewriteLineArgs(
      lines,
      occurrence.lineIndex,
      occurrence.info,
      replaceWholeTokenInArgs(occurrence.info.args, target, serialized.value)
    );
    return finishEdit(
      originalMarkdown,
      context,
      lines,
      "updated",
      occurrence.range.startLine,
      edit,
      directive,
      "positional",
      positional,
      normalizedValue
    );
  }

  if (positionalTokens.length < positionalIndex) {
    return failure(
      `Cannot write ${directive.name} ${positional.name} before earlier positional arguments exist`
    );
  }

  rewriteLineArgs(
    lines,
    occurrence.lineIndex,
    occurrence.info,
    appendInlineText(occurrence.info.args, serialized.value)
  );
  return finishEdit(
    originalMarkdown,
    context,
    lines,
    "inserted",
    occurrence.range.startLine,
    edit,
    directive,
    "positional",
    positional,
    normalizedValue
  );
}

/**
 * Apply one schema-described value edit to a scene directive.
 *
 * The function is deliberately total: malformed documents, ambiguous token
 * positions, unsupported structured values, and failed read-back validation
 * all produce `{ ok: false }` instead of throwing or emitting partial markdown.
 */
export function applyDirectiveValueEdit(
  markdown: string,
  edit: DirectiveValueEdit
): DirectiveEditResult {
  const directive = getDirectiveSchema(edit.directive);
  if (!directive) return failure(`Unknown directive ${edit.directive}`);
  if (!SCENE_SCOPED_DIRECTIVES.has(directive.name)) {
    return failure(`${directive.name} is not editable inside a scene`);
  }

  const resolved = resolveValueSchema(directive, edit);
  if (!resolved) {
    return failure(`Unknown ${edit.kind ?? "property/positional"} value ${edit.valueName}`);
  }

  const context = getSceneContext(markdown, edit.sceneIndex);
  if (!context) return failure(`Scene ${edit.sceneIndex} could not be located safely`);

  if (resolved.kind === "property") {
    return applyPropertyEdit(
      markdown,
      context,
      edit,
      directive,
      resolved.schema as DirectivePropertySchema
    );
  }
  return applyPositionalEdit(markdown, context, edit, directive, resolved.schema);
}
