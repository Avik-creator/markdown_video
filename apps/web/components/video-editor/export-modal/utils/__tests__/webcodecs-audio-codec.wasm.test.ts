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
  it("registers the wasm encoder once, even across concurrent calls, and returns 'wasm'", async () => {
    // No global AudioEncoder: the platform probe fails, so the wasm encoder
    // must be registered before the re-probe can succeed.
    const { selectWebCodecsAudioCodec: select } = await import("../webcodecs-audio");
    const [a, b] = await Promise.all([select(), select()]);
    expect(a).toBe("wasm");
    expect(b).toBe("wasm");
    expect(registerAacEncoderMock).toHaveBeenCalledTimes(1);
  });
});
