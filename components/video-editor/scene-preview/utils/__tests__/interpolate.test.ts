import { describe, expect, it } from "vitest";
import {
  interpolateValue,
  interpolateVariantState,
} from "../interpolate";
import { transitionVariants, animationVariants } from "../constants";

describe("interpolateValue", () => {
  describe("numbers", () => {
    it("interpolates between two numbers", () => {
      expect(interpolateValue(0, 1, 0.5)).toBe(0.5);
      expect(interpolateValue(0.8, 1, 0.5)).toBeCloseTo(0.9);
      expect(interpolateValue(0.3, 1, 0.25)).toBeCloseTo(0.475);
    });

    it("returns exact endpoints", () => {
      expect(interpolateValue(0, 1, 0)).toBe(0);
      expect(interpolateValue(0, 1, 1)).toBe(1);
      expect(interpolateValue(-50, 0, 0)).toBe(-50);
    });

    it("handles negative numbers", () => {
      expect(interpolateValue(-10, 10, 0.5)).toBe(0);
    });
  });

  describe("simple percentage strings", () => {
    it("interpolates percent strings", () => {
      expect(interpolateValue("100%", "0%", 0.5)).toBe("50%");
      expect(interpolateValue("-100%", "0%", 0.25)).toBe("-75%");
      expect(interpolateValue("0%", "100%", 0.5)).toBe("50%");
    });

    it("returns exact endpoints for percent strings", () => {
      expect(interpolateValue("100%", "0%", 0)).toBe("100%");
      expect(interpolateValue("100%", "0%", 1)).toBe("0%");
    });
  });

  describe("numeric zero treated as percentage zero", () => {
    it("interpolates a percent string against numeric 0 (slide transition)", () => {
      // slide transition: x "100%" -> x 0
      expect(interpolateValue("100%", 0, 0.5)).toBe("50%");
      expect(interpolateValue("100%", 0, 0.25)).toBe("75%");
    });

    it("interpolates numeric 0 against a percent string", () => {
      expect(interpolateValue(0, "100%", 0.5)).toBe("50%");
    });

    it("returns the authored endpoints exactly in mixed cases", () => {
      expect(interpolateValue("100%", 0, 0)).toBe("100%");
      expect(interpolateValue("100%", 0, 1)).toBe(0);
      expect(interpolateValue(0, "100%", 0)).toBe(0);
      expect(interpolateValue(0, "100%", 1)).toBe("100%");
    });

    it("never produces NaN for the slide transition at any progress", () => {
      for (let i = 0; i <= 20; i++) {
        const progress = i / 20;
        const value = interpolateValue("100%", 0, progress);
        expect(String(value)).not.toContain("NaN");
      }
    });
  });

  describe("clip-path inset strings (wipe transition)", () => {
    const wipeInitial = "inset(0 100% 0 0)";
    const wipeAnimate = "inset(0 0% 0 0)";

    it("interpolates each numeric component inside the string", () => {
      expect(interpolateValue(wipeInitial, wipeAnimate, 0.5)).toBe(
        "inset(0 50% 0 0)"
      );
      expect(interpolateValue(wipeInitial, wipeAnimate, 0.25)).toBe(
        "inset(0 75% 0 0)"
      );
    });

    it("returns exact endpoints", () => {
      expect(interpolateValue(wipeInitial, wipeAnimate, 0)).toBe(wipeInitial);
      expect(interpolateValue(wipeInitial, wipeAnimate, 1)).toBe(wipeAnimate);
    });

    it("never produces NaN% at any progress", () => {
      for (let i = 0; i <= 100; i++) {
        const progress = i / 100;
        const value = interpolateValue(wipeInitial, wipeAnimate, progress);
        expect(String(value)).not.toContain("NaN");
        expect(String(value)).toMatch(/^inset\(/);
      }
    });

    it("interpolates multiple numeric components simultaneously", () => {
      expect(
        interpolateValue(
          "inset(10% 20% 30% 40%)",
          "inset(0% 0% 0% 0%)",
          0.5
        )
      ).toBe("inset(5% 10% 15% 20%)");
    });

    it("treats unitless zero as compatible with percentage zero", () => {
      const result = interpolateValue(
        "inset(0 0 0 100%)",
        "inset(0% 0% 0% 0%)",
        0.5
      );
      expect(String(result)).not.toContain("NaN");
      // The only nonzero pair is the last token: 100% -> 0%
      expect(result).toBe("inset(0% 0% 0% 50%)");
    });

    it("interpolates unitless numbers inside strings", () => {
      expect(interpolateValue("inset(0 100 0 0)", "inset(0 0 0 0)", 0.5)).toBe(
        "inset(0 50 0 0)"
      );
    });
  });

  describe("incompatible values fall back to snap-at-end", () => {
    it("snaps when units differ on nonzero values", () => {
      expect(interpolateValue("100px", "50%", 0.5)).toBe("100px");
      expect(interpolateValue("100px", "50%", 0.999)).toBe("100px");
      expect(interpolateValue("100px", "50%", 1)).toBe("50%");
    });

    it("snaps when a nonzero number is mixed with a percent string", () => {
      expect(interpolateValue(50, "100%", 0.5)).toBe(50);
      expect(interpolateValue(50, "100%", 1)).toBe("100%");
    });

    it("snaps when string structures differ", () => {
      expect(interpolateValue("inset(0 100% 0 0)", "inset(0 0 0)", 0.5)).toBe(
        "inset(0 100% 0 0)"
      );
      expect(interpolateValue("inset(0 100% 0 0)", "inset(0 0 0)", 1)).toBe(
        "inset(0 0 0)"
      );
    });

    it("snaps non-numeric strings", () => {
      expect(interpolateValue("solid", "none", 0.5)).toBe("solid");
      expect(interpolateValue("solid", "none", 1)).toBe("none");
    });

    it("snaps when the initial value is undefined", () => {
      expect(interpolateValue(undefined, 1, 0.5)).toBeUndefined();
      expect(interpolateValue(undefined, 1, 1)).toBe(1);
    });

    it("does not try to interpolate hex colors", () => {
      expect(interpolateValue("#ff0000", "#00ff00", 0.5)).toBe("#ff0000");
      expect(interpolateValue("#ff0000", "#00ff00", 1)).toBe("#00ff00");
    });
  });

  describe("endpoint clamping", () => {
    it("returns exact initial at progress <= 0 and exact animate at progress >= 1", () => {
      expect(interpolateValue(0.8, 1, -0.5)).toBe(0.8);
      expect(interpolateValue(0.8, 1, 1.5)).toBe(1);
      expect(interpolateValue("inset(0 100% 0 0)", "inset(0 0% 0 0)", 2)).toBe(
        "inset(0 0% 0 0)"
      );
    });
  });
});

describe("interpolateVariantState", () => {
  it("interpolates the fade transition variants", () => {
    const state = interpolateVariantState(
      { opacity: 0 },
      { opacity: 1 },
      0.5
    );
    expect(state).toEqual({ opacity: 0.5 });
  });

  it("interpolates the slide transition variants without snapping", () => {
    const initial = { x: "100%", opacity: 0 };
    const animate = { x: 0, opacity: 1 };

    expect(interpolateVariantState(initial, animate, 0)).toEqual({
      x: "100%",
      opacity: 0,
    });
    expect(interpolateVariantState(initial, animate, 0.5)).toEqual({
      x: "50%",
      opacity: 0.5,
    });
    expect(interpolateVariantState(initial, animate, 1)).toEqual({
      x: 0,
      opacity: 1,
    });
  });

  it("interpolates the wipe transition variants without NaN", () => {
    const initial = { clipPath: "inset(0 100% 0 0)" };
    const animate = { clipPath: "inset(0 0% 0 0)" };

    for (let i = 0; i <= 20; i++) {
      const progress = i / 20;
      const state = interpolateVariantState(initial, animate, progress);
      expect(state.clipPath).not.toContain("NaN");
    }
    expect(interpolateVariantState(initial, animate, 0.5).clipPath).toBe(
      "inset(0 50% 0 0)"
    );
  });

  it("interpolates the zoom and magic transitions (numeric keys)", () => {
    expect(
      interpolateVariantState(
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1 },
        0.5
      )
    ).toEqual({ scale: 0.5, opacity: 0.5 });

    expect(
      interpolateVariantState(
        { scale: 0.8, opacity: 0, rotate: -10 },
        { scale: 1, opacity: 1, rotate: 0 },
        0.5
      )
    ).toEqual({ scale: 0.9, opacity: 0.5, rotate: -5 });
  });

  it("handles empty variants (none transition)", () => {
    expect(interpolateVariantState({}, {}, 0.5)).toEqual({});
  });

  it("handles keys missing from the initial state", () => {
    const state = interpolateVariantState({}, { opacity: 1 }, 0.5);
    expect(state.opacity).toBeUndefined();
    expect(interpolateVariantState({}, { opacity: 1 }, 1).opacity).toBe(1);
  });
});

describe("interpolateVariantState with the real variant constants", () => {
  for (const [name, variants] of Object.entries(transitionVariants)) {
    it(`transition "${name}" interpolates without NaN and hits exact endpoints`, () => {
      const initial = variants.initial as Record<string, unknown>;
      const animate = variants.animate as Record<string, unknown>;

      for (let i = 0; i <= 50; i++) {
        const progress = i / 50;
        const state = interpolateVariantState(initial, animate, progress);
        for (const key of Object.keys(state)) {
          expect(String(state[key])).not.toContain("NaN");
        }
      }

      // Endpoints must be exactly the authored values.
      expect(interpolateVariantState(initial, animate, 0)).toEqual(initial);
      expect(interpolateVariantState(initial, animate, 1)).toEqual(animate);

      // Mid-transition must actually interpolate (not snap) for the keys
      // these transitions are built from.
      if (Object.keys(animate).length > 0) {
        const mid = interpolateVariantState(initial, animate, 0.5);
        expect(mid).not.toEqual(initial);
      }
    });
  }

  // The wipe transition specifically broke because parseFloat on an inset()
  // string is NaN.
  it("wipe clipPath is a valid inset() at every frame", () => {
    const { initial, animate } = transitionVariants.wipe;
    for (let i = 0; i <= 30; i++) {
      const state = interpolateVariantState(
        initial as Record<string, unknown>,
        animate as Record<string, unknown>,
        i / 30
      );
      expect(state.clipPath).toMatch(
        /^inset\(-?[\d.]+%? -?[\d.]+%? -?[\d.]+%? -?[\d.]+%?\)$/
      );
    }
  });

  // The slide transition broke because "100%" vs 0 fell through to the
  // snap-at-end branch.
  it("slide x moves continuously instead of snapping at the end", () => {
    const { initial, animate } = transitionVariants.slide;
    const states = [0.1, 0.3, 0.5, 0.7, 0.9].map(
      (progress) =>
        interpolateVariantState(
          initial as Record<string, unknown>,
          animate as Record<string, unknown>,
          progress
        ).x
    );
    // Every intermediate frame is a distinct in-flight percentage — not the
    // initial value held until completion.
    expect(states).toEqual(["90%", "70%", "50%", "30%", "10%"]);
  });

  for (const [name, variants] of Object.entries(animationVariants)) {
    it(`animation "${name}" interpolates without NaN`, () => {
      const initial = variants.initial as Record<string, unknown>;
      const animate = variants.animate as Record<string, unknown>;

      for (let i = 0; i <= 20; i++) {
        const state = interpolateVariantState(initial, animate, i / 20);
        for (const key of Object.keys(state)) {
          expect(String(state[key])).not.toContain("NaN");
        }
      }
    });
  }
});
