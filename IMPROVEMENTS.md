# Markdown Video: Improvement Plan

From a codebase review on 2026-11-26. Typecheck was clean and all 84 tests passed at the time.
✅ = confirmed by reading the code. Line numbers are as of commit `387377f` and may have shifted.

---

## Part 1: Code

### P0: Bugs users hit today

- [ ] ✅ **Share links corrupt documents.** `components/video-editor/share-modal.tsx:51`
  - `encoded.slice(0, 500)` truncates any document whose base64 is 501–2000 characters.
  - `+` in the base64 isn't URL-encoded, so it becomes a space when the link is read.
  - Over 2000 characters the link needs Redis. Without Redis it falls back to `?project=too-large`, which `app/editor/page.tsx` ignores, so the recipient gets an empty editor.
  - Fix: drop the slice. Use `encodeURIComponent` on the payload, or base64url. Show an error instead of a broken link when Redis isn't available.
- [ ] ✅ **Redo is broken.**
  - After `undo()`, the debounce effect at `markdown-editor.tsx:81-90` calls `setMarkdown(sameText)` 500 ms later. That pushes a duplicate history entry and clears `future`.
  - Fix: skip the call when `localMarkdown === store.markdown`.
  - `useKeyboardShortcuts.ts:70` checks `e.key === "z"` with Shift held, but the key is `"Z"`. Use `e.key.toLowerCase()`.
- [ ] ✅ **Wipe and slide transitions are broken in both preview and export.** `components/video-editor/scene-preview.tsx:217-226`
  - Wipe: `parseFloat("inset(0 100% 0 0)")` is `NaN`, so every frame gets `NaN%`.
  - Slide: `x: "100%"` against `x: 0` falls through to the snap-at-end branch.
  - Fix: interpolate each number inside a string such as `clipPath`, and treat `0` as `0%`.
- [ ] ✅ **Toasts never appear.** `<Toaster/>` (`components/ui/sonner.tsx`) is never rendered, so every `toast()` in the export flow is invisible. Mount it in `app/layout.tsx`.
- [ ] ✅ **The repeat-last-frame fallback writes empty frames.** `export-modal/components/FfmpegRender.tsx:263-275`
  - `ffmpeg.writeFile` transfers `data.buffer` to the worker, which empties it.
  - `lastFrame` keeps pointing at that emptied buffer, so the fallback writes a 0-byte PNG.
  - Fix: `lastFrame = frameData.slice()`, or write a copy.
- [ ] ✅ **The parser drops content and misreads directives** (`lib/parser/index.ts`, `lib/parser/utils.ts:17`).
  - In `!text` and `!mockup` blocks, any line shaped like `Word: text` is parsed as a property and thrown away if the key is unknown. Examples: "Note: this matters", URLs. Only treat a line as a property when its key belongs to that block.
  - Scene detection uses `startsWith("!section")`, so `!section-title` starts a bogus empty scene. Match `^!(\w[\w-]*)` and compare the whole word (`index.ts:80`, `:104`; same issue at `syntax-validator.ts:518`, `:571`).
  - CRLF line endings break `!var`. Use `markdown.split(/\r?\n/)`.
- [ ] **Export problems**
  - The reels/shorts (9:16) formats in `RenderOptions.tsx:127` are ignored. `FfmpegRender.tsx:132` only uses the project aspect ratio.
  - Cancel races: the loop is still running after `terminate()`, and the stale run then reports an error. Use a per-run token.
  - `Ffmpeg.tsx` never calls `terminate()` on unmount, so the worker leaks and the ~30 MB core reloads on every modal open.
  - The object URL created at `FfmpegRender.tsx:379` is never revoked.
- [ ] **Editor UX bugs**
  - Opening a share link overwrites the recipient's saved project with no prompt (`video-editor/index.tsx:53-57`).
  - Timeline drag-to-reorder never starts, because `dragControls.start()` is never called (`timeline.tsx:31`, `:44`).
  - Clicking a timeline segment always seeks to its start (`timeline.tsx:197` vs `:222`).

### P1: Security and robustness

- [ ] **Upgrade `next@16.0.10`.** `pnpm audit` reports critical advisories, fixed in ≥16.4.1.
- [ ] **Upgrade the MCP SDK.** `@modelcontextprotocol/sdk@1.26.0` has a body-size advisory. Bump it together with `mcp-handler`.
- [ ] **`/api/projects`** (`app/api/projects/route.ts`)
  - No body size cap, rate limit or zod schema.
  - Malformed JSON returns 500 instead of 400.
  - Missing Redis env vars only log a warning, then every call returns 500. Return 503 instead.
  - Expired links (7-day TTL) load an empty editor silently. Show an "expired" state.
  - Fix: cap the body at ~1 MB and add `@upstash/ratelimit`.
- [ ] **MCP route** (`app/api/mcp/[transport]/route.ts`)
  - Add `.max()` to the `z.string()` inputs, plus a rate limit.
  - Set `disableSse: true`, since `REDIS_URL` is unset and the SSE endpoint throws.
- [ ] ✅ **`lib/github.ts` uses `"use server"`**, which makes `getGitHubStars(repo)` a public endpoint with an unvalidated `repo`. Switch to `import "server-only"` and validate `repo` against `^[\w.-]+/[\w.-]+$`.
- [ ] ✅ **Repo hygiene.**
  - Add `.env*.local`, `*.tsbuildinfo`, `.DS_Store`, `.vercel`, `coverage` and `*.log` to `.gitignore`.
  - `git rm --cached tsconfig.tsbuildinfo`.

### P2: Maintainability

- [ ] **One directive schema.** Directive names, aliases, allowed values and defaults are copied across `lib/parser/constants.ts`, `lib/mcp/syntax-validator.ts`, `lib/mcp/documentation.ts`, `lib/types.ts`, and literals in `lib/parser/index.ts`. The copies already disagree:
  - The aliases in the docs and in `KEYWORD_ALIASES` differ for code, terminal, chart, text, duration, background, transition and layout.
  - Transition duration defaults to 0.5 in the docs and is undefined in the parser.
  - Callout `style:` is documented but hard-coded to `"info"` (`index.ts:600`).
  - `fontSize:` is case-sensitive while `fontfamily:` is not.
  - The QR docs call the property `bgColor`; the syntax uses `bg:`.

  Generate the parser tables, validator, docs and completions from one schema.
- [ ] **Validator blind spots.** The font-family check is dead code because the parser coerces bad values to the default. Nothing validates text `size`, particle `intensity`, presenter `size`/`shape`, code `fontSize`, callout `style`, or emoji `size`.
- [ ] **Smaller parser fixes**
  - The chart parser accepts only integers, so `3.5` and `-4` vanish.
  - `!duration -2` falls back to 3 with no error.
  - `highlight: x` produces `NaN`.
  - The parser and validator disagree on indented code fences.
  - Variables aren't substituted in code, terminal or chart content.
  - Terminal output lines starting with `>` are parsed as commands.
  - `!layout` child content is never parsed (`index.ts:738`).
- [ ] **Tests.** Parser tests cover only text, code, terminal, duration, transition and variables. Add tests for:
  - Chart, diff, mockup, QR, countdown, progress, layout, emoji, image, camera, particles, callout and chapter scenes.
  - CRLF line endings.
  - `timeline.ts`.
- [ ] **Remove dead code and dependencies.**
  - **Unused dependencies:** `@vercel/analytics` (or mount it), `date-fns`, `@hookform/resolvers`, `tailwindcss-animate`, `autoprefixer`, and the packages only reached through unused UI files: `react-hook-form`, `cmdk`, `vaul`, `recharts`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `input-otp`, and about 20 Radix packages.
  - **Unused `components/ui` files:** 46 of 54. Only button, dialog, dropdown-menu, input, label, progress, select and tabs are used.
  - **Dead export components:** `ExportSettings`, `ExportPresets`, `ExportProgress`, `FfmpegProgressBar`, plus `getQualitySettings`, `loadPresets` and `savePresets` in `export-utils.ts`.
  - **Unused store state:** `localizationStrings` and `currentLocale`.
  - **Duplicate default document:** `DEFAULT_MARKDOWN` is defined in both `project-menu.tsx` and `lib/default-markdown.ts`.
- [ ] **Type safety.** Remove the `as any` casts in `index.ts` (9) and `syntax-validator.ts` (14) with a typed `includes` helper, and add an exhaustive check to the directive switch.
- [ ] **Add ESLint and a lint script.** CI also needs `permissions:`, `concurrency`, timeouts and `pnpm audit`.

### P3: Performance and UX

- [ ] **Playback** (`controls.tsx:28-38`)
  - It adds a fixed 0.033 s per 33 ms tick, so it drifts. Use `requestAnimationFrame` with `performance.now()`.
  - zustand `persist` writes to localStorage on every tick.
  - `VideoEditor` subscribes to `currentTime`, so the whole editor re-renders about 30 times a second.
  - Fix: keep `currentTime` out of top-level subscriptions and out of persisted state.
- [ ] **Store rehydration.** `onRehydrateStorage` in `use-video-store.ts:271` calls `useVideoStore` before the store exists, so the re-parse never runs. Parse from the `state` argument instead.
- [ ] **Deterministic export.** CountdownScene springs, ProgressScene tweens and the TerminalScene fade run on wall-clock time during export. TextScene's stagger differs between preview and export. Derive all of them from `sceneTime`.
- [ ] **Fixed render size.** Export captures at the on-screen preview width, so line wrapping depends on the window size. Render at a fixed 1920px layout.
- [ ] **Per-frame cost.**
  - Frames are encoded as PNG and copied through an extra canvas. Write raw RGBA or JPEG instead.
  - ffmpeg log lines are stored in React state that is never rendered.
- [ ] **Editor.** Move from the textarea-with-overlays to **CodeMirror 6**. That gives syntax highlighting, native undo, virtualization for long documents, and diagnostics as decorations.
- [ ] **Keyboard.**
  - Plain-key shortcuts ignore modifiers, so Cmd+- and Cmd+[ are hijacked from the browser.
  - Any focused button disables arrows, M, T and ?.
  - Ctrl+N is shown in the menu but not bound.
  - "Next/previous frame" actually moves 1 s.
  - Esc in Find does nothing.
  - `findIndex(...) || x` never falls back, because -1 is truthy.
- [ ] **Find/Replace.** There is no next/previous match, and "replace one" always replaces the first match.
- [ ] **Accessibility.**
  - Icon-only buttons have no labels (`controls.tsx`, the zoom buttons in `EditorHeader.tsx`).
  - Clickable `div`s (scene properties, timeline markers) have no role or keyboard support.
- [ ] **Metadata and assets** (`app/layout.tsx`)
  - The Twitter title and description are an author bio.
  - The Twitter image and canonical URL hardcode the domain and ignore `NEXT_PUBLIC_SITE_URL`.
  - The OG image is 2482×1384 at 869 KB but declared as 1200×630.
  - `/favicon.ico`, `/icon-192.png` and `/icon-512.png` return 404.
  - There is no sitemap or robots file.
  - `globals.css` has 8 render-blocking Google Font `@import`s that duplicate `next/font`.

---

## Part 2: Product direction

### Positioning
Lean into **developer videos as code**: changelogs, PR demos, release notes and tutorials. Code, diff, terminal and chart scenes plus the MCP server already set it apart. "Any video from markdown" is a crowded space; developer video is not.

### Biggest gaps
1. **Audio.** There is no audio support anywhere. In order:
   - A background music track with fade in/out.
   - Per-scene `!voice "..."` narration through text-to-speech.
   - Captions and SRT export generated from text and narration.
2. **Rendering.**
   - Short term: use WebCodecs `VideoEncoder` with a fixed-size layout. It's faster than single-threaded ffmpeg.wasm with full-page html2canvas per frame, and the output is the same on every machine.
   - Longer term: a **headless render CLI** (`npx markdown-video render intro.md`) that drives a headless browser. Most of the features below depend on it.
3. **MCP that can finish the job.** Add `render_preview` (returns a few frames as images, so the agent can check its own work) and `render_video` (returns an MP4 link). Then "write a video for my v2 release" works end to end.
4. **Real projects.** Today there is one document in localStorage plus share snapshots that expire after 7 days. Add:
   - GitHub sign-in.
   - A project list.
   - Share links that don't expire.
   - A real embed player page (today's embed just opens the editor).

### Features that fit the niche
- **GitHub Action:** commit `release.md`, and each tagged release renders the video and attaches it to the release.
- **Generate from a link:** paste a PR or release URL, and the app or an agent drafts the markdown from the diff and notes.
- **Two-way editing:** timeline and scene-property edits write back to the markdown.
- **Template gallery:** product launch, bug-fix walkthrough, "this week in the repo", conference intro.

### Housekeeping
- **Make the README honest.** "Works on all devices", "project management" and "share & embed" are overstated today. Fix those features or cut the claims.
- **Add usage data.** Mount `@vercel/analytics` and track export started/finished/failed and scene types used.
- **Mobile:** make the viewer and embed mobile-friendly and keep editing desktop-only, or drop the claim.
- **Unfinished features:** finish or remove i18n (`i18nKey`, unused locale state) and the `!layout`/split scene.

---

## Part 3: Next phase (after `18fc096`)

Part 1 landed in `a42930f` and `18fc096`. This part covers what comes next. Line references are as of `18fc096`.

### Step 0: Close out the current round
- [ ] **Do one real export by eye.** Compare a 16:9 and a 9:16 export against the preview: caption size, card widths and corners. The headless smoke test predates the change in `18fc096` that lays out the preview at the logical size and scales it down.
- [ ] **Decide on i18n.** Either implement `!locale`, `!strings` and `i18nKey` end to end, or remove them from the schema, docs, completions and syntax guide.
- [ ] **Leftover nits from the review** (none of them block):
  - A 429 shows as "project-unavailable". Give it its own `ShareLinkErrorKind` (`app/editor/page.tsx:76`).
  - `Math.ceil(d*fps)` overshoots by one frame on float durations; use `Math.ceil(d*fps - 1e-9)` (`export-utils.ts:168,192`).
  - The timeline's `commitReorder` should call `flushPendingEditorText()` first.
  - The share gate should auto-accept when the visitor's saved markdown equals `DEFAULT_MARKDOWN`.
  - On a Mac, require `metaKey` and not `ctrlKey`, so Ctrl+N/E/O/H/F stay editor keys. Drop Ctrl+N or document it as Cmd-only.
  - The diagnostic "Fix" should call `validateNow()` before it applies.
  - `snippets.ts` should not throw when it loads; move that assertion into a test.
  - At the end of playback, the last scene should get `sceneTime: last.duration`, not `0`.

### Step 1: Monorepo, carried out as part of the headless renderer

Don't restructure for its own sake. The split pays off once a second consumer (CLI, MCP render, GitHub Action) needs the parser and scenes outside Next. So do it in small, separately reviewable PRs, each with CI green.

**Target layout**
```
apps/
  web/              ← current Next app (editor, landing, API routes, MCP route)
  cli/              ← `markdown-video render intro.md -o out.mp4`
packages/
  core/             ← parser, directive schema, validator, types, share-link codec (pure TS, no React)
  scenes/           ← scene components, overlays, render-layout, transitions, interpolation (React + framer-motion, no store, no Next)
  config/           ← shared tsconfig base, eslint config, vitest preset (optional)
```

**Tooling**
- Use pnpm workspaces (`pnpm-workspace.yaml`) and Turborepo for task caching. Skip Nx; it's too heavy for this repo.
- Package names: `@markdown-video/core`, `@markdown-video/scenes`, and `markdown-video` for the CLI, so that `npx markdown-video` works.
- Build internal packages with `tsup`. Alternatively, use Next's `transpilePackages` for `apps/web` and build only for the CLI.

**Extraction order (one PR each)**
1. **Workspace scaffold.**
   - Move the app to `apps/web` unchanged.
   - Add `pnpm-workspace.yaml` and `turbo.json`.
   - Point the root scripts at `turbo run lint typecheck test build`.
   - Keep the `@/` alias working inside `apps/web`, so no app imports change in this PR.
   - Run `next typegen && tsc` inside `apps/web`.
   - Update Vercel: set Root Directory to `apps/web`, and include files outside it in the build.
   - CI: make the cache key and `--frozen-lockfile` work from the root.
2. **`packages/core`.**
   - Move `lib/parser/**`, `lib/directive-schema.ts`, `lib/types.ts`, `lib/mcp/syntax-validator.ts`, `lib/mcp/documentation.ts`, the pure part of `lib/share-link.ts`, and the related `__tests__`.
   - These files already have no imports from React, Next or the store (checked at `18fc096`), so this is mostly a move plus import rewrites.
   - The web app imports `@markdown-video/core`.
   - The parser, schema and validator tests run in `packages/core`.
3. **`packages/scenes`.**
   - Move `components/video-editor/scene-preview/{scenes,components,utils}/**` and the pure frame composition from `scene-preview.tsx`, i.e. the logical-size frame that `ScenePreview` scales.
   - Already store-free: nothing under `scene-preview/` imports `use-video-store` outside tests.
   - Still to decouple:
     - `@/lib/utils` (`cn`): copy it in or move it to core.
     - `utils/fonts.ts`: it relies on `next/font` CSS variables set in `app/layout.tsx`. Change it to read `--font-*` variables that the host must define. The web app keeps defining them through `next/font`; the render page defines them with `@font-face`.
   - Export a single `<SceneFrame scene sceneTime aspectRatio />` component. Both the editor preview (it adds the store, zoom and fit) and the render page use it.
4. **The render page and `apps/cli`.**
   - Build a minimal static page with Vite and React that mounts `<SceneFrame>` at the logical size and exposes `window.__mv = { load(markdown), seek(t), totalDuration }`.
   - The CLI:
     - parses the args (`render <file.md> -o out.mp4 --res 1080p --fps 30 --aspect 16:9`);
     - serves the built page;
     - drives it with Playwright (bundled Chromium);
     - calls `seek(i/fps)` then `page.screenshot({ clip })` for each frame;
     - pipes the frames to native `ffmpeg` (`-f image2pipe`), or to `ffmpeg-static` if no system ffmpeg is installed.
   - Frame timing reuses `getTotalFrameCount` (currently in `export-utils.ts`; move it to `packages/scenes`) and the render-layout dimensions from `packages/scenes`. The CLI's output then matches the browser export by construction.
   - Tests:
     - a golden-frame test that renders 3 fixed timestamps of a fixture doc and compares PNG hashes or a pixel diff within a tolerance;
     - a duration and frame-count test on the MP4 via `ffprobe`.

**Risks and checks**
- Fonts: if fonts haven't loaded before frame 0, the screenshots come out wrong. Await `document.fonts.ready` in `load()`.
- framer-motion: anything still animated by framer's own clock instead of `sceneTime` will differ between the browser and the CLI. Golden frames will catch this.
- CI time: cache the Playwright browser and run the CLI e2e only when `packages/scenes` or `apps/cli` change (Turbo filters).
- Licences: ffmpeg-static is GPL and Playwright's Chromium is fine. Note both in the CLI README.

### Step 2: MCP renders its own output
- [ ] `render_preview(markdown, times?: number[])` returns 3–6 PNG frames (MCP image content), so agents can check their own work.
- [ ] `render_video(markdown, options)` returns an MP4 URL. This needs a render worker (a container running the CLI, so not a Vercel function) plus object storage (R2 or S3) with expiry.
  - Rate-limit it separately.
  - Cap the duration and resolution.
- [ ] Keep the existing tools read-only and fail-open. Rendering tools fail closed.

### Step 3: GitHub Action
- [ ] `markdown-video/render-action`: on `release: published`, render `release.md` (or a path given as input) with the CLI and upload the MP4 as a release asset.
- [ ] Optional: a PR comment with a preview GIF when `*.video.md` changes.
- [ ] Dogfood it on this repo's own releases.

### Step 4: Audio
- [ ] `!music <url|file> volume:0.4 fade:1s` at document level, mixed in native ffmpeg in the CLI and in ffmpeg.wasm in the browser.
- [ ] Captions: build SRT/VTT from text scenes and narration, burn them in optionally, and export them as a sidecar file.
- [ ] `!voice "..."` per scene through a TTS provider (server-side, and never with user keys in the client). Scene duration becomes `max(declared, narration length)`.

### Step 5: Real projects (only if analytics show people return)
- [ ] GitHub sign-in.
- [ ] Project list.
- [ ] Share links that don't expire.
- [ ] Real embed player page at `/embed/<id>`: player-only, no editor bundle.

---

## Suggested order
1. ~~P0 bug fixes, plus `.gitignore`, `github.ts` and the Next upgrade.~~ Done in `a42930f`.
2. ~~API size caps and rate limits.~~ Done in `a42930f` and `18fc096`.
3. ~~Parser fixes, plus tests per scene type.~~ Done.
4. ~~Single directive schema.~~ Done.
5. ~~Dead code and dependency cleanup.~~ Done.
6. ~~Fixed-size export.~~ Done. Next: Part 3, Step 0 (close out the current round).
7. Part 3, Step 1: monorepo scaffold → `core` → `scenes` → render page plus CLI.
8. Part 3, Step 2: MCP `render_preview`, then `render_video`.
9. Part 3, Step 3: GitHub Action.
10. Part 3, Step 4: background music and captions, then TTS.
11. Part 3, Step 5: accounts and a project list, once analytics show people come back.
