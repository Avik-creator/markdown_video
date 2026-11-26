import { describe, expect, it } from "vitest";
import { validateMarkdownSyntax } from "../validation.js";

function messages(result: ReturnType<typeof validateMarkdownSyntax>) {
  return [...result.errors, ...result.warnings].map((entry) => entry.message);
}

describe("music validation", () => {
  it("accepts a valid document-level HTTPS music directive", () => {
    const result = validateMarkdownSyntax(`!music https://example.com/theme.mp3 volume:0.4 fade:1s loop:true
!scene
!text
Hello
`);

    expect(result.errors).toEqual([]);
    expect(messages(result).some((message) => message.includes("!music"))).toBe(false);
  });

  it("rejects insecure remote HTTP music URLs", () => {
    const result = validateMarkdownSyntax("!music http://example.com/theme.mp3\n!scene\n!text\nHi\n");

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message === "Remote music must use HTTPS")).toBe(true);
  });

  it("rejects missing music sources and unsupported schemes", () => {
    const missing = validateMarkdownSyntax("!music volume:0.4\n!scene\n!text\nHi\n");
    expect(missing.errors.some((error) => error.message.includes("requires an HTTPS URL or audio file"))).toBe(true);

    const scheme = validateMarkdownSyntax("!music ftp://example.com/theme.mp3\n!scene\n!text\nHi\n");
    expect(scheme.errors.some((error) => error.message.includes("Unsupported music source scheme"))).toBe(true);
  });

  it("warns when music is placed inside a scene because the parser ignores it", () => {
    const result = validateMarkdownSyntax(`!scene
!music theme.mp3
!text
Hi
`);

    expect(result.warnings.some((warning) =>
      warning.message === "!music is document-level metadata and is ignored inside a scene"
    )).toBe(true);
  });

  it("uses schema-backed validation for invalid volume, fade, and loop values", () => {
    const result = validateMarkdownSyntax("!music theme.mp3 volume:2 fade:31 loop:yes\n!scene\n!text\nHi\n");
    const errorMessages = result.errors.map((error) => error.message);

    expect(errorMessages.some((message) => message.includes("Music volume must be at most 1"))).toBe(true);
    expect(errorMessages.some((message) => message.includes("Music fade duration must be at most 30"))).toBe(true);
    expect(errorMessages.some((message) => message.includes('Invalid music loop "yes"'))).toBe(true);
  });

  it("warns about replacement and fades that will be clamped to the video midpoint", () => {
    const result = validateMarkdownSyntax(`!music first.mp3
!music second.mp3 fade:3
!scene
!duration 4
!text
Hi
`);
    const warningMessages = result.warnings.map((warning) => warning.message);

    expect(warningMessages.some((message) => message.includes("later !music replaces the earlier one"))).toBe(true);
    expect(warningMessages.some((message) => message.includes("exceeds half the video duration"))).toBe(true);
  });

  it("rejects credential-bearing HTTPS music URLs", () => {
    const result = validateMarkdownSyntax("!music https://user:secret@example.com/theme.mp3\n!scene\n!text\nHi\n");

    expect(result.errors.some((error) => error.message === "Music URLs must not embed credentials")).toBe(true);
  });
});
