export type ByteRange = { start: number; end: number };

/**
 * Parse one HTTP byte range. Suffix ranges are supported because video
 * players use them for tail metadata; multi-ranges are deliberately rejected
 * as they require multipart content and are not useful for mp4 playback.
 */
export function parseSingleByteRange(
  header: string | null,
  size: number,
): ByteRange | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const startText = match[1]!;
  const endText = match[2]!;
  if (!startText && !endText) return "invalid";

  let start: number;
  let end: number;
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return "invalid";
    if (end >= size) end = size - 1;
  }

  if (start >= size || start > end || start < 0) return "invalid";
  return { start, end };
}
