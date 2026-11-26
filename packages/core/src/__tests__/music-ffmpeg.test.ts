import { describe, expect, it } from "vitest";
import {
  buildMusicAudioFilter,
  buildMusicInputArgs,
  buildMusicOutputArgs,
  captionSidecarPathsForOutput,
  getEffectiveMusicFade,
} from "../music-ffmpeg.js";

describe("music ffmpeg helpers", () => {
  it("builds deterministic looping input args without shell interpolation", () => {
    expect(buildMusicInputArgs({ loop: true }, "music file.mp3")).toEqual([
      "-stream_loop",
      "-1",
      "-i",
      "music file.mp3",
    ]);
    expect(buildMusicInputArgs({ loop: false }, "music file.mp3")).toEqual([
      "-i",
      "music file.mp3",
    ]);
  });

  it("builds the exact truncation/fade/volume filter chain", () => {
    expect(
      buildMusicAudioFilter({ volume: 0.4, fade: 1 }, 5)
    ).toBe(
      "volume=0.4,atrim=duration=5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=4:d=1"
    );
  });

  it("clamps fade to half the video duration so fades never overlap", () => {
    expect(getEffectiveMusicFade(10, 6)).toBe(3);
    expect(buildMusicAudioFilter({ volume: 1, fade: 10 }, 6)).toContain(
      "afade=t=out:st=3:d=3"
    );
  });

  it("omits fade filters for zero-duration fades", () => {
    expect(buildMusicAudioFilter({ volume: 0.25, fade: 0 }, 2.5)).toBe(
      "volume=0.25,atrim=duration=2.5,asetpts=PTS-STARTPTS"
    );
  });

  it("builds explicit stream mapping and AAC output args", () => {
    expect(buildMusicOutputArgs("volume=1")).toEqual([
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-af",
      "volume=1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
    ]);
  });

  it("derives sidecar paths by replacing only the final media extension", () => {
    expect(captionSidecarPathsForOutput("videos/my.video.mp4")).toEqual({
      srtPath: "videos/my.video.srt",
      vttPath: "videos/my.video.vtt",
    });
    expect(captionSidecarPathsForOutput("video")).toEqual({
      srtPath: "video.srt",
      vttPath: "video.vtt",
    });
    expect(captionSidecarPathsForOutput("dir.name/video.mp4")).toEqual({
      srtPath: "dir.name/video.srt",
      vttPath: "dir.name/video.vtt",
    });
  });
});
