import { describe, expect, it } from "vitest"

import {
  ffmpegInstallInstructions,
  missingFfmpegCapabilities,
  parseFfmpegVersion,
} from "./ffmpeg-check.js"

const ENCODERS = `Encoders:
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
`

const FILTERS = `Filters:
 T. afade             A->A       Fade in/out input audio.
 .. atrim             A->A       Pick one continuous section from the input.
 .. asetpts           A->A       Set PTS for the output audio frame.
 T. volume            A->A       Change input volume.
 .. fps               V->V       Force constant framerate.
 .. palettegen        V->V       Find the optimal palette for a given stream.
 .. paletteuse        VV->V      Use a palette to downsample an input video stream.
 .. scale             V->V       Scale the input video size.
 .. setsar            V->V       Set the pixel sample aspect ratio.
 .. split             V->N       Pass on the input to N video outputs.
`

describe("ffmpeg capability inspection", () => {
  it("parses the ffmpeg version line", () => {
    expect(parseFfmpegVersion("ffmpeg version 7.1 Copyright\nconfiguration: x")).toBe("7.1")
    expect(parseFfmpegVersion("not ffmpeg")).toBeUndefined()
  })

  it("accepts the complete capability set used by mp4, gif, and music rendering", () => {
    expect(missingFfmpegCapabilities({ encoders: ENCODERS, filters: FILTERS })).toEqual([])
  })

  it("reports missing encoders and filters by user-facing label", () => {
    expect(missingFfmpegCapabilities({ encoders: "", filters: FILTERS })).toEqual([
      "libx264 H.264 encoder",
      "AAC audio encoder",
    ])
    expect(
      missingFfmpegCapabilities({
        encoders: ENCODERS,
        filters: FILTERS.replace(" T. afade             A->A       Fade in/out input audio.\n", ""),
      }),
    ).toEqual(["afade audio filter"])
  })

  it("gives operating-system-specific installation guidance and binary overrides", () => {
    const instructions = ffmpegInstallInstructions()
    expect(instructions).toContain("brew install ffmpeg")
    expect(instructions).toContain("apt-get install -y ffmpeg")
    expect(instructions).toContain("winget install Gyan.FFmpeg")
    expect(instructions).toContain("--ffmpeg /path/to/ffmpeg")
    expect(instructions).toContain("FFMPEG_BIN")
  })
})
