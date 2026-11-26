// Inline share payloads are versioned as:
//   v1.<8-char crc32 of the UTF-8 bytes>.<base64url UTF-8 markdown>
// The checksum lets recipients distinguish truncated/corrupted links from
// valid documents. Unprefixed payloads are decoded as the legacy
// btoa(encodeURIComponent(markdown)) format for backwards compatibility.
const SHARE_PAYLOAD_PREFIX = "v1.";
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LEGACY_BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LEGACY_TRUNCATED_PAYLOAD_LENGTH = 500;

export const MAX_SHARE_URL_LENGTH = 2000;
export const MAX_SHARE_MARKDOWN_BYTES = 1_000_000;

export type ShareMarkdownPayloadFormat = "base64url-v1" | "legacy-base64";

export type ShareMarkdownDecodeError =
  | "empty"
  | "unsupported-version"
  | "invalid-format"
  | "invalid-characters"
  | "invalid-length"
  | "invalid-utf8"
  | "checksum-mismatch"
  | "malformed-legacy";

export type ShareMarkdownDecodeResult =
  | {
      ok: true;
      markdown: string;
      format: ShareMarkdownPayloadFormat;
    }
  | {
      ok: false;
      error: ShareMarkdownDecodeError;
    };

const CRC32_TABLE = createCrc32Table();
const BASE64URL_VALUES = createAlphabetValues(BASE64URL_ALPHABET);
const LEGACY_BASE64_VALUES = createAlphabetValues(LEGACY_BASE64_ALPHABET);

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

function crc32(bytes: Uint8Array): number {
  let checksum = 0xffffffff;

  for (const byte of bytes) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

function crc32Hex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).padStart(8, "0");
}

function createAlphabetValues(alphabet: string): Map<string, number> {
  const values = new Map<string, number>();
  for (let index = 0; index < alphabet.length; index += 1) {
    values.set(alphabet[index], index);
  }
  return values;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : undefined;
    const third = index + 2 < bytes.length ? bytes[index + 2] : undefined;

    encoded += BASE64URL_ALPHABET[first >> 2];
    encoded += BASE64URL_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];

    if (second !== undefined) {
      encoded += BASE64URL_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    }

    if (third !== undefined) {
      encoded += BASE64URL_ALPHABET[third & 0x3f];
    }
  }

  return encoded;
}

type Base64DecodeResult =
  | { ok: true; bytes: Uint8Array }
  | {
      ok: false;
      error: Extract<ShareMarkdownDecodeError, "empty" | "invalid-format" | "invalid-characters" | "invalid-length">;
    };

function decodeBase64(input: string, alphabetValues: Map<string, number>): Base64DecodeResult {
  if (input.length === 0) {
    return { ok: false, error: "empty" };
  }

  let paddingLength = 0;
  while (paddingLength < input.length && input[input.length - 1 - paddingLength] === "=") {
    paddingLength += 1;
  }

  if (paddingLength > 2) {
    return { ok: false, error: "invalid-format" };
  }

  const body = input.slice(0, input.length - paddingLength);
  if (body.length === 0) {
    return { ok: false, error: "empty" };
  }

  if (body.includes("=")) {
    return { ok: false, error: "invalid-characters" };
  }

  if (paddingLength > 0) {
    const expectedPadding = body.length % 4 === 2 ? 2 : body.length % 4 === 3 ? 1 : 0;
    if (paddingLength !== expectedPadding) {
      return { ok: false, error: "invalid-format" };
    }
  }

  if (body.length % 4 === 1) {
    return { ok: false, error: "invalid-length" };
  }

  const bytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  for (const character of body) {
    const value = alphabetValues.get(character);
    if (value === undefined) {
      return { ok: false, error: "invalid-characters" };
    }

    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >> bitCount) & 0xff);
      bitBuffer &= (1 << bitCount) - 1;
    }
  }

  // Canonical base64 pads unused low bits with zeroes. Rejecting non-zero
  // trailing bits catches otherwise plausible-looking corrupted payloads.
  if (bitCount > 0 && bitBuffer !== 0) {
    return { ok: false, error: "invalid-format" };
  }

  return { ok: true, bytes: Uint8Array.from(bytes) };
}

function decodeUtf8(bytes: Uint8Array): { ok: true; markdown: string } | { ok: false; error: "invalid-utf8" } {
  try {
    return { ok: true, markdown: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: "invalid-utf8" };
  }
}

function decodeVersionedPayload(payload: string): ShareMarkdownDecodeResult {
  const remainder = payload.slice(SHARE_PAYLOAD_PREFIX.length);
  const separatorIndex = remainder.indexOf(".");

  if (separatorIndex <= 0) {
    return { ok: false, error: "invalid-format" };
  }

  const expectedChecksum = remainder.slice(0, separatorIndex).toLowerCase();
  const encodedMarkdown = remainder.slice(separatorIndex + 1);

  if (!/^[0-9a-f]{8}$/.test(expectedChecksum)) {
    return { ok: false, error: "invalid-format" };
  }

  if (!encodedMarkdown) {
    return { ok: false, error: "empty" };
  }

  const decoded = decodeBase64(encodedMarkdown, BASE64URL_VALUES);
  if (!decoded.ok) {
    return decoded;
  }

  if (crc32Hex(decoded.bytes) !== expectedChecksum) {
    return { ok: false, error: "checksum-mismatch" };
  }

  const utf8 = decodeUtf8(decoded.bytes);
  if (!utf8.ok) {
    return utf8;
  }

  return { ok: true, markdown: utf8.markdown, format: "base64url-v1" };
}

function decodeLegacyPayload(payload: string): ShareMarkdownDecodeResult {
  // The old generator truncated every oversized legacy payload to exactly 500
  // characters. A complete legacy payload of that length is indistinguishable
  // from a truncated one, so fail closed rather than silently loading a
  // partial document.
  if (payload.length === LEGACY_TRUNCATED_PAYLOAD_LENGTH) {
    return { ok: false, error: "malformed-legacy" };
  }

  // Legacy links inserted raw base64 into the query string. URL query parsers
  // treat '+' as a space, but base64 itself never contains spaces, so every
  // space in one of these payloads can only be a corrupted '+'.
  const normalizedPayload = payload.replace(/ /g, "+");
  const decoded = decodeBase64(normalizedPayload, LEGACY_BASE64_VALUES);

  if (!decoded.ok) {
    return decoded;
  }

  // The legacy encoder was btoa(encodeURIComponent(markdown)). Its decoded
  // intermediate representation is therefore always ASCII.
  for (const byte of decoded.bytes) {
    if (byte > 0x7f) {
      return { ok: false, error: "malformed-legacy" };
    }
  }

  const percentEncodedMarkdown = new TextDecoder("utf-8").decode(decoded.bytes);

  try {
    return {
      ok: true,
      markdown: decodeURIComponent(percentEncodedMarkdown),
      format: "legacy-base64",
    };
  } catch {
    return { ok: false, error: "malformed-legacy" };
  }
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isShareDocumentTooLarge(markdown: string): boolean {
  return getUtf8ByteLength(markdown) > MAX_SHARE_MARKDOWN_BYTES;
}

export function encodeShareMarkdown(markdown: string): string {
  if (markdown.length === 0) {
    throw new Error("Cannot encode an empty markdown document");
  }

  const bytes = new TextEncoder().encode(markdown);
  return `${SHARE_PAYLOAD_PREFIX}${crc32Hex(bytes)}.${encodeBase64Url(bytes)}`;
}

export function decodeShareMarkdownPayload(payload: string): ShareMarkdownDecodeResult {
  if (!payload) {
    return { ok: false, error: "empty" };
  }

  if (payload.startsWith(SHARE_PAYLOAD_PREFIX)) {
    return decodeVersionedPayload(payload);
  }

  if (/^v\d+\./.test(payload)) {
    return { ok: false, error: "unsupported-version" };
  }

  return decodeLegacyPayload(payload);
}

export function getInlineShareLinkLength(markdown: string, origin: string): number {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const encodedMarkdownLength = Math.ceil((getUtf8ByteLength(markdown) * 4) / 3);
  // v1. + 8 hexadecimal checksum characters + the second separator dot.
  const payloadMetadataLength = SHARE_PAYLOAD_PREFIX.length + 8 + 1;
  return `${normalizedOrigin}/editor?md=`.length + payloadMetadataLength + encodedMarkdownLength;
}

export function canUseInlineShareLink(markdown: string, origin: string): boolean {
  return getInlineShareLinkLength(markdown, origin) <= MAX_SHARE_URL_LENGTH;
}

export function buildInlineShareLink(markdown: string, origin: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return `${normalizedOrigin}/editor?md=${encodeShareMarkdown(markdown)}`;
}
