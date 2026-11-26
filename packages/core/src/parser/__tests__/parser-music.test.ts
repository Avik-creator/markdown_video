import { describe, expect, it } from "vitest";
import { parseMarkdownFull } from "../index.js";

describe("document music parsing", () => {
  it("parses an HTTPS positional URL with schema defaults", () => {
    const result = parseMarkdownFull(`!music https://example.com/theme.mp3
!scene
!text
Hello
`);

    expect(result.music).toEqual({
      src: "https://example.com/theme.mp3",
      volume: 0.4,
      fade: 1,
      loop: true,
    });
    expect(result.scenes).toHaveLength(1);
  });

  it("parses quoted file paths and explicit volume/fade/loop properties", () => {
    const result = parseMarkdownFull(`!music "audio/my theme.mp3" volume:0.25 fade:0.5s loop:false
!scene
!text
Hello
`);

    expect(result.music).toEqual({
      src: "audio/my theme.mp3",
      volume: 0.25,
      fade: 0.5,
      loop: false,
    });
  });

  it("uses the most recent valid document-level declaration", () => {
    const result = parseMarkdownFull(`!music first.mp3 volume:0.1
!music second.mp3 volume:0.7 fade:2 loop:false
`);

    expect(result.music).toEqual({
      src: "second.mp3",
      volume: 0.7,
      fade: 2,
      loop: false,
    });
  });

  it("ignores music inside a scene, matching other document-level metadata", () => {
    const result = parseMarkdownFull(`!scene
!music inside.mp3
!text
Hello
`);

    expect(result.music).toBeUndefined();
    expect(result.scenes[0]?.text?.content).toBe("Hello");
  });

  it("substitutes document variables in music sources", () => {
    const result = parseMarkdownFull(`!var theme audio/theme.mp3
!music $theme volume:0.6
`);

    expect(result.music?.src).toBe("audio/theme.mp3");
    expect(result.music?.volume).toBe(0.6);
  });

  it("clamps out-of-range values so parsing remains deterministic while validation reports the error", () => {
    const result = parseMarkdownFull("!music theme.mp3 volume:2 fade:99");

    expect(result.music?.volume).toBe(1);
    expect(result.music?.fade).toBe(30);
  });

  it("does not treat URL schemes as key:value properties", () => {
    const result = parseMarkdownFull("!music data:audio/mpeg;base64,AAAA volume:0.5");

    expect(result.music?.src).toBe("data:audio/mpeg;base64,AAAA");
    expect(result.music?.volume).toBe(0.5);
  });
});
