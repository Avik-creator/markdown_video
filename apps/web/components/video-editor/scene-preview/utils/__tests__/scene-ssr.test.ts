/**
 * SSR smoke tests: verify the deterministic scenes embed scene-time-derived
 * values directly in their markup (SVG attributes and inline styles), which
 * is what makes preview and export capture identical frames.
 *
 * These use renderToStaticMarkup, so useEffect-driven controls never run;
 * assertions target only the values that are pure functions of sceneTime.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Scene } from "@markdown-video/core";
import { parseMarkdown } from "@markdown-video/core";
import { CodeScene } from "../../scenes/CodeScene";
import { TextScene } from "../../scenes/TextScene";
import { CountdownScene } from "../../scenes/CountdownScene";
import { ProgressScene } from "../../scenes/ProgressScene";
import { SplitScene } from "../../scenes/SplitScene";
import { TerminalScene } from "../../scenes/TerminalScene";

function scene(overrides: Partial<Scene>): Scene {
  return {
    id: "test-scene",
    type: "text",
    duration: 5,
    ...overrides,
  } as Scene;
}

describe("CountdownScene deterministic markup", () => {
  const countdownScene = (style: "digital" | "circle" | "minimal") =>
    scene({
      type: "countdown",
      countdown: { from: 5, style },
    });

  it("renders the correct digit for the scene time", () => {
    const html = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("minimal"),
        sceneTime: 1.5,
      })
    );
    // remaining = 5 - floor(1.5) = 4
    expect(html).toContain(">4</span>");
  });

  it("embeds the spring-driven pop transform directly in the markup", () => {
    const atZero = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("minimal"),
        sceneTime: 1,
      })
    );
    // Digit just appeared: pop at its starting scale (2 for minimal).
    expect(atZero).toContain("scale(2)");

    const settled = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("minimal"),
        sceneTime: 1.9,
      })
    );
    // 0.9s into the pop the spring has essentially settled near scale 1
    // (and is no longer anywhere near the start scale of 2).
    const match = settled.match(/scale\(([\d.]+)\)/);
    expect(match).not.toBeNull();
    const scale = parseFloat(match![1]);
    expect(scale).toBeGreaterThan(0.9);
    expect(scale).toBeLessThan(1.1);
  });

  it("overshoots below scale 1 mid-pop, like the original spring", () => {
    // The digit pop starts above 1 and springs down to 1; the underdamped
    // spring overshoots, dipping the scale slightly below 1 along the way.
    let sawBelowOne = false;
    for (let t = 1.05; t < 1.6; t += 0.02) {
      const html = renderToStaticMarkup(
        createElement(CountdownScene, {
          scene: countdownScene("minimal"),
          sceneTime: t,
        })
      );
      const match = html.match(/scale\(([\d.]+)\)/);
      if (match && parseFloat(match[1]) < 0.99) {
        sawBelowOne = true;
      }
    }
    expect(sawBelowOne).toBe(true);
  });

  it("is deterministic: the same sceneTime renders identical markup", () => {
    const a = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("circle"),
        sceneTime: 2.34,
      })
    );
    const b = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("circle"),
        sceneTime: 2.34,
      })
    );
    expect(a).toBe(b);
  });

  it("embeds the countdown ring stroke-dashoffset as a plain attribute", () => {
    const html = renderToStaticMarkup(
      createElement(CountdownScene, {
        scene: countdownScene("circle"),
        sceneTime: 2.5,
      })
    );
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const expected = circumference * (2.5 / 5);
    expect(html).toContain(`stroke-dashoffset="${expected}"`);
  });
});

describe("ProgressScene deterministic markup", () => {
  const progressScene = (style: "bar" | "circle" | "semicircle") =>
    scene({
      type: "progress",
      duration: 4,
      progress: { value: 80, style },
    });

  it("embeds the bar width directly as a style at the right value", () => {
    // currentValue at t=1 of a 4s scene: min(80, (1/4) * 80 * 2) = 40 -> 40%
    const html = renderToStaticMarkup(
      createElement(ProgressScene, { scene: progressScene("bar"), sceneTime: 1 })
    );
    expect(html).toContain("width:40%");
  });

  it("is deterministic: the same sceneTime renders identical markup", () => {
    const a = renderToStaticMarkup(
      createElement(ProgressScene, {
        scene: progressScene("circle"),
        sceneTime: 1.37,
      })
    );
    const b = renderToStaticMarkup(
      createElement(ProgressScene, {
        scene: progressScene("circle"),
        sceneTime: 1.37,
      })
    );
    expect(a).toBe(b);
  });

  it("caps the value at the target", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressScene, { scene: progressScene("bar"), sceneTime: 4 })
    );
    expect(html).toContain("width:80%");
  });

  it("embeds the circle stroke-dashoffset directly", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressScene, {
        scene: progressScene("circle"),
        sceneTime: 1,
      })
    );
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    // percentage at t=1: 40 -> offset = circumference * 0.6
    const expected = circumference * (1 - 0.4);
    expect(html).toContain(`stroke-dashoffset="${expected}"`);
  });
});

describe("TerminalScene deterministic markup", () => {
  const terminalScene = scene({
    type: "terminal",
    terminal: {
      typingSpeed: 30,
      commands: [
        { command: "npm install", output: "added 1 package" },
        { command: "npm test" },
      ],
    },
  });

  it("types the command text as a function of sceneTime", () => {
    // At t = 10/30: charsSoFar 10, window 46 -> progress ~0.217
    // chars = floor(11 * 0.435) = 4 -> "npm "
    const html = renderToStaticMarkup(
      createElement(TerminalScene, { scene: terminalScene, sceneTime: 10 / 30 })
    );
    expect(html).toContain("npm ");
    expect(html).not.toContain("npm install");
  });

  it("fades output in deterministically (inline opacity)", () => {
    const windowChars = "npm install".length + "added 1 package".length + 20;
    const appearTime = windowChars / 2 / 30;
    const html = renderToStaticMarkup(
      createElement(TerminalScene, {
        scene: terminalScene,
        sceneTime: appearTime + 0.2 + 0.15,
      })
    );
    // Halfway through the output fade: the output div carries its opacity
    // inline at ~0.5 (floating point arithmetic aside).
    const match = html.match(/whitespace-pre-wrap pl-4" style="opacity:([\d.]+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeCloseTo(0.5, 5);
  });

  it("shows everything at large times", () => {
    const html = renderToStaticMarkup(
      createElement(TerminalScene, { scene: terminalScene, sceneTime: 100 })
    );
    expect(html).toContain("npm install");
    expect(html).toContain("added 1 package");
    expect(html).toContain("npm test");
  });

  it("is deterministic: the same sceneTime renders identical markup", () => {
    const a = renderToStaticMarkup(
      createElement(TerminalScene, { scene: terminalScene, sceneTime: 0.77 })
    );
    const b = renderToStaticMarkup(
      createElement(TerminalScene, { scene: terminalScene, sceneTime: 0.77 })
    );
    expect(a).toBe(b);
  });
});

describe("typing cursor deterministic markup", () => {
  it("uses scene-time-derived opacity instead of the wall-clock pulse class", () => {
    const typingScene = scene({
      type: "code",
      code: {
        language: "text",
        content: "abcdefghijklmnopqrstuvwxyz",
        typing: true,
        typingSpeed: 10,
      },
    });

    const html = renderToStaticMarkup(
      createElement(CodeScene, { scene: typingScene, sceneTime: 1 })
    );

    expect(html).toContain("opacity:0.5");
    expect(html).not.toContain("animate-pulse");
  });
});

describe("scene font integration", () => {
  it("uses the JetBrains next/font variable for jetbrains code", () => {
    const codeScene = scene({
      type: "code",
      code: {
        language: "text",
        content: "const answer = 42",
        fontFamily: "jetbrains",
      },
    });

    const html = renderToStaticMarkup(
      createElement(CodeScene, { scene: codeScene, sceneTime: 1 })
    );

    expect(html).toContain("--font-jetbrains-family");
    expect(html).not.toContain("JetBrains Mono");
  });

  it("uses the Playfair next/font variable for serif text", () => {
    const textScene = scene({
      type: "text",
      text: { content: "Serif copy", fontFamily: "serif" },
    });

    const html = renderToStaticMarkup(
      createElement(TextScene, { scene: textScene, sceneTime: 1 })
    );

    expect(html).toContain("--font-playfair");
    expect(html).not.toContain("Playfair Display");
  });
});

describe("SplitScene deterministic markup", () => {
  it("renders real parsed horizontal text and image panels instead of placeholders", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!text
Left copy
right:
!image src:/right.png fit:contain alt:"Right image"
!duration 4
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 1.25 })
    );

    expect(html).toContain('data-split-direction="horizontal"');
    expect(html).toContain("Left copy");
    expect(html).toContain('src="/right.png"');
    expect(html).toContain('alt="Right image"');
    expect(html).not.toContain("Left Panel");
    expect(html).not.toContain("Right Panel");
    expect(html).not.toContain("NaN");
  });

  it("renders ordered vertical terminal and chart child scenes", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:vertical
!terminal
$ npm install
> install complete
!chart type:bar animate:true
Sales: 100
!duration 5
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 10 })
    );

    expect(html).toContain('data-split-direction="vertical"');
    expect(html).toContain("npm install");
    expect(html).toContain("install complete");
    expect(html).toContain("Sales");
    expect(html).not.toContain("Left Panel");
    expect(html).not.toContain("Right Panel");
    expect(html).not.toContain("NaN");
  });

  it("renders inline timeline text produced inside a layout panel", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!text "Overlay copy" at:0s duration:1s
right:
!text
Right copy
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 0.5 })
    );

    expect(html).toContain("Overlay copy");
    expect(html).toContain("Right copy");
    expect(html).not.toContain("NaN");
  });

  it("renders nested code and diff panels from parser output", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!code
\`\`\`javascript
const answer = 42;
\`\`\`
right:
!diff javascript
+ const answer = 42;
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 2 })
    );

    expect(html).toContain("const answer = 42;");
    expect(html).toContain("Changes · javascript");
    expect(html).not.toContain("Left Panel");
    expect(html).not.toContain("Right Panel");
    expect(html).not.toContain("NaN");
  });

  it("passes the parent scene duration into nested time-dependent scenes", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
!progress value:80 animate:true
!text
Notes
!duration 4
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 1 })
    );

    // Same calculation as a top-level 4s progress scene at t=1: 40%.
    expect(html).toContain("width:40%");
    expect(html).not.toContain("NaN");
  });

  it("renders nested mockup and QR parser output", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
left:
!mockup device:browser
image: /screen.png
right:
!qr url:https://example.com label:"Scan me"
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 2 })
    );

    expect(html).toContain('src="/screen.png"');
    expect(html).toContain("Scan me");
    expect(html).not.toContain("Left Panel");
    expect(html).not.toContain("Right Panel");
    expect(html).not.toContain("NaN");
  });

  it("does not emit NaN for zero-valued countdown or chart panel content", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
!countdown from:0 style:circle
!chart type:pie
Zero: 0
`);

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 0 })
    );

    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("uses panel backgrounds and sanitizes invalid ratios in generated styles", () => {
    const layoutScene = scene({
      type: "split",
      split: {
        direction: "horizontal",
        ratio: Number.NaN,
        left: {
          type: "text",
          background: "linear-gradient(135deg, #ff0000 0%, #0000ff 100%)",
          text: { content: "Gradient side" },
        },
        right: {
          type: "text",
          background: "#112233",
          text: { content: "Solid side" },
        },
      },
    });

    const html = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 0.5 })
    );

    expect(html).toContain("Gradient side");
    expect(html).toContain("Solid side");
    expect(html).toContain("linear-gradient");
    expect(html).toContain("#112233");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("is deterministic: the same sceneTime renders identical markup", () => {
    const [layoutScene] = parseMarkdown(`!scene
!layout split:horizontal
!text
Alpha
!text
Beta
`);

    const a = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 0.77 })
    );
    const b = renderToStaticMarkup(
      createElement(SplitScene, { scene: layoutScene, sceneTime: 0.77 })
    );
    expect(a).toBe(b);
  });
});
