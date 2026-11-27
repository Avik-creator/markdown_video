import { describe, expect, it } from "vitest";
import { parseMarkdown, parseMarkdownFull } from "../index.js";

describe("parser correctness regressions", () => {
  it("preserves colon-bearing text lines and URLs that are not valid text properties", () => {
    const [scene] = parseMarkdown(`!scene
!text
Note: this matters
https://example.com/docs
animation: slideUp
size: xl
`);

    expect(scene.text).toMatchObject({
      content: "Note: this matters\nhttps://example.com/docs",
      animation: "slideUp",
      size: "xl",
    });
  });

  it("preserves colon-bearing mockup lines and URLs that are not valid mockup properties", () => {
    const [scene] = parseMarkdown(`!scene
!mockup device:browser
content: text
Note: this matters
https://example.com/screenshot.png
color: #ffffff
`);

    expect(scene.mockup?.content.text).toMatchObject({
      content: "Note: this matters\nhttps://example.com/screenshot.png",
      color: "#ffffff",
    });
  });

  it("matches complete scene directive words and parses hyphenated aliases exactly", () => {
    const result = parseMarkdownFull(`!scene
!section-title "Introduction"
!text
Hello
`);

    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].chapter).toBe("Introduction");
    expect(result.scenes[0].text?.content).toBe("Hello");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Introduction"]);
  });

  it("does not treat longer words with a scene directive prefix as scene directives", () => {
    expect(parseMarkdown(`!scenery
!text
Not actually a scene
`)).toEqual([]);
  });

  it("parses directive aliases without prefix matching", () => {
    const result = parseMarkdownFull(`!variable brand #123456
!slide
!time 2.5
!bg $brand
!title
Alias content
`);

    expect(result.variables).toEqual({ brand: "#123456" });
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0]).toMatchObject({
      duration: 2.5,
      background: "#123456",
    });
    expect(result.scenes[0].text?.content).toBe("Alias content");
  });

  it("parses hyphenated layout aliases as complete directive words", () => {
    const [scene] = parseMarkdown(`!scene
!two-column split:vertical
`);

    expect(scene.type).toBe("split");
    expect(scene.split?.direction).toBe("vertical");
  });

  it("parses variables and directives in documents with CRLF line endings", () => {
    const result = parseMarkdownFull(
      "!var brand #3b82f6\r\n\r\n!scene\r\n!background $brand\r\n!duration 2\r\n!text\r\nHello\r\n\r\n---\r\n\r\n!scene\r\n!text\r\nSecond\r\n"
    );

    expect(result.variables).toEqual({ brand: "#3b82f6" });
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]).toMatchObject({
      background: "#3b82f6",
      duration: 2,
    });
    expect(result.scenes[0].text?.content).toBe("Hello");
    expect(result.scenes[1].text?.content).toBe("Second");
  });

  it("parses floating point and negative chart values", () => {
    const [scene] = parseMarkdown(`!scene
!chart type:line
Revenue: 3.5 #22c55e
Losses: -4
`);

    expect(scene.chart?.data).toEqual([
      { label: "Revenue", value: 3.5, color: "#22c55e" },
      { label: "Losses", value: -4, color: undefined },
    ]);
  });

  it("retains an invalid negative scene duration so validation can report it", () => {
    const [scene] = parseMarkdown(`!scene
!duration -2
!text
Invalid duration
`);

    expect(scene.duration).toBe(-2);
  });

  it("does not produce NaN highlight lines for invalid highlight input", () => {
    const [scene] = parseMarkdown([
      "!scene",
      "!code",
      "highlight: x",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n"));

    expect(scene.code?.highlight?.lines).toEqual([]);
  });

  it("accepts indented code fences consistently", () => {
    const [scene] = parseMarkdown([
      "!scene",
      "!code",
      "  ```ts",
      "const answer = 42;",
      "  ```",
    ].join("\n"));

    expect(scene.code).toMatchObject({
      language: "ts",
      content: "const answer = 42;",
    });
  });

  it("substitutes variables inside fenced code content", () => {
    const [scene] = parseMarkdown([
      "!var pkg react",
      "!scene",
      "!code",
      "```ts",
      'import $pkg from "$pkg";',
      "```",
    ].join("\n"));

    expect(scene.code?.content).toBe('import react from "react";');
  });

  it("substitutes variables inside terminal commands and output", () => {
    const [scene] = parseMarkdown(`!var pkg react
!scene
!terminal
$ npm install $pkg
added $pkg
`);

    expect(scene.terminal?.commands).toEqual([
      { prompt: "$", command: "npm install react", output: "added react" },
    ]);
  });

  it("substitutes variables inside chart data", () => {
    const [scene] = parseMarkdown(`!var sales 42.5
!scene
!chart type:bar
Sales: $sales
`);

    expect(scene.chart?.data).toEqual([
      { label: "Sales", value: 42.5, color: undefined },
    ]);
  });

  it("treats > lines after a $ command as terminal output rather than new commands", () => {
    const [scene] = parseMarkdown(`!scene
!terminal
$ npm run dev
> Ready on localhost:3000
> Press Ctrl+C to stop
$ echo done
`);

    expect(scene.terminal?.commands).toHaveLength(2);
    expect(scene.terminal?.commands[0]).toEqual({
      prompt: "$",
      command: "npm run dev",
      output: "> Ready on localhost:3000\n> Press Ctrl+C to stop",
    });
    expect(scene.terminal?.commands[1]).toEqual({
      prompt: "$",
      command: "echo done",
      output: undefined,
    });
  });

  it("still supports > as the command prompt when a terminal block uses it as the prompt", () => {
    const [scene] = parseMarkdown(`!scene
!terminal
> node server.js
listening on port 3000
`);

    expect(scene.terminal?.commands).toEqual([
      { prompt: ">", command: "node server.js", output: "listening on port 3000" },
    ]);
  });

  it("parses ordered child content in a layout instead of dropping it or overwriting the scene", () => {
    const [scene] = parseMarkdown(`!scene
!layout split:vertical
!text
Left panel copy
!image src:/right.png fit:contain
!duration 4
`);

    expect(scene.type).toBe("split");
    expect(scene.duration).toBe(4);
    expect(scene.split).toMatchObject({
      direction: "vertical",
      left: {
        type: "text",
        text: { content: "Left panel copy" },
      },
      right: {
        type: "image",
        image: { src: "/right.png", fit: "contain" },
      },
    });
  });

  it("rejects variable expansion amplification beyond the parser safety budget", () => {
    const value = "x".repeat(20_000);
    const references = Array.from({ length: 220 }, () => "$payload").join("\n");
    const markdown = `!var payload ${value}\n!scene\n!text\n${references}\n`;

    expect(() => parseMarkdownFull(markdown)).toThrowError(
      /Variable expansion exceeded the parser safety budget/
    );
  });

  it("still parses legitimate heavy variable use below the expansion budget", () => {
    const value = "heavyx".repeat(1_000); // 6,000 characters per use
    const references = Array.from({ length: 160 }, () => "$copy").join("\n");
    const [scene] = parseMarkdown(`!var copy ${value}\n!scene\n!text\n${references}\n`);

    expect(scene.text?.content).toHaveLength(160 * value.length + 159);
    expect(scene.text?.content.startsWith(value)).toBe(true);
  });
});
