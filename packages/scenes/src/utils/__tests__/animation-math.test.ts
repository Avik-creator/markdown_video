import { describe, expect, it } from "vitest";
import {
  springProgress,
  countdownDigitState,
  computeTerminalCommandStates,
  staggeredLineProgress,
  pulseOpacityAtTime,
} from "../animation-math.js";

describe("springProgress", () => {
  const bounce = { stiffness: 300, damping: 20 }; // zeta ~0.58, underdamped
  const stiff = { stiffness: 200, damping: 15 }; // zeta ~0.53, underdamped

  it("starts at 0", () => {
    expect(springProgress(0, bounce)).toBe(0);
  });

  it("returns 0 for negative time", () => {
    expect(springProgress(-1, bounce)).toBe(0);
  });

  it("settles at 1 for large times", () => {
    expect(springProgress(10, bounce)).toBeCloseTo(1, 5);
    expect(springProgress(10, stiff)).toBeCloseTo(1, 5);
  });

  it("rises immediately after t=0", () => {
    expect(springProgress(0.05, bounce)).toBeGreaterThan(0);
    expect(springProgress(0.1, bounce)).toBeGreaterThan(
      springProgress(0.05, bounce)
    );
  });

  it("overshoots past 1 for underdamped springs (the bounce effect)", () => {
    let max = 0;
    for (let t = 0; t <= 2; t += 0.005) {
      max = Math.max(max, springProgress(t, bounce));
    }
    expect(max).toBeGreaterThan(1);
  });

  it("never overshoots for overdamped springs", () => {
    const overdamped = { stiffness: 100, damping: 30 }; // zeta 1.5
    for (let t = 0; t <= 5; t += 0.01) {
      expect(springProgress(t, overdamped)).toBeLessThanOrEqual(1.0000001);
    }
    expect(springProgress(5, overdamped)).toBeCloseTo(1, 3);
  });

  it("never overshoots for critically damped springs", () => {
    const stiffness = 100;
    const critical = { stiffness, damping: 2 * Math.sqrt(stiffness) };
    for (let t = 0; t <= 5; t += 0.01) {
      expect(springProgress(t, critical)).toBeLessThanOrEqual(1.0000001);
    }
  });

  it("is monotonic for overdamped springs", () => {
    const overdamped = { stiffness: 100, damping: 30 };
    let prev = 0;
    for (let t = 0.01; t <= 3; t += 0.01) {
      const value = springProgress(t, overdamped);
      expect(value).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = value;
    }
  });

  it("respects mass: heavier springs move slower", () => {
    const light = springProgress(0.1, { stiffness: 300, damping: 20, mass: 1 });
    const heavy = springProgress(0.1, { stiffness: 300, damping: 20, mass: 4 });
    expect(light).toBeGreaterThan(heavy);
  });

  it("produces finite values for a range of parameters", () => {
    for (const stiffness of [50, 100, 200, 300, 500]) {
      for (const damping of [5, 15, 20, 40, 100]) {
        for (let t = 0; t <= 2; t += 0.1) {
          expect(
            Number.isFinite(springProgress(t, { stiffness, damping }))
          ).toBe(true);
        }
      }
    }
  });
});

describe("countdownDigitState", () => {
  it("starts at the initial count", () => {
    const state = countdownDigitState(0, 5);
    expect(state.remainingTime).toBe(5);
    expect(state.timeSinceAppear).toBe(0);
  });

  it("tracks time within the first second", () => {
    const state = countdownDigitState(0.5, 5);
    expect(state.remainingTime).toBe(5);
    expect(state.timeSinceAppear).toBeCloseTo(0.5);
  });

  it("resets the pop clock exactly when the digit changes", () => {
    const state = countdownDigitState(1, 5);
    expect(state.remainingTime).toBe(4);
    expect(state.timeSinceAppear).toBeCloseTo(0);
  });

  it("tracks time since the current digit appeared", () => {
    const state = countdownDigitState(2.3, 5);
    expect(state.remainingTime).toBe(3);
    expect(state.timeSinceAppear).toBeCloseTo(0.3);
  });

  it("reaches zero at t = from", () => {
    const state = countdownDigitState(5, 5);
    expect(state.remainingTime).toBe(0);
    expect(state.timeSinceAppear).toBeCloseTo(0);
  });

  it("does not restart the pop once the count reaches 0", () => {
    // The 0 digit appeared at t = 5; it must not re-pop every second.
    const state = countdownDigitState(7.5, 5);
    expect(state.remainingTime).toBe(0);
    expect(state.timeSinceAppear).toBeCloseTo(2.5);
  });

  it("is deterministic: same inputs give same outputs", () => {
    expect(countdownDigitState(3.7, 10)).toEqual(countdownDigitState(3.7, 10));
  });
});

describe("computeTerminalCommandStates", () => {
  const commands = [
    { command: "npm install", output: "added 1 package" },
    { command: "npm test" },
  ];
  const speed = 30;

  // cmd0 window length: 11 + 15 + 20 = 46 chars -> 46/30s
  // output appears mid-window at 0.5 progress: 23/30 = 0.7667s
  const windowChars =
    "npm install".length + "added 1 package".length + 20;

  it("starts with the first command empty and later commands hidden", () => {
    const states = computeTerminalCommandStates(commands, 0, speed, true);
    expect(states[0].started).toBe(true);
    expect(states[0].commandChars).toBe(0);
    expect(states[0].outputVisible).toBe(false);
    expect(states[1].started).toBe(false);
  });

  it("types the command characters over the first half of its window", () => {
    // charsSoFar = 10 -> progress 10/47 ~ 0.213 -> chars = floor(11 * 0.426) = 4
    const t = 10 / speed;
    const states = computeTerminalCommandStates(commands, t, speed, true);
    expect(states[0].commandChars).toBe(4);
    expect(states[0].typing).toBe(true);
  });

  it("fully types the command by the midpoint of its window", () => {
    const t = windowChars / 2 / speed; // exactly halfway through cmd0's window
    const states = computeTerminalCommandStates(commands, t, speed, true);
    expect(states[0].commandChars).toBe("npm install".length);
  });

  it("shows the output only after the midpoint, fading in deterministically", () => {
    const appearTime = windowChars / 2 / speed;

    const before = computeTerminalCommandStates(
      commands,
      appearTime - 0.001,
      speed,
      true
    );
    expect(before[0].outputVisible).toBe(false);

    const atAppear = computeTerminalCommandStates(
      commands,
      appearTime + 0.2,
      speed,
      true
    );
    expect(atAppear[0].outputVisible).toBe(true);
    // 0.2s delay before the fade starts, so still fully transparent
    expect(atAppear[0].outputOpacity).toBeCloseTo(0);

    const midFade = computeTerminalCommandStates(
      commands,
      appearTime + 0.2 + 0.15,
      speed,
      true
    );
    expect(midFade[0].outputOpacity).toBeCloseTo(0.5);

    const faded = computeTerminalCommandStates(
      commands,
      appearTime + 0.2 + 0.3,
      speed,
      true
    );
    expect(faded[0].outputOpacity).toBeCloseTo(1);
  });

  it("starts the second command only after the first window ends", () => {
    const endOfFirst = windowChars / speed;
    const before = computeTerminalCommandStates(
      commands,
      endOfFirst - 0.01,
      speed,
      true
    );
    expect(before[1].started).toBe(false);

    const after = computeTerminalCommandStates(
      commands,
      endOfFirst + 5 / speed,
      speed,
      true
    );
    expect(after[1].started).toBe(true);
    expect(after[1].commandChars).toBeGreaterThan(0);
  });

  it("completes all commands at large times", () => {
    const states = computeTerminalCommandStates(commands, 100, speed, true);
    expect(states[0].commandChars).toBe("npm install".length);
    expect(states[0].outputVisible).toBe(true);
    expect(states[0].outputOpacity).toBe(1);
    expect(states[0].typing).toBe(false);
    expect(states[1].commandChars).toBe("npm test".length);
    expect(states[1].typing).toBe(false);
  });

  it("handles commands without output", () => {
    const states = computeTerminalCommandStates(commands, 100, speed, true);
    expect(states[1].outputVisible).toBe(false);
  });

  it("shows everything immediately when typing is disabled, fading from scene start", () => {
    const states = computeTerminalCommandStates(commands, 0, speed, false);
    expect(states[0].commandChars).toBe("npm install".length);
    expect(states[1].commandChars).toBe("npm test".length);
    expect(states[0].outputVisible).toBe(true);
    // Fade starts at scene time 0 with the same 0.2s delay
    expect(states[0].outputOpacity).toBe(0);

    const later = computeTerminalCommandStates(commands, 0.5, speed, false);
    expect(later[0].outputOpacity).toBe(1);
  });

  it("is deterministic across repeated evaluation", () => {
    expect(computeTerminalCommandStates(commands, 1.23, speed, true)).toEqual(
      computeTerminalCommandStates(commands, 1.23, speed, true)
    );
  });
});

describe("staggeredLineProgress", () => {
  it("is 0 before the first line starts", () => {
    expect(staggeredLineProgress(0, 0, 0.2)).toBe(0);
    expect(staggeredLineProgress(0.09, 0, 0.2)).toBe(0);
  });

  it("starts the first line after the children delay (0.1s)", () => {
    expect(staggeredLineProgress(0.1, 0, 0.2)).toBe(0);
    expect(staggeredLineProgress(0.35, 0, 0.2)).toBeCloseTo(0.5);
    expect(staggeredLineProgress(0.6, 0, 0.2)).toBe(1);
  });

  it("staggers later lines by the stagger amount", () => {
    expect(staggeredLineProgress(0.3, 1, 0.2)).toBe(0);
    expect(staggeredLineProgress(0.55, 1, 0.2)).toBeCloseTo(0.5);
    expect(staggeredLineProgress(0.8, 1, 0.2)).toBe(1);
  });

  it("line 1 is behind line 0 mid-animation", () => {
    const t = 0.4;
    const first = staggeredLineProgress(t, 0, 0.2);
    const second = staggeredLineProgress(t, 1, 0.2);
    expect(first).toBeGreaterThan(second);
  });

  it("clamps progress between 0 and 1", () => {
    expect(staggeredLineProgress(-1, 0, 0.2)).toBe(0);
    expect(staggeredLineProgress(100, 0, 0.2)).toBe(1);
  });
});

describe("pulseOpacityAtTime", () => {
  it("matches the pulse endpoints and midpoint", () => {
    expect(pulseOpacityAtTime(0)).toBe(1);
    expect(pulseOpacityAtTime(1)).toBeCloseTo(0.5);
    expect(pulseOpacityAtTime(2)).toBeCloseTo(1);
  });

  it("is deterministic and cyclic", () => {
    expect(pulseOpacityAtTime(0.5)).toBeCloseTo(0.75);
    expect(pulseOpacityAtTime(2.5)).toBeCloseTo(pulseOpacityAtTime(0.5));
    expect(pulseOpacityAtTime(3.75)).toBeCloseTo(pulseOpacityAtTime(3.75));
  });

  it("never emits NaN for invalid input", () => {
    expect(pulseOpacityAtTime(Number.NaN)).toBe(1);
    expect(pulseOpacityAtTime(Infinity)).toBe(1);
    expect(pulseOpacityAtTime(0.5, 0)).toBe(1);
  });
});
