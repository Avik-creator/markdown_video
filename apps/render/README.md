# @markdown-video/render-page

A minimal Vite + React page whose only job is deterministic frame composition
for the headless renderer. It has no editor chrome, playback loop, randomness,
or wall-clock-driven scene animation.

The page renders `SceneFrame` from `@markdown-video/scenes` at the canonical
logical composition size (for example 1920×1080 for 16:9 or 1080×1920 for
9:16). Display scaling and capture are owned by the CLI host.

## Commands

```sh
pnpm --dir apps/render dev       # Vite dev server on 127.0.0.1
pnpm --dir apps/render build     # static production build in dist/
pnpm --dir apps/render preview   # serve the production build
```

`dist/` is a build artifact and is not committed. The CLI resolves this package
and serves its built `dist/` directory from loopback, so build this package
before running the CLI.

## Host contracts implemented here

- **Fonts:** all nine `SCENE_FONT_CSS_VARIABLES` are defined in
  `src/styles.css`. The exact WOFF2 files served by the editor's `next/font`
  setup are bundled under `src/fonts/`; see `FONTS.md` for provenance, hashes,
  regeneration, and licensing. `load()` explicitly loads/checks regular through
  bold faces and fails before capture if any family is missing.
- **Tailwind:** `src/styles.css` imports Tailwind v4 and registers
  `@source "../../../packages/scenes/src"` so utilities used inside the scenes
  workspace package are generated.
- **Localization:** `?locale=<code>` becomes the host-selected active locale in
  `SceneFrame`; omitting it uses the document/default resolution chain.
- **Aspect ratio:** `?aspect=16:9|9:16|1:1|4:3` chooses the logical frame
  geometry. Invalid values fall back to `16:9`.

## `window.__mv` capture bridge

The page exposes exactly this mutable bridge:

```ts
window.__mv = {
  load(markdown: string): Promise<number>,
  seek(t: number): Promise<void>,
  totalDuration: number,
}
```

- `load(markdown)` parses with `@markdown-video/core`, synchronously commits
  the initial frame through React `flushSync`, verifies the font contract,
  waits for `document.fonts.ready` plus one `requestAnimationFrame`, updates
  `totalDuration`, and resolves with that duration.
- `seek(t)` requires a successful `load`, validates that `t` is finite and
  non-negative, synchronously commits the scene/sceneTime resolved by the
  scenes package's `getSceneAtTime` semantics, then resolves only after
  `document.fonts.ready` plus one post-commit `requestAnimationFrame`.
- Bridge operations are serialized internally, so a later seek cannot overtake
  an earlier seek's readiness point.

The readiness signal is therefore the returned promise itself; the CLI does not
poll a heuristic flag or sleep for a fixed duration.
