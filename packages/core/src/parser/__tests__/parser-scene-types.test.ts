import { describe, expect, it } from "vitest";
import { parseMarkdown, parseMarkdownFull } from "../index.js";

describe("scene type parsing", () => {
  it("parses chart type, animation flag, labels, values, and colors", () => {
    const [scene] = parseMarkdown(`!scene
!chart type:bar animate:false
React: 85 #61dafb
Vue: 70
`);

    expect(scene.type).toBe("chart");
    expect(scene.chart).toEqual({
      type: "bar",
      animate: false,
      data: [
        { label: "React", value: 85, color: "#61dafb" },
        { label: "Vue", value: 70, color: undefined },
      ],
    });
  });

  it("parses diff additions, removals, context, and language", () => {
    const [scene] = parseMarkdown(`!scene
!diff typescript
  const unchanged = true;
- const mode = "before";
+ const mode = "after";
`);

    expect(scene.type).toBe("diff");
    expect(scene.diff).toEqual({
      language: "typescript",
      changes: [
        { type: "context", content: "  const unchanged = true;" },
        { type: "remove", content: " const mode = \"before\";" },
        { type: "add", content: " const mode = \"after\";" },
      ],
    });
  });

  it("parses image content inside a device mockup", () => {
    const [scene] = parseMarkdown(`!scene
!mockup device:iphone bg:#111111
image: /screenshot.png
fit: contain
`);

    expect(scene.type).toBe("mockup");
    expect(scene.mockup).toMatchObject({
      device: "iphone",
      content: {
        type: "image",
        background: "#111111",
        image: { src: "/screenshot.png", fit: "contain" },
      },
    });
  });

  it("parses QR code options", () => {
    const [scene] = parseMarkdown(`!scene
!qr url:https://example.com size:300 color:#000000 bg:#ffffff label:"Scan me"
`);

    expect(scene.type).toBe("qr");
    expect(scene.qr).toEqual({
      url: "https://example.com",
      size: 300,
      color: "#000000",
      bgColor: "#ffffff",
      label: "Scan me",
    });
  });

  it("parses countdown options", () => {
    const [scene] = parseMarkdown(`!scene
!countdown from:5 style:circle color:#22c55e
`);

    expect(scene.type).toBe("countdown");
    expect(scene.countdown).toEqual({
      from: 5,
      style: "circle",
      color: "#22c55e",
    });
  });

  it("parses progress options", () => {
    const [scene] = parseMarkdown(`!scene
!progress value:75 max:150 animate:false style:semicircle color:#3b82f6 label:"Loading"
`);

    expect(scene.type).toBe("progress");
    expect(scene.progress).toEqual({
      value: 75,
      max: 150,
      animate: false,
      style: "semicircle",
      color: "#3b82f6",
      label: "Loading",
    });
  });

  it("parses emoji scenes and timeline placement", () => {
    const [scene] = parseMarkdown(`!scene
!emoji 🚀 size:2xl animate:bounce at:1s duration:2.5s
`);

    expect(scene.type).toBe("emoji");
    expect(scene.emoji).toEqual({
      emoji: "🚀",
      size: "2xl",
      animate: "bounce",
    });
    expect(scene.timelineElements).toHaveLength(1);
    expect(scene.timelineElements?.[0]).toMatchObject({
      type: "emoji",
      content: "🚀",
      at: 1,
      duration: 2.5,
    });
  });

  it("parses image scene options", () => {
    const [scene] = parseMarkdown(`!scene
!image src:/hero.png fit:contain position:top alt:"Hero image"
`);

    expect(scene.type).toBe("image");
    expect(scene.image).toEqual({
      src: "/hero.png",
      fit: "contain",
      position: "top",
      alt: "Hero image",
    });
  });

  it("parses inline camera effects", () => {
    const [scene] = parseMarkdown(`!scene
!camera zoom:1.8 duration:2s
`);

    expect(scene.camera).toEqual({
      effect: "zoom",
      value: 1.8,
      duration: 2,
      keyframes: undefined,
    });
  });

  it("parses camera keyframes", () => {
    const [scene] = parseMarkdown(`!scene
!camera
- at:0s zoom:1
- at:2s zoom:1.4 pan:left shake:true shakeIntensity:high
`);

    expect(scene.camera?.keyframes).toEqual([
      {
        at: 0,
        zoom: 1,
        pan: undefined,
        shake: undefined,
        shakeIntensity: undefined,
      },
      {
        at: 2,
        zoom: 1.4,
        pan: "left",
        shake: true,
        shakeIntensity: "high",
      },
    ]);
  });

  it("parses particle options inline and on following property lines", () => {
    const [scene] = parseMarkdown(`!scene
!particles type:snow
intensity: high
`);

    expect(scene.particles).toEqual({
      type: "snow",
      intensity: "high",
    });
  });

  it("parses callout text, arrow, and target", () => {
    const [scene] = parseMarkdown(`!scene
!callout "Look here" arrow:right target:line:5
`);

    expect(scene.callout).toMatchObject({
      text: "Look here",
      arrow: "right",
      target: "line:5",
    });
  });

  it("parses chapters and positions them at scene start times", () => {
    const result = parseMarkdownFull(`!scene
!chapter "Intro"
!duration 2
!text
First

---

!scene
!chapter "Details"
!duration 3
!text
Second
`);

    expect(result.scenes.map((scene) => scene.chapter)).toEqual(["Intro", "Details"]);
    expect(result.chapters).toMatchObject([
      { title: "Intro", time: 0 },
      { title: "Details", time: 2 },
    ]);
  });
});

describe("layout parsing", () => {
  it("keeps the documented empty layout defaults without consuming scene metadata", () => {
    const [scene] = parseMarkdown(`!scene
!layout split:horizontal

!duration 4
!background #123456
`);

    expect(scene.type).toBe("split");
    expect(scene.duration).toBe(4);
    expect(scene.background).toBe("#123456");
    expect(scene.split).toMatchObject({
      direction: "horizontal",
      ratio: 0.5,
      left: { type: "text", background: "#1e1e2e" },
      right: { type: "text", background: "#1e1e2e" },
    });
  });

  it("supports explicitly labeled left and right child content", () => {
    const [scene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!text
Left copy
right:
!text
Right copy
`);

    expect(scene.split?.left).toMatchObject({
      type: "text",
      text: { content: "Left copy" },
    });
    expect(scene.split?.right).toMatchObject({
      type: "text",
      text: { content: "Right copy" },
    });
  });

  it("parses code child content without treating directives inside the fence as layout boundaries", () => {
    const [scene] = parseMarkdown([
      "!scene",
      "!layout split:horizontal",
      "left:",
      "!code",
      "```text",
      "!scene",
      "---",
      "```",
      "right:",
      "!text",
      "Right copy",
    ].join("\n"));

    expect(scene.type).toBe("split");
    expect(scene.split?.left).toMatchObject({
      type: "code",
      code: { language: "text", content: "!scene\n---" },
    });
    expect(scene.split?.right).toMatchObject({
      type: "text",
      text: { content: "Right copy" },
    });
  });

});
