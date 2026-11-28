import { describe, expect, it } from "vitest";
import { buildMusicAudioFilter } from "@markdown-video/core";
import { buildWebCodecsMusicRemuxArgs } from "../export-media";

const base = {
  videoPath: "webcodecs-3.mp4",
  musicPath: "music-3",
  totalDuration: 33,
  outputPath: "output-3.mp4",
};

describe("buildWebCodecsMusicRemuxArgs", () => {
  it("loops music with -stream_loop and fades both ends with the shared filter", () => {
    const music = { volume: 0.32, fade: 1, loop: true };
    expect(buildWebCodecsMusicRemuxArgs({ ...base, music })).toEqual([
      "-v",
      "error",
      "-i",
      "webcodecs-3.mp4",
      "-stream_loop",
      "-1",
      "-i",
      "music-3",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-af",
      "volume=0.32,atrim=duration=33,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=32:d=1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-c:v",
      "copy",
      "-t",
      "33.000",
      "-movflags",
      "+faststart",
      "output-3.mp4",
    ]);
  });

  it("plays music once with no fade filters when loop and fade are off", () => {
    const music = { volume: 1, fade: 0, loop: false };
    expect(
      buildWebCodecsMusicRemuxArgs({ ...base, music, totalDuration: 4.15 })
    ).toEqual([
      "-v",
      "error",
      "-i",
      "webcodecs-3.mp4",
      "-i",
      "music-3",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-af",
      "volume=1,atrim=duration=4.15,asetpts=PTS-STARTPTS",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-c:v",
      "copy",
      "-t",
      "4.150",
      "-movflags",
      "+faststart",
      "output-3.mp4",
    ]);
  });

  it("covers loop and fade independently", () => {
    const loopNoFade = buildWebCodecsMusicRemuxArgs({
      ...base,
      music: { volume: 0.5, fade: 0, loop: true },
    });
    expect(loopNoFade.slice(4, 8)).toEqual(["-stream_loop", "-1", "-i", "music-3"]);
    expect(loopNoFade[loopNoFade.indexOf("-af") + 1]).not.toContain("afade");

    const fadeNoLoop = buildWebCodecsMusicRemuxArgs({
      ...base,
      music: { volume: 0.5, fade: 2.5, loop: false },
    });
    expect(fadeNoLoop).not.toContain("-stream_loop");
    expect(fadeNoLoop.slice(4, 6)).toEqual(["-i", "music-3"]);
    expect(fadeNoLoop[fadeNoLoop.indexOf("-af") + 1]).toBe(
      "volume=0.5,atrim=duration=33,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2.5,afade=t=out:st=30.5:d=2.5"
    );
  });

  it("copies video and reuses buildMusicAudioFilter exactly", () => {
    for (const music of [
      { volume: 0.32, fade: 1, loop: true },
      { volume: 0.8, fade: 30, loop: false }, // fade clamps to half the duration
      { volume: 0, fade: 0, loop: true },
    ]) {
      const args = buildWebCodecsMusicRemuxArgs({ ...base, music });
      const codecVideo = args.indexOf("-c:v");
      expect(codecVideo).toBeGreaterThan(-1);
      expect(args[codecVideo + 1]).toBe("copy");
      expect(args).not.toContain("libx264");
      expect(args[args.indexOf("-af") + 1]).toBe(buildMusicAudioFilter(music, base.totalDuration));
      expect(args.at(-1)).toBe("output-3.mp4");
      expect(args.filter((arg) => arg === "-i")).toHaveLength(2);
    }
  });
});
