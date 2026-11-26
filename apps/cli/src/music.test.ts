import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { prepareMusicInput } from "./music.js"

let tempDir: string | null = null

function temp() {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-music-unit-"))
  return tempDir
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe("prepareMusicInput", () => {
  it("resolves local music relative to the markdown directory without shell interpolation", async () => {
    const dir = temp()
    writeFileSync(path.join(dir, "tone file.wav"), Buffer.from("not really audio"))

    const prepared = await prepareMusicInput({
      music: { src: "tone file.wav", volume: 0.4, fade: 1, loop: true },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })

    expect(prepared).toEqual({
      inputPath: path.join(dir, "tone file.wav"),
      temporary: false,
    })
  })

  it("writes inline data audio to the temporary input file", async () => {
    const dir = temp()
    const prepared = await prepareMusicInput({
      music: {
        src: `data:audio/wav;base64,${Buffer.from("abc").toString("base64")}`,
        volume: 0.4,
        fade: 1,
        loop: true,
      },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: false,
    })

    expect(prepared.inputPath).toBe(path.join(dir, "music-input"))
    expect(prepared.temporary).toBe(true)
  })

  it("rejects local and remote music in isolated renderer mode", async () => {
    const dir = temp()
    await expect(prepareMusicInput({
      music: { src: "tone.wav", volume: 0.4, fade: 1, loop: true },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: false,
    })).rejects.toThrow("network/file isolated")

    await expect(prepareMusicInput({
      music: { src: "https://example.com/tone.mp3", volume: 0.4, fade: 1, loop: true },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: false,
    })).rejects.toThrow("network/file isolated")
  })

  it("rejects insecure, credentialed, blob, unsupported-scheme, and missing inputs", async () => {
    const dir = temp()
    const base = { volume: 0.4, fade: 1, loop: true }

    await expect(prepareMusicInput({
      music: { ...base, src: "http://example.com/tone.mp3" },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })).rejects.toThrow("HTTPS")

    await expect(prepareMusicInput({
      music: { ...base, src: "https://127.0.0.1/tone.mp3" },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })).rejects.toThrow("publicly routable")

    await expect(prepareMusicInput({
      music: { ...base, src: "blob:https://example.com/id" },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })).rejects.toThrow("browser session")

    await expect(prepareMusicInput({
      music: { ...base, src: "ftp://example.com/tone.mp3" },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })).rejects.toThrow("Unsupported music source scheme")

    await expect(prepareMusicInput({
      music: { ...base, src: "missing.wav" },
      markdownBaseDir: dir,
      tempDir: dir,
      allowExternalMusic: true,
    })).rejects.toThrow("Music file not found")
  })
})
