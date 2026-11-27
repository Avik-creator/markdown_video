import { PNG } from "pngjs"
import { describe, expect, it } from "vitest"

import {
  comparePngBuffers,
  createSideBySideComparisonPng,
} from "./diff-image.js"

function solidPng(width: number, height: number, rgba: [number, number, number, number]) {
  const png = new PNG({ width, height })
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    png.data[offset] = rgba[0]
    png.data[offset + 1] = rgba[1]
    png.data[offset + 2] = rgba[2]
    png.data[offset + 3] = rgba[3]
  }
  return png
}

function writePng(png: PNG) {
  return PNG.sync.write(png)
}

describe("comparePngBuffers", () => {
  it("reports exact equality as zero percent", () => {
    const image = writePng(solidPng(4, 4, [20, 40, 60, 255]))
    const result = comparePngBuffers({ oldPng: image, newPng: image })

    expect(result).toMatchObject({
      width: 4,
      height: 4,
      totalPixels: 16,
      mismatchedPixels: 0,
      changePercent: 0,
    })
  })

  it("counts changed pixels as a percentage of total pixels", () => {
    const oldImage = solidPng(4, 4, [20, 40, 60, 255])
    const newImage = solidPng(4, 4, [20, 40, 60, 255])
    newImage.data[0] = 250
    newImage.data[1] = 10
    newImage.data[2] = 10

    const result = comparePngBuffers({
      oldPng: writePng(oldImage),
      newPng: writePng(newImage),
      threshold: 0.01,
    })

    expect(result.mismatchedPixels).toBe(1)
    expect(result.changePercent).toBeCloseTo(6.25)
  })
})

describe("createSideBySideComparisonPng", () => {
  it("composes old, new, and diff panels with separator columns", () => {
    const oldImage = writePng(solidPng(3, 2, [255, 0, 0, 255]))
    const newImage = writePng(solidPng(3, 2, [0, 255, 0, 255]))
    const comparison = comparePngBuffers({
      oldPng: oldImage,
      newPng: newImage,
    })
    const composite = createSideBySideComparisonPng({
      oldPng: oldImage,
      newPng: newImage,
      diffPng: comparison.diffPng,
    })
    const decoded = PNG.sync.read(composite)

    expect(decoded.width).toBe(13)
    expect(decoded.height).toBe(2)
    expect(Array.from(decoded.data.subarray(0, 4))).toEqual([255, 0, 0, 255])
    const newPanelOffset = (0 * decoded.width + 5) * 4
    expect(Array.from(decoded.data.subarray(newPanelOffset, newPanelOffset + 4))).toEqual([0, 255, 0, 255])
    const separatorOffset = (0 * decoded.width + 3) * 4
    expect(Array.from(decoded.data.subarray(separatorOffset, separatorOffset + 4))).toEqual([128, 128, 128, 255])
  })
})
