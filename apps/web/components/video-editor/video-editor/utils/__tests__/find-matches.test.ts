import { describe, expect, it } from "vitest";
import {
  findExactMatchIndex,
  findMatches,
  getMatchIndexAfterReplacement,
  getNextMatchIndex,
  getPreviousMatchIndex,
  replaceMatch,
} from "../find-matches";

describe("findMatches", () => {
  it("finds every non-overlapping case-sensitive match", () => {
    expect(findMatches("one two one ONE", "one")).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
  });

  it("returns no matches for an empty query", () => {
    expect(findMatches("text", "")).toEqual([]);
  });

  it("advances past each match so empty-position loops are impossible", () => {
    expect(findMatches("aaa", "aa")).toEqual([{ start: 0, end: 2 }]);
  });
});

describe("match navigation", () => {
  it("moves to the next match and wraps at the end", () => {
    expect(getNextMatchIndex(0, 3)).toBe(1);
    expect(getNextMatchIndex(2, 3)).toBe(0);
  });

  it("moves to the previous match and wraps at the start", () => {
    expect(getPreviousMatchIndex(2, 3)).toBe(1);
    expect(getPreviousMatchIndex(0, 3)).toBe(2);
  });

  it("chooses a useful initial match when there is no current index", () => {
    expect(getNextMatchIndex(-1, 3)).toBe(0);
    expect(getPreviousMatchIndex(-1, 3)).toBe(2);
  });

  it("returns -1 when there are no matches", () => {
    expect(getNextMatchIndex(0, 0)).toBe(-1);
    expect(getPreviousMatchIndex(0, 0)).toBe(-1);
  });
});

describe("findExactMatchIndex", () => {
  it("finds the match exactly covered by a selection", () => {
    const matches = findMatches("one two one", "one");
    expect(findExactMatchIndex(matches, 8, 11)).toBe(1);
  });

  it("does not treat partial or wider selections as a selected match", () => {
    const matches = findMatches("one two one", "one");
    expect(findExactMatchIndex(matches, 8, 10)).toBe(-1);
    expect(findExactMatchIndex(matches, 7, 11)).toBe(-1);
  });
});

describe("getMatchIndexAfterReplacement", () => {
  it("selects the first match after the inserted replacement", () => {
    const matches = findMatches("x one x", "x");
    expect(getMatchIndexAfterReplacement(matches, 0, 1)).toBe(1);
  });

  it("skips a match contained in the replacement so replace cannot stall", () => {
    const matches = findMatches("x x", "x");
    expect(getMatchIndexAfterReplacement(matches, 0, 1)).toBe(1);
  });

  it("wraps when no later match remains", () => {
    expect(
      getMatchIndexAfterReplacement([{ start: 0, end: 1 }], 4, 1)
    ).toBe(0);
  });

  it("returns -1 when there are no matches", () => {
    expect(getMatchIndexAfterReplacement([], 0, 0)).toBe(-1);
  });
});

describe("replaceMatch", () => {
  it("replaces the supplied match rather than the first match", () => {
    const match = { start: 8, end: 11 };
    expect(replaceMatch("one two one", match, "1")).toBe("one two 1");
  });

  it("supports inserting a longer replacement", () => {
    const match = { start: 0, end: 3 };
    expect(replaceMatch("one two", match, "three")).toBe("three two");
  });
});
