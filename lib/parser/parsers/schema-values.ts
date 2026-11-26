// Schema-aware value parsing helpers shared by parser branches.
//
// The parser produces typed, canonical scene values. Source-level validation
// remains responsible for reporting invalid user input; these helpers ensure
// valid input is recognized consistently and invalid constrained input never
// becomes a typed impossible enum value in the parse tree.

import {
  getCameraKeyframeProperty,
  getDirectivePositional,
  getDirectivePositionalDefault,
  getDirectiveProperty,
  getDirectivePropertyDefault,
  getDirectiveValueOptions,
  isOneOf,
  isOneOfCaseInsensitive,
  type DirectivePropertySchema,
  type DirectiveValueSchema,
} from "../../directive-schema";

export interface InlineToken {
  raw: string;
  key?: string;
  value?: string;
}

export interface ParsedInlineArguments {
  tokens: InlineToken[];
  positional: string[];
}

export interface ParsedDirectiveProperty {
  /** Canonical property spelling from the schema (for example `fontSize`). */
  name: string;
  value: string;
  schema: DirectivePropertySchema;
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

function tokenizeWhitespacePreservingQuotes(args: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  const flush = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = "";
    }
  };

  for (const char of args) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (/\s/.test(char)) {
      flush();
    } else {
      current += char;
    }
  }
  flush();

  return tokens;
}

/**
 * Tokenize inline directive arguments into positional values and key/value
 * pairs. Quoted values may contain whitespace, including the common forms
 * `label:"Scan me"` and `label: "Scan me"`.
 */
export function parseInlineArguments(args: string): ParsedInlineArguments {
  const rawTokens = tokenizeWhitespacePreservingQuotes(args);
  const tokens: InlineToken[] = [];

  for (let index = 0; index < rawTokens.length; index++) {
    const raw = rawTokens[index];

    const keyOnly = raw.match(/^([A-Za-z][\w-]*):$/);
    if (keyOnly && index + 1 < rawTokens.length) {
      const value = rawTokens[index + 1];
      tokens.push({
        raw: `${raw} ${value}`,
        key: keyOnly[1],
        value: stripQuotes(value),
      });
      index++;
      continue;
    }

    const keyValue = raw.match(/^([A-Za-z][\w-]*):(.+)$/);
    if (keyValue) {
      tokens.push({
        raw,
        key: keyValue[1],
        value: stripQuotes(keyValue[2]),
      });
    } else {
      tokens.push({ raw });
    }
  }

  return {
    tokens,
    positional: tokens
      .filter((token) => token.key === undefined)
      .map((token) => stripQuotes(token.raw)),
  };
}

/**
 * Read an inline `key:value` property using the schema's case-insensitive key
 * and alias matching. The returned value is unquoted but otherwise unchanged.
 */
export function getInlinePropertyValue(
  directiveName: string,
  args: string,
  propertyName: string
): string | undefined {
  const { tokens } = parseInlineArguments(args);
  const canonicalNeedle = propertyName.toLowerCase();

  for (const token of tokens) {
    if (!token.key || token.value === undefined) continue;
    const property = getDirectiveProperty(directiveName, token.key);
    if (property?.name.toLowerCase() === canonicalNeedle) {
      return token.value;
    }
  }

  return undefined;
}

/**
 * Parse a block `key:value` line only when the key belongs to the directive's
 * schema. Unknown colon-bearing lines return null so they remain ordinary
 * content exactly as written.
 */
export function parseDirectivePropertyLine(
  directiveName: string,
  line: string
): ParsedDirectiveProperty | null {
  const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
  if (!match) return null;

  const schema = getDirectiveProperty(directiveName, match[1]);
  if (!schema) return null;

  return {
    name: schema.name,
    value: stripQuotes(match[2]),
    schema,
  };
}

function valueSchema(
  directiveName: string,
  valueName: string
): DirectiveValueSchema | undefined {
  return (
    getDirectiveProperty(directiveName, valueName) ??
    getDirectivePositional(directiveName, valueName) ??
    (directiveName === "camera"
      ? getCameraKeyframeProperty(valueName)
      : undefined)
  );
}

/**
 * Parse an enum using the authoritative schema value list, then canonicalize
 * through the typed parser constant table. The typed table is schema-derived;
 * returning from it preserves the precise union type without assertions.
 */
export function parseDirectiveEnum<T extends string>(
  directiveName: string,
  valueName: string,
  rawValue: string | undefined,
  typedValues: readonly T[]
): T | undefined {
  if (rawValue === undefined) return undefined;

  const value = rawValue.trim();
  const schema = valueSchema(directiveName, valueName);
  const schemaValues = getDirectiveValueOptions(directiveName, valueName);
  if (schemaValues.length === 0) return undefined;

  const caseInsensitive = schema?.caseInsensitiveValues === true;
  const valid = caseInsensitive
    ? isOneOfCaseInsensitive(schemaValues, value)
    : isOneOf(schemaValues, value);
  if (!valid) return undefined;

  if (caseInsensitive) {
    const lower = value.toLowerCase();
    return typedValues.find((option) => option.toLowerCase() === lower);
  }
  return typedValues.find((option) => option === value);
}

export function parseDirectiveEnumOrDefault<T extends string>(
  directiveName: string,
  valueName: string,
  rawValue: string | undefined,
  typedValues: readonly T[],
  defaultValue: T
): T {
  return (
    parseDirectiveEnum(directiveName, valueName, rawValue, typedValues) ??
    defaultValue
  );
}

/** Parse numeric syntax, optionally allowing the schema seconds suffix. */
export function parseNumericValue(
  rawValue: string | undefined,
  options: { allowSecondsUnit?: boolean } = {}
): number | undefined {
  if (rawValue === undefined) return undefined;
  const pattern = options.allowSecondsUnit
    ? /^(-?(?:\d+(?:\.\d+)?|\.\d+))s?$/i
    : /^(-?(?:\d+(?:\.\d+)?|\.\d+))$/;
  const match = rawValue.trim().match(pattern);
  return match ? Number.parseFloat(match[1]) : undefined;
}

/** Parse a number using the schema's `unit: "seconds"` declaration. */
export function parseDirectiveNumericValue(
  directiveName: string,
  valueName: string,
  rawValue: string | undefined
): number | undefined {
  const schema = valueSchema(directiveName, valueName);
  return parseNumericValue(rawValue, {
    allowSecondsUnit: schema?.unit === "seconds",
  });
}

/** Schema booleans are the exact lowercase strings `true` and `false`. */
export function parseBooleanValue(rawValue: string | undefined): boolean | undefined {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  return undefined;
}

/** Schema property default with a local fallback for defensive robustness. */
export function directivePropertyDefault<T extends string | number | boolean>(
  directiveName: string,
  propertyName: string,
  fallback: T
): T {
  return getDirectivePropertyDefault<T>(directiveName, propertyName) ?? fallback;
}

/** Schema positional-argument default with a local fallback. */
export function directivePositionalDefault<T extends string | number | boolean>(
  directiveName: string,
  argumentName: string,
  fallback: T
): T {
  return getDirectivePositionalDefault<T>(directiveName, argumentName) ?? fallback;
}
