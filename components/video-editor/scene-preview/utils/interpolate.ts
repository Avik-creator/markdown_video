/**
 * Deterministic interpolation helpers for scene-time-driven animation.
 *
 * Both preview and export drive animation state from `sceneTime` instead of
 * wall-clock framer-motion animations, so interpolation has to handle every
 * shape of value that appears in the transition/animation variants:
 *
 * - plain numbers (`opacity`, `scale`, `x`, `rotate`, ...)
 * - percent strings (`x: "100%"`)
 * - numbers embedded in longer strings (`clipPath: "inset(0 100% 0 0)"`)
 * - numeric zero mixed with percentage zero (`x: "100%"` vs `x: 0`), since
 *   a zero is a zero regardless of unit.
 *
 * Values that cannot be interpolated meaningfully (mismatched units on
 * nonzero numbers, different string structure, colors) fall back to the
 * original snap-at-end behavior.
 */

interface NumericToken {
  type: "number";
  value: number;
  unit: string;
}

interface LiteralToken {
  type: "literal";
  text: string;
}

type Token = NumericToken | LiteralToken;

function tokenize(input: string): Token[] {
  // Matches a number (integer, decimal, or leading-dot decimal) plus any
  // trailing unit characters (px, %, deg, em, ...). Instantiated per call —
  // a module-level global regex would carry mutable lastIndex state.
  const pattern = /(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)/gi;
  const tokens: Token[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "literal", text: input.slice(lastIndex, match.index) });
    }
    tokens.push({
      type: "number",
      value: parseFloat(match[1]),
      unit: match[2].toLowerCase(),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    tokens.push({ type: "literal", text: input.slice(lastIndex) });
  }
  return tokens;
}

function formatNumber(value: number): string {
  // Round to 3 decimals to avoid noisy floats like 33.333333333333336.
  const rounded = Math.round(value * 1000) / 1000;
  // Normalize -0 to 0.
  return String(rounded === 0 ? 0 : rounded);
}

/**
 * Decide whether two numeric tokens can be interpolated, and which unit the
 * output should carry. A zero value is unitless-compatible: 0 px, 0% and 0
 * are all the same value, so a zero may adopt the other side's unit.
 */
function resolveUnit(
  a: NumericToken,
  b: NumericToken
): { compatible: boolean; unit: string } {
  if (a.unit === b.unit) {
    return { compatible: true, unit: a.unit };
  }
  if (a.value === 0 && b.value === 0) {
    // Both zero: unit is irrelevant, use the target's unit.
    return { compatible: true, unit: b.unit };
  }
  if (a.value === 0) {
    return { compatible: true, unit: b.unit };
  }
  if (b.value === 0) {
    return { compatible: true, unit: b.unit };
  }
  return { compatible: false, unit: b.unit };
}

function interpolateStrings(
  initial: string,
  animate: string,
  progress: number
): string | null {
  // Never interpolate colors or hex-like strings.
  if (initial.includes("#") || animate.includes("#")) {
    return null;
  }

  const initialTokens = tokenize(initial);
  const animateTokens = tokenize(animate);

  if (initialTokens.length !== animateTokens.length) {
    return null;
  }

  let result = "";
  for (let i = 0; i < initialTokens.length; i++) {
    const a = initialTokens[i];
    const b = animateTokens[i];

    if (a.type !== b.type) {
      return null;
    }

    if (a.type === "literal" && b.type === "literal") {
      if (a.text !== b.text) {
        return null;
      }
      result += a.text;
      continue;
    }

    const numA = a as NumericToken;
    const numB = b as NumericToken;
    const { compatible, unit } = resolveUnit(numA, numB);
    if (!compatible) {
      return null;
    }

    const value = numA.value + (numB.value - numA.value) * progress;
    result += formatNumber(value) + unit;
  }

  return result;
}

/**
 * Interpolate a single variant value. Returns the initial value for
 * progress <= 0 and the animate value for progress >= 1 so endpoints always
 * match the authored values exactly. Incompatible values snap at the end,
 * matching the previous behavior.
 */
export function interpolateValue(
  initial: unknown,
  animate: unknown,
  progress: number
): unknown {
  if (progress <= 0) {
    return initial;
  }
  if (progress >= 1) {
    return animate;
  }

  if (typeof initial === "number" && typeof animate === "number") {
    return initial + (animate - initial) * progress;
  }

  if (typeof initial === "string" && typeof animate === "string") {
    const interpolated = interpolateStrings(initial, animate, progress);
    if (interpolated !== null) {
      return interpolated;
    }
    return initial;
  }

  // Mixed number/string: numeric zero is compatible with any zero-unit
  // string, so `x: "100%"` -> `x: 0` interpolates as percentages instead of
  // snapping at the end.
  if (typeof initial === "string" && typeof animate === "number") {
    if (animate === 0) {
      const tokens = tokenize(initial);
      if (tokens.length === 1 && tokens[0].type === "number") {
        const token = tokens[0];
        if (token.unit !== "" && token.value !== 0) {
          // e.g. x: "100%" -> x: 0 interpolates through percentages.
          const value = token.value + (0 - token.value) * progress;
          return formatNumber(value) + token.unit;
        }
        if (token.unit === "") {
          // A pure numeric string without a unit interpolates as a number.
          return token.value + (animate - token.value) * progress;
        }
      }
    }
    return initial;
  }

  if (typeof initial === "number" && typeof animate === "string") {
    if (initial === 0) {
      const tokens = tokenize(animate);
      if (tokens.length === 1 && tokens[0].type === "number") {
        const token = tokens[0];
        if (token.unit !== "" && token.value !== 0) {
          const value = 0 + (token.value - 0) * progress;
          return formatNumber(value) + token.unit;
        }
        if (token.unit === "") {
          return initial + (token.value - initial) * progress;
        }
      }
    }
    return initial;
  }

  return initial;
}

/**
 * Interpolate every key of an animate/initial variant pair, producing a
 * state object suitable for `controls.set()`.
 *
 * The record values are typed loosely (`any`) because framer-motion's
 * `AnimationDefinition` uses template-literal index signatures that plain
 * records don't satisfy structurally — the interpolated values themselves
 * are always numbers or strings.
 */
export function interpolateVariantState(
  initial: Record<string, any> | undefined,
  animate: Record<string, any> | undefined,
  progress: number
): Record<string, any> {
  const state: Record<string, any> = {};
  if (!animate) {
    return state;
  }
  for (const key in animate) {
    state[key] = interpolateValue(initial?.[key], animate[key], progress);
  }
  return state;
}
