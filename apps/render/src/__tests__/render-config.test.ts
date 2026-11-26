import { describe, expect, it } from "vitest";
import {
  parseRenderPageConfig,
  renderPageConfigQuery,
} from "../render-config";

describe("parseRenderPageConfig", () => {
  it("uses the editor defaults with no query string", () => {
    expect(parseRenderPageConfig("")).toEqual({
      aspectRatio: "16:9",
      activeLocale: null,
      burnCaptions: false,
    });
  });

  it("accepts the CLI aspect ratio and locale parameters", () => {
    expect(parseRenderPageConfig("?aspect=9:16&locale=es")).toEqual({
      aspectRatio: "9:16",
      activeLocale: "es",
      burnCaptions: false,
    });
  });

  it("falls back to 16:9 for an unknown aspect ratio", () => {
    expect(parseRenderPageConfig("?aspect=21:9").aspectRatio).toBe("16:9");
  });

  it("parses the caption burn-in flag only for explicit truthy values", () => {
    expect(parseRenderPageConfig("?burnCaptions=1").burnCaptions).toBe(true);
    expect(parseRenderPageConfig("?burnCaptions=true").burnCaptions).toBe(true);
    expect(parseRenderPageConfig("?burn-captions=1").burnCaptions).toBe(true);
    expect(parseRenderPageConfig("?burnCaptions=0").burnCaptions).toBe(false);
    expect(parseRenderPageConfig("?burnCaptions=yes").burnCaptions).toBe(false);
    expect(parseRenderPageConfig("?burnCaptions=").burnCaptions).toBe(false);
  });

  it("round-trips config through the query serializer", () => {
    const query = renderPageConfigQuery({
      aspectRatio: "4:3",
      activeLocale: "fr",
      burnCaptions: true,
    });

    expect(parseRenderPageConfig(query)).toEqual({
      aspectRatio: "4:3",
      activeLocale: "fr",
      burnCaptions: true,
    });
  });

  it("omits the burn-in parameter when disabled", () => {
    const query = renderPageConfigQuery({
      aspectRatio: "16:9",
      activeLocale: null,
      burnCaptions: false,
    });

    expect(query).not.toContain("burnCaptions");
    expect(parseRenderPageConfig(query).burnCaptions).toBe(false);
  });
});
