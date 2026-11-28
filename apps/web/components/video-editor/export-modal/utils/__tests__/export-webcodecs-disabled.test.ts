// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableWebCodecsExport,
  isWebCodecsExportDisabled,
  WEBCODECS_EXPORT_DISABLED_KEY,
} from "../export-utils";

const throwingStorage = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  clear: () => {},
};

describe("WebCodecs disable flag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("defaults to enabled and flips once disabled", () => {
    expect(isWebCodecsExportDisabled()).toBe(false);
    disableWebCodecsExport();
    expect(sessionStorage.getItem(WEBCODECS_EXPORT_DISABLED_KEY)).toBe("1");
    expect(isWebCodecsExportDisabled()).toBe(true);
  });

  it("reads as enabled when sessionStorage throws", () => {
    vi.stubGlobal("sessionStorage", throwingStorage);
    expect(isWebCodecsExportDisabled()).toBe(false);
  });

  it("does not throw when sessionStorage writes fail", () => {
    vi.stubGlobal("sessionStorage", throwingStorage);
    expect(() => disableWebCodecsExport()).not.toThrow();
    expect(isWebCodecsExportDisabled()).toBe(false);
  });
});
