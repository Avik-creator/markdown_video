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
    });
  });

  it("accepts the CLI aspect ratio and locale parameters", () => {
    expect(parseRenderPageConfig("?aspect=9:16&locale=es")).toEqual({
      aspectRatio: "9:16",
      activeLocale: "es",
    });
  });

  it("falls back to 16:9 for an unknown aspect ratio", () => {
    expect(parseRenderPageConfig("?aspect=21:9").aspectRatio).toBe("16:9");
  });

  it("round-trips config through the query serializer", () => {
    const query = renderPageConfigQuery({ aspectRatio: "4:3", activeLocale: "fr" });

    expect(parseRenderPageConfig(query)).toEqual({
      aspectRatio: "4:3",
      activeLocale: "fr",
    });
  });
});
