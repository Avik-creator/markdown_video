/**
 * Shared Vitest setup for @markdown-video/scenes. Tests run in node by
 * default; rendering tests opt into jsdom with a `// @vitest-environment
 * jsdom` pragma. React 19 requires the act-environment flag before Testing
 * Library can use `act`, and jsdom does not implement requestAnimationFrame,
 * which framer-motion's effect-driven controls expect to exist.
 */

if (typeof window !== "undefined") {
  if (typeof globalThis.requestAnimationFrame === "undefined") {
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      writable: true,
      configurable: true,
      value: (callback: (time: number) => void) =>
        setTimeout(() => callback(Date.now()), 0) as unknown as number,
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      writable: true,
      configurable: true,
      value: (handle: number) => clearTimeout(handle),
    });
  }

  // React 19 requires this flag before `act` can be used by Testing Library.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}
