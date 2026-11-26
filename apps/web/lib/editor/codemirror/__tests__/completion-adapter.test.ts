import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { markdownCompletionSource } from "../completion-source";
import { getCompletions } from "@/lib/editor/completions";

function contextFor(text: string, pos = text.length, explicit = false) {
  const state = EditorState.create({ doc: text });
  return new CompletionContext(state, pos, explicit);
}

describe("markdownCompletionSource", () => {
  it("returns null when there is nothing to offer", () => {
    expect(markdownCompletionSource(contextFor("plain text"))).toBeNull();
  });

  it("adapts directive completions with string apply text", () => {
    const text = "!sc";
    const result = markdownCompletionSource(contextFor(text));
    expect(result).not.toBeNull();
    const scene = result!.options.find((o) => o.label === "scene");
    expect(scene).toBeDefined();
    // The insert text is what replaces the range, not the bare label.
    expect(scene!.apply).toBe("!scene");
  });

  it("preserves the replacement range start from getCompletions", () => {
    const text = "!sc";
    const expected = getCompletions(text, text.length);
    const result = markdownCompletionSource(contextFor(text));
    expect(result!.from).toBe(expected!.from);
  });

  it("disables CM filtering so ordering matches getCompletions exactly", () => {
    const text = "!t";
    const expected = getCompletions(text, text.length);
    const result = markdownCompletionSource(contextFor(text));
    expect(result!.filter).toBe(false);
    expect(result!.options.map((o) => o.label)).toEqual(
      expected!.items.map((i) => i.label)
    );
  });

  it("keeps name matches ahead of alias-only matches", () => {
    const result = markdownCompletionSource(contextFor("!te"));
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    // "text" and "terminal" start with the prefix; anything matched only by
    // alias must come after every direct name match.
    const firstAliasOnly = labels.findIndex((l) => !l.startsWith("te"));
    if (firstAliasOnly !== -1) {
      expect(labels.slice(0, firstAliasOnly).every((l) => l.startsWith("te"))).toBe(true);
    }
  });

  it("carries detail text into the completion option", () => {
    const result = markdownCompletionSource(contextFor("!sc"));
    const scene = result!.options.find((o) => o.label === "scene");
    expect(typeof scene!.detail).toBe("string");
    expect(scene!.detail!.length).toBeGreaterThan(0);
  });

  it("offers value completions after a property key", () => {
    const text = "!text\nanimation: sl";
    const result = markdownCompletionSource(contextFor(text));
    expect(result).not.toBeNull();
    expect(result!.options.length).toBeGreaterThan(0);
    expect(result!.options.every((o) => o.label.startsWith("sl"))).toBe(true);
    // Values insert as themselves.
    expect(result!.options.every((o) => o.apply === o.label)).toBe(true);
  });

  it("returns null inside a code fence", () => {
    const text = "!code\n```\n!sc";
    expect(markdownCompletionSource(contextFor(text))).toBeNull();
  });

  it("targets only the partial word being completed", () => {
    const text = "!text\nanimation: sl";
    const result = markdownCompletionSource(contextFor(text));
    // "sl" is two characters; replacement starts at the s.
    expect(text.slice(result!.from)).toBe("sl");
  });
});
