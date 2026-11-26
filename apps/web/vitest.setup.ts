/**
 * Shared Vitest setup. Tests run in node by default; editor tests opt into
 * jsdom with a `// @vitest-environment jsdom` pragma. The mocks below are
 * only installed when a DOM exists, and they provide just enough layout and
 * observer API for CodeMirror 6 to mount and measure inside jsdom (which
 * performs no layout and implements none of these).
 */

// Node's experimental localStorage global exists but is broken (undefined
// value) without a --localstorage-file flag, in both the node and jsdom
// environments. The shared memory-storage module self-installs a working
// stub when localStorage is undefined-valued; importing it here guarantees
// the SAME instance backs the zustand persist middleware in every test file,
// including the store tests that inspect it directly.
import "./lib/store/__tests__/memory-storage";

if (typeof window !== "undefined") {
  // CodeMirror observes its scroll container and gutter sizes.
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  }

  // jsdom does not implement scrollIntoView; CM calls it for cursor motion.
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  // jsdom does not scroll programmatically but the properties exist as
  // read-only getters on some elements; make them writable where missing.
  if (typeof HTMLElement !== "undefined") {
    for (const prop of ["scrollTop", "scrollLeft"]) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
      if (!descriptor || !descriptor.set) {
        let value = 0;
        Object.defineProperty(HTMLElement.prototype, prop, {
          configurable: true,
          get() {
            return value;
          },
          set(next) {
            value = next;
          },
        });
      }
    }
  }

  // jsdom performs no layout, so text measurement returns empty rects. CM
  // reads the first rectangle in a few places, so hand back a zeroed rect
  // instead of an empty list to keep those reads safe.
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  }) as DOMRect;

  if (typeof Range !== "undefined") {
    const rangeProto = Range.prototype as unknown as {
      getClientRects?: () => ArrayLike<DOMRect>;
      getBoundingClientRect?: () => DOMRect;
    };
    const originalRects = rangeProto.getClientRects?.bind(Range.prototype);
    Range.prototype.getClientRects = function getClientRects(): DOMRectList {
      const rects = originalRects ? originalRects() : { length: 0 };
      if (rects.length > 0) return rects as DOMRectList;
      const zero = zeroRect();
      return {
        0: zero,
        length: 1,
        item: () => zero,
        [Symbol.iterator]: function* () {
          yield zero;
        },
      } as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return zeroRect();
    };
  }

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
