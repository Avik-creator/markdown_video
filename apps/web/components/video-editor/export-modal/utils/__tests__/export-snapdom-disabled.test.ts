// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SNAPDOM_CAPTURE_DISABLED_KEY,
  disableSnapdomCapture,
  isSnapdomCaptureDisabled,
} from "../export-utils";

describe("snapdom capture disabled flag", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("is disabled only after a runtime failure is recorded", () => {
    expect(isSnapdomCaptureDisabled()).toBe(false);
    disableSnapdomCapture();
    expect(isSnapdomCaptureDisabled()).toBe(true);
    expect(sessionStorage.getItem(SNAPDOM_CAPTURE_DISABLED_KEY)).toBe("1");
  });

  it("treats storage read errors as not disabled", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("denied"); },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    expect(isSnapdomCaptureDisabled()).toBe(false);
  });

  it("swallows storage write errors", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("denied"); },
      removeItem: () => {},
      clear: () => {},
    });
    expect(() => disableSnapdomCapture()).not.toThrow();
  });
});
