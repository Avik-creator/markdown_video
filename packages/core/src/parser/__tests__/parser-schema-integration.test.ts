import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getQuickReference } from "../../documentation.js";
import { parseMarkdown } from "../index.js";

describe("parser/schema integration", () => {
  describe("transitions", () => {
    it("emits the schema default duration when a valid transition omits it", () => {
      const [scene] = parseMarkdown(`!scene
!transition slide
!text
Hello
`);

      expect(scene.transition).toBe("slide");
      expect(scene.transitionDuration).toBe(0.5);
    });

    it("parses explicit durations through schema aliases, with or without the seconds suffix", () => {
      const scenes = parseMarkdown(`!scene
!trans zoom 1.25s

---

!scene
!effect wipe 0.75
`);

      expect(scenes[0]).toMatchObject({
        transition: "zoom",
        transitionDuration: 1.25,
      });
      expect(scenes[1]).toMatchObject({
        transition: "wipe",
        transitionDuration: 0.75,
      });
    });

    it("retains a syntactically numeric but out-of-range transition duration for source validation", () => {
      const [scene] = parseMarkdown(`!scene
!transition fade -0.25s
`);

      expect(scene.transition).toBe("fade");
      expect(scene.transitionDuration).toBe(-0.25);
    });

    it("does not place an invalid transition enum string in typed parse output", () => {
      const [scene] = parseMarkdown(`!scene
!transition teleport 1s
`);

      expect(scene.transition).toBeUndefined();
      expect(scene.transitionDuration).toBeUndefined();
    });
  });

  describe("callouts", () => {
    it.each(["info", "warning", "error", "success"] as const)(
      "parses the schema callout style %s",
      (style) => {
        const [scene] = parseMarkdown(`!scene
!callout "Important" arrow:right target:line:5 style:${style}
`);

        expect(scene.callout).toMatchObject({
          text: "Important",
          arrow: "right",
          target: "line:5",
          style,
        });
      }
    );

    it("keeps info as the default callout style", () => {
      const [scene] = parseMarkdown(`!scene
!callout "Important" arrow:down
`);

      expect(scene.callout?.style).toBe("info");
    });

    it("parses styles on schema callout aliases", () => {
      const [scene] = parseMarkdown(`!scene
!tip "Be careful" style:error
`);

      expect(scene.callout).toMatchObject({
        text: "Be careful",
        style: "error",
      });
    });
  });

  describe("block property key casing", () => {
    it("parses exact schema casing for code font keys and canonicalizes font values", () => {
      const [scene] = parseMarkdown(`!scene
!code
fontSize: lg
fontFamily: JetBrains
\`\`\`ts
const x = 1;
\`\`\`
`);

      expect(scene.code).toMatchObject({
        fontSize: "lg",
        fontFamily: "jetbrains",
      });
    });

    it("does not parse capitalized/all-caps block keys, but accepts legacy lowercase spellings", () => {
      // `FontSize`/`FONTFAMILY` start capitals and are treated as non-property
      // lines. The all-lowercase spellings `fontsize`/`fontfamily` are the
      // pre-refactor parser's documented forms (it lowercased every key) and
      // are registered aliases, so they keep working.
      const [scene] = parseMarkdown(`!scene
!code
FontSize: xl
fontsize: md
FONTFAMILY: JetBrains
fontfamily: fira
\`\`\`ts
const x = 1;
\`\`\`
`);

      expect(scene.code).toMatchObject({
        fontSize: "md",
        fontFamily: "fira",
      });
    });

    it("preserves case-mismatched text keys as prose instead of consuming them as properties", () => {
      const [scene] = parseMarkdown(`!scene
!text
Hello
FONTFAMILY: DISPLAY
`);

      expect(scene.text).toMatchObject({
        content: "Hello\nFONTFAMILY: DISPLAY",
        fontFamily: "sans",
      });
    });

    it("does not consume colon-bearing prose merely because it resembles another directive's key", () => {
      const [scene] = parseMarkdown(`!scene
!text
fontSize: this is prose, not a code setting
FONTFAMILY is discussed here
`);

      expect(scene.text?.content).toBe(
        "fontSize: this is prose, not a code setting\nFONTFAMILY is discussed here"
      );
    });

    it("parses inline property keys case-insensitively", () => {
      const [imageScene] = parseMarkdown(`!scene
!image src:/hero.png FIT:contain POSITION:top ALT:"Hero image"
`);

      expect(imageScene.image).toEqual({
        src: "/hero.png",
        fit: "contain",
        position: "top",
        alt: "Hero image",
      });

      const [chartScene] = parseMarkdown(`!scene
!chart Type:line ANIMATE:false
Revenue: 10
`);

      expect(chartScene.chart).toMatchObject({
        type: "line",
        animate: false,
      });
    });
  });

  describe("canonical constrained output", () => {
    it("only accepts a seconds suffix where the schema declares a seconds unit", () => {
      const [codeScene] = parseMarkdown(`!scene
!code
speed: 75s
height: 240s
\`\`\`ts
const x = 1;
\`\`\`
`);

      expect(codeScene.code).toMatchObject({
        typingSpeed: 50,
        height: undefined,
      });

      const [cameraScene] = parseMarkdown(`!scene
!camera zoom:1.8s duration:2s
`);

      expect(cameraScene.camera).toMatchObject({
        effect: "zoom",
        value: 1.5,
        duration: 2,
      });

      const [qrScene] = parseMarkdown(`!scene
!qr url:https://example.com size:300s
`);

      expect(qrScene.qr?.size).toBe(200);
    });

    it("accepts optional seconds suffixes for schema seconds values", () => {
      const [scene] = parseMarkdown(`!scene
!text
Hello
stagger: 0.2s
at: 1s
duration: 2s
`);

      expect(scene.text?.stagger).toBe(0.2);
      expect(scene.timelineElements?.[0]).toMatchObject({ at: 1, duration: 2 });
    });

    it("canonicalizes invalid constrained values to schema defaults instead of typed impossible output", () => {
      const [scene] = parseMarkdown(`!scene
!particles type:plasma intensity:extreme
!presenter position:nowhere size:huge shape:hexagon
`);

      expect(scene.particles).toEqual({
        type: "confetti",
        intensity: "medium",
      });
      expect(scene.presenter).toEqual({
        position: "bottom-right",
        size: "md",
        shape: "circle",
      });
    });

    it("omits invalid optional camera keyframe enum values while preserving valid numeric structure", () => {
      const [scene] = parseMarkdown(`!scene
!camera
- at:1s zoom:1.2 pan:diagonal shake:true shakeIntensity:extreme
`);

      expect(scene.camera?.keyframes?.[0]).toEqual({
        at: 1,
        zoom: 1.2,
        pan: undefined,
        shake: true,
        shakeIntensity: undefined,
      });
    });

    it("does not place an invalid camera effect string in typed parse output", () => {
      const [scene] = parseMarkdown(`!scene
!camera rotate:2
`);

      expect(scene.camera?.effect).toBe("zoom");
    });
  });

  describe("schema aliases", () => {
    it("canonicalizes property aliases to the same parsed output as canonical keys", () => {
      const [scene] = parseMarkdown(`!scene
!mockup device:browser background:#111111 image:/screenshot.png fit:contain
`);

      expect(scene.mockup).toMatchObject({
        device: "browser",
        content: {
          type: "image",
          background: "#111111",
          image: { src: "/screenshot.png", fit: "contain" },
        },
      });
    });

    it("supports both canonical and alias spellings for the text i18n key", () => {
      const scenes = parseMarkdown(`!scene
!text
Hello
i18nKey: welcome

---

!scene
!text
Hello
i18n: welcome
`);

      expect(scenes[0].text?.i18nKey).toBe("welcome");
      expect(scenes[1].text?.i18nKey).toBe("welcome");
    });
  });

  describe("layout child syntax", () => {
    it("parses ordered child directives and explicit left/right labels", () => {
      const [scene] = parseMarkdown(`!scene
!layout split:vertical
!text
Top panel copy
!image src:/bottom.png fit:contain
`);

      expect(scene.split).toMatchObject({
        direction: "vertical",
        left: {
          type: "text",
          text: { content: "Top panel copy" },
        },
        right: {
          type: "image",
          image: { src: "/bottom.png", fit: "contain" },
        },
      });

      const [labeledScene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!text
Left copy
right:
!text
Right copy
`);

      expect(labeledScene.split?.left.text?.content).toBe("Left copy");
      expect(labeledScene.split?.right.text?.content).toBe("Right copy");
    });

    it("is ratified in the MCP quick-reference documentation", () => {
      const reference = getQuickReference();

      expect(reference).toContain("left:");
      expect(reference).toContain("right:");
      expect(reference).toContain("!layout split:horizontal");
    });
  });

  describe("implementation type safety", () => {
    it("does not require unsafe any or unknown casts in the parser implementation", () => {
      const implementationFiles = [
        "index.ts",
        "constants.ts",
        "utils.ts",
        "timeline.ts",
        "parsers/chart-parser.ts",
        "parsers/code-parser.ts",
        "parsers/diff-parser.ts",
        "parsers/index.ts",
        "parsers/layout-parser.ts",
        "parsers/schema-values.ts",
        "parsers/terminal-parser.ts",
      ];

      for (const file of implementationFiles) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        expect(source, file).not.toMatch(/\bas\s+any\b/);
        expect(source, file).not.toMatch(/\bas\s+unknown\s+as\b/);
      }
    });
  });
});
