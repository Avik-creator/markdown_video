import { describe, expect, it, vi } from "vitest";
import {
  assetReferenceSnippet,
  extractRelativeAssetReferences,
  markdownMediaValue,
  textWithInsertedReference,
  uniqueAssetReferences,
} from "../asset-references";
import {
  findMissingAssetReferences,
  missingAssetDiagnostics,
} from "../missing-assets";
import type { AssetMetadata } from "../asset-store";

function asset(filename: string): AssetMetadata {
  return {
    id: filename,
    filename,
    mimeType: filename.endsWith(".mp3") ? "audio/mpeg" : "image/png",
    size: 1,
    createdAt: 1,
  };
}

describe("asset reference extraction", () => {
  it("extracts document music and scene image references after variables", () => {
    const markdown = [
      "!var track ./theme.mp3",
      "!music $track volume:0.4",
      "!scene",
      "!image src:./art/logo.png fit:contain",
      "!mockup type:browser src:./shot.png",
    ].join("\n");

    expect(extractRelativeAssetReferences(markdown)).toEqual([
      { kind: "audio", filename: "theme.mp3", rawSrc: "./theme.mp3", lineNumber: 2 },
      { kind: "image", filename: "art/logo.png", rawSrc: "./art/logo.png", lineNumber: 4 },
      { kind: "image", filename: "shot.png", rawSrc: "./shot.png", lineNumber: 5 },
    ]);
  });

  it("ignores traversal, absolute, remote, data URLs, fenced code, and scene-local music", () => {
    const markdown = [
      "!music https://cdn.example.com/theme.mp3",
      "!scene",
      "!music ./ignored.mp3",
      "!image src:/logo.png",
      "!image src:../outside.png",
      "```",
      "!image src:./code-example.png",
      "```",
    ].join("\n");

    expect(extractRelativeAssetReferences(markdown)).toEqual([]);
  });

  it("deduplicates references and creates markdown-safe snippets", () => {
    const references = extractRelativeAssetReferences(
      "!music ./theme.mp3\n!music ./theme.mp3"
    );
    expect(uniqueAssetReferences(references)).toHaveLength(1);
    expect(markdownMediaValue("my theme.mp3")).toBe('"./my theme.mp3"');
    expect(assetReferenceSnippet("audio", "theme.mp3")).toBe(
      "!music ./theme.mp3 volume:0.4 fade:1s"
    );
    expect(assetReferenceSnippet("image", "logo.png")).toBe(
      "!image src:./logo.png fit:contain"
    );
  });

  it("inserts at the cursor without replacing an active selection", () => {
    expect(textWithInsertedReference("abc", 3, 3, "!music ./x.mp3")).toEqual({
      text: "abc\n!music ./x.mp3",
      cursor: 18,
    });
    expect(textWithInsertedReference("abcdef", 2, 4, "snippet")).toEqual({
      text: "abcdef",
      cursor: 2,
    });
  });
});

describe("missing asset diagnostics", () => {
  it("uses uploaded assets before checking static files", async () => {
    const staticExists = vi.fn(async () => false);
    const missing = await findMissingAssetReferences("!music ./theme.mp3", {
      assets: [asset("theme.mp3")],
      staticExists,
    });

    expect(missing).toEqual([]);
    expect(staticExists).not.toHaveBeenCalled();
  });

  it("treats an existing static file as available fallback", async () => {
    const missing = await findMissingAssetReferences("!scene\n!image src:./logo.png", {
      assets: [],
      staticExists: async () => true,
    });
    expect(missing).toEqual([]);
  });

  it("reports missing media as warning diagnostics at the source line", async () => {
    const missing = await findMissingAssetReferences(
      "\n!music ./missing.mp3\n!scene\n!image src:./missing.png",
      { assets: [], staticExists: async () => false }
    );
    const diagnostics = missingAssetDiagnostics(missing);

    expect(missing.map((item) => [item.kind, item.filename, item.lineNumber])).toEqual([
      ["audio", "missing.mp3", 2],
      ["image", "missing.png", 4],
    ]);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
    expect(diagnostics[0].message).toContain("./missing.mp3");
  });
});
