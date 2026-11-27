import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: true,
  sourcemap: true,
  minify: false,
  clean: true,
  dts: {
    entry: {
      index: "src/index.ts",
    },
    resolve: true,
  },
  noExternal: ["@markdown-video/core"],
  external: ["playwright-core"],
})
