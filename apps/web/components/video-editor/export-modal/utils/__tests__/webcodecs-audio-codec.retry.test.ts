// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
const registerAacEncoderMock = vi.hoisted(() => vi.fn());

// The real mediabunny canEncodeAudio runs: its platform check consults the
// stubbed global AudioEncoder, and its custom-encoder check is fed by the
// mocked wasm package registering a fake encoder through the real
// registerEncoder (which also clears mediabunny's capability memo).
vi.mock("@mediabunny/aac-encoder", async () => {
  const mediabunny = await import("mediabunny");
  class FakeAacEncoder extends mediabunny.CustomAudioEncoder {
    init() {}
    encode() {}
    flush() {}
    close() {}
    static supports(codec: string) {
      return codec === "aac";
    }
  }
  return {
    registerAacEncoder: () => {
      registerAacEncoderMock();
      mediabunny.registerEncoder(FakeAacEncoder);
    },
  };
});


describe("selectWebCodecsAudioCodec", () => {
  it("returns null when registration rejects, and retries on a later call", async () => {
    registerAacEncoderMock.mockImplementationOnce(() => {
      throw new Error("wasm failed to load");
    });
    const { selectWebCodecsAudioCodec: select } = await import("../webcodecs-audio");
    expect(await select()).toBeNull();
    expect(await select()).toBe("wasm");
    expect(registerAacEncoderMock).toHaveBeenCalledTimes(2);
  });
});
