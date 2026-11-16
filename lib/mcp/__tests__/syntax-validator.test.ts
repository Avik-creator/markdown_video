import { describe, expect, it } from "vitest";
import {
  getSyntaxSuggestions,
  quickSyntaxCheck,
  validateMarkdownSyntax,
} from "../syntax-validator";

const messages = (items: { message: string }[]) => items.map((i) => i.message);

describe("validateMarkdownSyntax", () => {
  it("accepts a valid text scene and code scene", () => {
    const result = validateMarkdownSyntax(`!scene
!text
Hello World
size: lg
animation: fadeIn

---

!scene
!duration 5
!code
\`\`\`javascript
console.log("Hello");
\`\`\`
`);
    expect(result.valid).toBe(true);
    expect(result.scenes).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.totalDuration).toBe(8);
  });

  it("rejects an unknown transition", () => {
    const result = validateMarkdownSyntax(`!scene
!transition invalid_transition
!text
This should have an error
`);
    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toEqual([
      'Scene 1: Invalid transition "invalid_transition"',
    ]);
  });

  it("rejects an unknown animation", () => {
    const result = validateMarkdownSyntax(`!scene
!text
Hello
animation: invalid_animation
`);
    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toEqual([
      'Scene 1: Invalid animation "invalid_animation"',
    ]);
  });

  it("requires an image source", () => {
    const result = validateMarkdownSyntax(`!scene
!image fit:cover
`);
    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toEqual(["Scene 1: Image source is required"]);
  });

  it("rejects an invalid QR code URL", () => {
    const result = validateMarkdownSyntax(`!scene
!qr url:not-a-valid-url
`);
    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toEqual([
      'Scene 1: Invalid QR code URL "not-a-valid-url"',
    ]);
  });

  it("warns about empty text content without failing", () => {
    const result = validateMarkdownSyntax(`!scene
!text

`);
    expect(result.valid).toBe(true);
    expect(messages(result.warnings)).toEqual(["Scene 1: Text content is empty"]);
  });

  it("accepts a scene using every major feature", () => {
    const result = validateMarkdownSyntax(`!var brandColor #3b82f6

!scene
!chapter "Introduction"
!duration 5
!background $brandColor
!transition fade 1s
!particles type:confetti intensity:high
!camera zoom:1.5 duration:3s
!text
Welcome to My Video
animation: fadeIn
size: 2xl
color: #ffffff

---

!scene
!transition slide
!code
typing: true
speed: 50
fontSize: md
fontFamily: jetbrains
highlight: 1,2,3
annotations:
- line: 1 text: "Import statement"
- line: 3 text: "Main function"
\`\`\`javascript
import React from 'react';

function App() {
  return <div>Hello</div>;
}
\`\`\`

---

!scene
!chart type:bar animate:true
Sales: 100
Marketing: 80
Development: 120

---

!scene
!mockup device:iphone bg:#000000
content: text
Hello from iPhone!
color: #ffffff

---

!scene
!emoji 🎉 size:2xl animate:bounce at:0s duration:2s
!countdown from:5 style:digital color:#ec4899
`);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.valid).toBe(true);
    expect(result.scenes).toHaveLength(5);
    expect(result.totalDuration).toBe(17);
  });
});

describe("quickSyntaxCheck", () => {
  it("counts scenes in a valid document", () => {
    const result = quickSyntaxCheck(`!scene
!text
Scene 1

---

!scene
!duration 10
!code
\`\`\`javascript
const x = 1;
\`\`\`

---

!scene
!text
Scene 3
`);
    expect(result.hasScenes).toBe(true);
    expect(result.sceneCount).toBe(3);
    expect(result.issues).toHaveLength(0);
  });

  it("reports an unclosed code block", () => {
    const result = quickSyntaxCheck(`!scene
!code
\`\`\`javascript
const x = 1;
`);
    expect(result.issues).toEqual(["Unclosed code block at line 3"]);
  });
});

describe("getSyntaxSuggestions", () => {
  it("suggests starting a scene in an empty document", () => {
    expect(getSyntaxSuggestions("")).toContain("!scene - Start a new scene");
  });

  it("suggests starting a scene after a separator", () => {
    expect(getSyntaxSuggestions("!scene\n!text\nHi\n\n---\n")).toContain(
      "!scene - Start a new scene"
    );
  });

  it("suggests content types after !scene, even with the cursor on a new line", () => {
    expect(getSyntaxSuggestions("!scene")).toContain("!text - Add text content");
    expect(getSyntaxSuggestions("!scene\n")).toContain("!text - Add text content");
  });
});
