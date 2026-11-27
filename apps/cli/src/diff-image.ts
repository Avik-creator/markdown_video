import pixelmatch from "pixelmatch"
import { PNG, type PNGWithMetadata } from "pngjs"

import { RenderError } from "./errors.js"

/**
 * Pixelmatch's threshold is an OKLab color distance, not a percentage. The
 * default 0.1 is intentionally strict because both inputs are lossless PNGs
 * captured by the same Chromium/version in one process invocation; there is
 * no codec noise to hide. Anti-aliased edge pixels are still ignored as
 * pixelmatch's mature AA detector intends.
 */
export const DIFF_PIXELMATCH_THRESHOLD = 0.1

export interface PngPixelComparison {
  width: number
  height: number
  totalPixels: number
  mismatchedPixels: number
  changePercent: number
  /** Diff-highlight visualization with the same dimensions as the inputs. */
  diffPng: Buffer
}

function readPng(buffer: Buffer, label: string): PNGWithMetadata {
  try {
    return PNG.sync.read(buffer)
  } catch (error) {
    throw new RenderError(
      `Could not decode ${label} PNG frame: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export function comparePngBuffers({
  oldPng,
  newPng,
  threshold = DIFF_PIXELMATCH_THRESHOLD,
}: {
  oldPng: Buffer
  newPng: Buffer
  threshold?: number | undefined
}): PngPixelComparison {
  const oldImage = readPng(oldPng, "old-version")
  const newImage = readPng(newPng, "new-version")
  if (oldImage.width !== newImage.width || oldImage.height !== newImage.height) {
    throw new RenderError(
      `Frame dimensions differ: old is ${oldImage.width}x${oldImage.height}, new is ${newImage.width}x${newImage.height}.`,
    )
  }

  const diffImage = new PNG({ width: oldImage.width, height: oldImage.height })
  const mismatchedPixels = pixelmatch(
    oldImage.data,
    newImage.data,
    diffImage.data,
    oldImage.width,
    oldImage.height,
    {
      threshold,
      includeAA: false,
      alpha: 0.18,
      diffColor: [255, 0, 92],
      diffColorAlt: [255, 153, 0],
    },
  )
  const totalPixels = oldImage.width * oldImage.height

  return {
    width: oldImage.width,
    height: oldImage.height,
    totalPixels,
    mismatchedPixels,
    changePercent: (mismatchedPixels / totalPixels) * 100,
    diffPng: PNG.sync.write(diffImage),
  }
}

/**
 * Create one inspection image containing old, new, and pixelmatch's diff
 * visualization side by side. Two neutral separator columns make panel
 * boundaries visible without adding text/rasterization dependencies.
 */
export function createSideBySideComparisonPng({
  oldPng,
  newPng,
  diffPng,
}: {
  oldPng: Buffer
  newPng: Buffer
  diffPng: Buffer
}) {
  const oldImage = readPng(oldPng, "old-version")
  const newImage = readPng(newPng, "new-version")
  const diffImage = readPng(diffPng, "diff-highlight")
  const width = oldImage.width
  const height = oldImage.height
  if (
    newImage.width !== width ||
    newImage.height !== height ||
    diffImage.width !== width ||
    diffImage.height !== height
  ) {
    throw new RenderError("Cannot compose comparison PNGs with different dimensions.")
  }

  const separatorWidth = 2
  const output = new PNG({
    width: width * 3 + separatorWidth * 2,
    height,
  })

  // PNG pixel data starts as transparent black. Make only the two separator
  // strips opaque neutral gray; all three image panels overwrite their own
  // pixels completely through bitblt below.
  for (let y = 0; y < height; y += 1) {
    for (const x of [width, width + 1, width * 2 + 2, width * 2 + 3]) {
      const offset = (y * output.width + x) * 4
      output.data[offset] = 128
      output.data[offset + 1] = 128
      output.data[offset + 2] = 128
      output.data[offset + 3] = 255
    }
  }

  PNG.bitblt(oldImage, output, 0, 0, width, height, 0, 0)
  PNG.bitblt(newImage, output, 0, 0, width, height, width + separatorWidth, 0)
  PNG.bitblt(
    diffImage,
    output,
    0,
    0,
    width,
    height,
    width * 2 + separatorWidth * 2,
    0,
  )

  return PNG.sync.write(output)
}
