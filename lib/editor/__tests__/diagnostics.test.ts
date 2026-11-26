import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN } from "@/lib/default-markdown";
import { applyFix, diagnosticsByLine, getDiagnostics } from "../diagnostics";
import { EXAMPLE_TEMPLATES } from "../snippets";
import { TEMPLATES } from "@/lib/templates";

describe("getDiagnostics", () => {
  it("returns nothing for an empty document", () => {
    expect(getDiagnostics("")).toEqual([]);
    expect(getDiagnostics("  \n\n")).toEqual([]);
  });

  it("points scene problems at the line that caused them", () => {
    const md = `!scene
!transition spin
!text
Hello
animation: wobble`;
    const lines = getDiagnostics(md).map((d) => [d.line, d.severity, d.message]);
    expect(lines).toEqual([
      [2, "error", 'Scene 1: Invalid transition "spin"'],
      [
        5,
        "warning",
        "Scene 1: looks like property `animation` but `wobble` is not valid; treating as text",
      ],
    ]);
  });

  it("locates problems in later scenes", () => {
    const md = `!scene
!text
One

---

!scene
!chart type:radar
A: 1`;
    expect(getDiagnostics(md)).toMatchObject([
      { line: 8, severity: "error", message: 'Scene 2: Invalid chart type "radar"' },
    ]);
  });

  it("flags unknown directives with a suggestion and a fix", () => {
    const md = `!scene
!transtion fade
!text
Hi`;
    const [d] = getDiagnostics(md);
    expect(d).toMatchObject({
      line: 2,
      severity: "error",
      message: 'Unknown directive "!transtion". Did you mean "!transition"?',
      fix: { find: "!transtion", replace: "!transition" },
    });
    expect(applyFix(md, d)).toBe(md.replace("!transtion", "!transition"));
  });

  it("flags unknown directives without a close match and offers no fix", () => {
    const [d] = getDiagnostics("!scene\n!wobble\n!text\nHi");
    expect(d.message).toBe('Unknown directive "!wobble"');
    expect(d.fix).toBeUndefined();
  });

  it("accepts directive aliases", () => {
    expect(getDiagnostics("!slide\n!heading\nHi\n!bg #000\n!dur 2s")).toEqual([]);
  });

  it("ignores lines starting with ! inside code blocks", () => {
    const md = "!scene\n!code\n```bash\n!ls\n```";
    expect(getDiagnostics(md)).toEqual([]);
  });

  it("reports an unclosed code block at its opening line", () => {
    const md = "!scene\n!code\n```js\nconst x = 1;";
    expect(getDiagnostics(md)).toContainEqual(
      expect.objectContaining({ line: 3, message: "Unclosed code block" })
    );
  });

  it("lists line-less problems last", () => {
    const md = "!scene\n!duration 700\n!text\nHi";
    const result = getDiagnostics(md);
    expect(result.at(-1)?.line).toBeUndefined();
    expect(result[0].line).toBe(2);
  });
});

describe("no false alarms on the app's own content", () => {
  it.each([
    ["default document", DEFAULT_MARKDOWN],
    ...Object.entries(EXAMPLE_TEMPLATES).map(([k, v]) => [`snippet: ${k}`, v]),
    ...TEMPLATES.map((t) => [`template: ${t.name}`, t.markdown]),
  ])("%s has no errors", (_name, md) => {
    const errors = getDiagnostics(md).filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });
});

describe("diagnosticsByLine", () => {
  it("groups problems by line and skips line-less ones", () => {
    const map = diagnosticsByLine([
      { line: 2, severity: "error", message: "a" },
      { line: 2, severity: "warning", message: "b" },
      { severity: "warning", message: "c" },
    ]);
    expect([...map.keys()]).toEqual([2]);
    expect(map.get(2)).toHaveLength(2);
  });
});
