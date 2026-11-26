import { describe, expect, it } from "vitest";
import type { Scene } from "@markdown-video/core";
import {
  materializeSplitPanel,
  normalizeSplitRatio,
  splitGridStyle,
} from "../split-layout";

describe("normalizeSplitRatio", () => {
  it("uses 0.5 when the ratio is absent or non-numeric", () => {
    expect(normalizeSplitRatio(undefined)).toBe(0.5);
    expect(normalizeSplitRatio(null)).toBe(0.5);
    expect(normalizeSplitRatio("50%")).toBe(0.5);
  });

  it("uses 0.5 for non-finite numbers so styles never contain NaN or Infinity", () => {
    expect(normalizeSplitRatio(Number.NaN)).toBe(0.5);
    expect(normalizeSplitRatio(Infinity)).toBe(0.5);
    expect(normalizeSplitRatio(-Infinity)).toBe(0.5);
  });

  it("clamps finite numbers into the valid 0..1 range", () => {
    expect(normalizeSplitRatio(-0.2)).toBe(0);
    expect(normalizeSplitRatio(0)).toBe(0);
    expect(normalizeSplitRatio(0.25)).toBe(0.25);
    expect(normalizeSplitRatio(1)).toBe(1);
    expect(normalizeSplitRatio(1.4)).toBe(1);
  });
});

describe("splitGridStyle", () => {
  it("creates horizontal column tracks from the ratio", () => {
    expect(splitGridStyle("horizontal", 0.25)).toEqual({
      gridTemplateColumns: "minmax(0, 0.25fr) 1px minmax(0, 0.75fr)",
    });
  });

  it("creates vertical row tracks from the ratio", () => {
    expect(splitGridStyle("vertical", 0.75)).toEqual({
      gridTemplateRows: "minmax(0, 0.75fr) 1px minmax(0, 0.25fr)",
    });
  });

  it("normalizes invalid ratios inside the generated style", () => {
    expect(splitGridStyle("horizontal", Number.NaN)).toEqual({
      gridTemplateColumns: "minmax(0, 0.5fr) 1px minmax(0, 0.5fr)",
    });
  });
});

describe("materializeSplitPanel", () => {
  it("adds deterministic identity and inherits the parent duration without inheriting transitions", () => {
    const parent: Scene = {
      id: "parent-scene",
      type: "split",
      duration: 4,
      transition: "slide",
      transitionDuration: 1.25,
    };
    type SplitPanel = NonNullable<Scene["split"]>["left"];
    const panel = {
      type: "progress",
      progress: { value: 80 },
      // Simulate malformed/legacy panel data that retained scene-level fields.
      id: "stale-id",
      duration: 99,
      transition: "wipe",
      transitionDuration: 9,
    } as SplitPanel;

    const materialized = materializeSplitPanel(panel, parent, "left");

    expect(materialized).toMatchObject({
      id: "parent-scene-split-left",
      type: "progress",
      duration: 4,
      progress: { value: 80 },
    });
    expect(materialized.transition).toBeUndefined();
    expect(materialized.transitionDuration).toBeUndefined();
  });
});
