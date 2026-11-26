import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PreviewSize } from "./preview-fit";

// useLayoutEffect is not meaningful during server rendering. Choosing the
// effect implementation at module scope keeps hydration markup identical while
// letting the first client measurement happen before the browser paints.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const PREVIEW_SIZE_EPSILON_PX = 0.01;

function measuredSizeEquals(a: PreviewSize | null, b: PreviewSize) {
  return (
    a !== null &&
    Math.abs(a.width - b.width) < PREVIEW_SIZE_EPSILON_PX &&
    Math.abs(a.height - b.height) < PREVIEW_SIZE_EPSILON_PX
  );
}

/**
 * Measure the CSS-sized display box that reserves space for the preview.
 *
 * CSS can size that box with container-query units, but it cannot portably
 * divide one length by another to derive the logical-frame scale. The resize
 * observer therefore owns the cqw/cqh-to-number conversion. A zero-sized box
 * (for example in jsdom or while hidden) is treated as unmeasured rather than
 * as a valid zero scale.
 */
export function useMeasuredPreviewSize(enabled: boolean) {
  const sizingElementRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<PreviewSize | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      setSize(null);
      return;
    }

    const element = sizingElementRef.current;
    if (!element) return;

    const publishSize = (width: number, height: number) => {
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        setSize(null);
        return;
      }

      const nextSize = { width, height };
      setSize((previous) =>
        measuredSizeEquals(previous, nextSize) ? previous : nextSize
      );
    };

    const measureElement = () => {
      const rect = element.getBoundingClientRect();
      publishSize(rect.width, rect.height);
    };

    measureElement();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureElement);
      return () => window.removeEventListener("resize", measureElement);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === element);
      if (entry) {
        publishSize(entry.contentRect.width, entry.contentRect.height);
      } else {
        measureElement();
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled]);

  return { sizingElementRef, size };
}
