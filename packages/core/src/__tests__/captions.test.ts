import { describe, expect, it } from "vitest";
import {
  escapeVttText,
  generateCaptionSidecars,
  generateCaptions,
  getCaptionCueAtTime,
  normalizeCaptionText,
  serializeSrt,
  serializeVtt,
} from "../captions.js";
import { parseMarkdownFull } from "../parser/index.js";

describe("caption generation", () => {
  it("uses exact core timeline scene boundaries and golden SRT/VTT output", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 2
!text
Hello captions

---

!scene
!duration 3
!text
Second scene
`);
    const sidecars = generateCaptionSidecars(parsed);

    expect(sidecars.cues).toEqual([
      { sceneIndex: 0, startTime: 0, endTime: 2, text: "Hello captions" },
      { sceneIndex: 1, startTime: 2, endTime: 5, text: "Second scene" },
    ]);
    expect(sidecars.srt).toBe(`1
00:00:00,000 --> 00:00:02,000
Hello captions

2
00:00:02,000 --> 00:00:05,000
Second scene
`);
    expect(sidecars.vtt).toBe(`WEBVTT

00:00:00.000 --> 00:00:02.000
Hello captions

00:00:02.000 --> 00:00:05.000
Second scene
`);
  });

  it("keeps simultaneous multi-line text as one multi-line cue", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 2.5
!text
First line
Second line
`);

    expect(generateCaptions(parsed)).toEqual([
      {
        sceneIndex: 0,
        startTime: 0,
        endTime: 2.5,
        text: "First line\nSecond line",
      },
    ]);
    expect(serializeSrt(generateCaptions(parsed))).toContain(
      "00:00:00,000 --> 00:00:02,500\nFirst line\nSecond line"
    );
  });

  it("splits staggered lines at deterministic renderer reveal times", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 3
!text
Line one
Line two
Line three
stagger: 0.5
`);
    const cues = generateCaptions(parsed);

    expect(cues).toEqual([
      { sceneIndex: 0, startTime: 0.1, endTime: 0.6, text: "Line one" },
      { sceneIndex: 0, startTime: 0.6, endTime: 1.1, text: "Line two" },
      { sceneIndex: 0, startTime: 1.1, endTime: 3, text: "Line three" },
    ]);
    for (let index = 1; index < cues.length; index++) {
      expect(cues[index - 1].endTime).toBe(cues[index].startTime);
    }
  });

  it("omits staggered lines that would first appear after the scene ends", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 0.5
!text
Visible
Never visible
stagger: 1
`);

    expect(generateCaptions(parsed)).toEqual([
      { sceneIndex: 0, startTime: 0.1, endTime: 0.5, text: "Visible" },
    ]);
  });

  it("ignores non-text scenes and empty text", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 1
!code
\`\`\`js
console.log("not a caption")
\`\`\`

---

!scene
!duration 1
!text
`);

    expect(generateCaptions(parsed)).toEqual([]);
    expect(serializeSrt([])).toBe("");
    expect(serializeVtt([])).toBe("WEBVTT\n");
  });

  it("escapes WebVTT metacharacters without changing SRT text", () => {
    const parsed = parseMarkdownFull(`!scene
!duration 1
!text
A <tag> & a --> arrow
`);
    const [cue] = generateCaptions(parsed);

    expect(cue.text).toBe("A <tag> & a --> arrow");
    expect(serializeSrt([cue])).toContain("A <tag> & a --> arrow");
    expect(serializeVtt([cue])).toContain("A &lt;tag&gt; &amp; a --&gt; arrow");
    expect(escapeVttText("<&>")).toBe("&lt;&amp;&gt;");
  });

  it("resolves localized text with scene and export locale precedence", () => {
    const parsed = parseMarkdownFull(`!locales en es
!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"

!scene
!duration 1
!text i18n:welcome

---

!scene
!duration 1
!locale es
!text i18n:welcome
`);

    expect(generateCaptions(parsed, { activeLocale: "es" }).map((cue) => cue.text)).toEqual([
      "Bienvenido",
      "Bienvenido",
    ]);
    expect(generateCaptions(parsed, { activeLocale: "en" }).map((cue) => cue.text)).toEqual([
      "Welcome",
      "Bienvenido",
    ]);
  });

  it("uses half-open cue intervals for exact boundary lookup", () => {
    const cues = [
      { sceneIndex: 0, startTime: 0, endTime: 2, text: "first" },
      { sceneIndex: 1, startTime: 2, endTime: 4, text: "second" },
    ];

    expect(getCaptionCueAtTime(cues, 0)?.text).toBe("first");
    expect(getCaptionCueAtTime(cues, 1.999)?.text).toBe("first");
    expect(getCaptionCueAtTime(cues, 2)?.text).toBe("second");
    expect(getCaptionCueAtTime(cues, 4)).toBeNull();
  });

  it("normalizes control characters and blank lines without changing authored words", () => {
    expect(normalizeCaptionText("\r\nHello\u0007 there  \r\n\r\nWorld\r\n")).toBe(
      "Hello there\nWorld"
    );
  });
});
