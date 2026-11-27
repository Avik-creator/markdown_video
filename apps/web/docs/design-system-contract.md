# Markdown Video design-system contract

Derived from the public design language of `avikmukherjee.com` (inspected 2026-11-27). This contract adopts the reference's tokens, materials, typography, and interaction discipline — not its name, personal branding, sunset artwork, copy, or content.

## Reference evidence

- Light theme: warm cream-peach `background #fff4ec`, deep warm plum ink `foreground #2b1030`, muted ink `#2b1030a6`, raspberry accent `#d81b7a`, white on-accent, burnt-orange marker ink `#c2410c`, translucent orange marker tint `#ff8a3d33`.
- Dark theme: warm aubergine `background #130a24`, pink-cream ink `#fdebf4`, muted ink `#fdebf4a3`, bright raspberry `#ff4fa3`, dark plum on-accent, orange marker `#ffa24c`, tint `#ffa24c2e`.
- Hairline system: ink-alpha lines rather than shadow-heavy elevation — `--hairline` 14 hex alpha, `--border` 24, `--line` 1c/1f, `--line-soft` 3d, `--line-strong` 45/40. Surfaces are ink at 0a alpha.
- Supporting tones: destructive rose, live teal (`#0f8f8a` light / `#3ee6e0` dark), tag orange; occasional blue/cyan accents may be used only for syntax/status differentiation, never as a purple/indigo product theme.
- Typography: JetBrains Mono is the reference's UI/monospace voice (`--font-ui`, compact 13px/20px rows); Geist is the editorial/prose voice (`--font-text`). Yellowtail exists only as personal branding and is not adopted.
- Density/geometry: 35rem reading column and 42.5rem article column in the reference; 4px base radius, 6px controls, 30px desktop control height (36px on small screens), hairline-bordered transparent controls.
- Interaction language: `--smooth: cubic-bezier(.16, 1, .3, 1)`; short 150–350ms color/opacity/transform transitions, small 3px translational affordances, sibling dimming in rows, no bouncy or shadow-led motion. Reduced motion disables animation.
- Links/buttons/markers: inline links use soft plum underline at 3px offset and turn raspberry on hover. Primary actions may use the restrained raspberry-to-orange reference treatment; secondary actions are transparent hairline controls. Markers are hand-drawn in spirit: orange underline/highlight and raspberry circle/box accents.

## Product token architecture

Both surfaces consume one semantic token tree in `app/globals.css`:

- Canvas/ink: `--background`, `--foreground`, `--muted-foreground`.
- Materials: `--surface`, `--panel`, `--panel-raised`, `--inset`, `--preview-canvas`.
- Lines: `--hairline`, `--border`, `--line`, `--line-soft`, `--line-strong`.
- Actions: `--accent`, `--accent-deep`, `--on-accent`, `--ring`, `--selection`.
- Editorial markers/status: `--mark-ink`, `--mark-tint`, `--live`, `--tag`, `--destructive`, `--warning`, `--info`.
- Motion/shape/type: `--smooth`, `--radius`, `--font-sans`, `--font-mono`.

Shadcn-compatible aliases (`--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--input`, sidebar/chart slots) map onto the same values so existing primitives do not fork the system. Scene-rendering font variables remain host contracts for video content and are not product UI tokens.

## Typography scale

- Geist is the default product/editorial sans. Landing headlines use tight Geist display sizes; body copy uses Geist at comfortable editorial line-height.
- JetBrains Mono is the product's technical voice: navigation metadata, code, markdown editing, timestamps, labels, shortcuts, and dense editor controls.
- Editor density stays professional-tool tight: 12–14px text, 20px code line-height, 30–32px controls. Do not inflate spacing to marketing-site scale.
- Serif/display scene fonts stay available only because rendered video scenes depend on them; product chrome must not use Playfair/Merriweather as its own voice.

## Surface mapping

- Landing: editorial but restrained. Wide media grids may remain because the product demonstrates real rendered artifacts, but material treatment becomes flat cream/aubergine, plum hairlines, 6–10px radii, translucent surface fills, compact reference-style actions, orange/raspberry markers, and little or no shadow. Print texture, oversized shadow layering, pill buttons, and crimson/brown divergence are removed.
- Editor: dense tool surface. Header, source panel, preview viewport, properties/assets/guide/templates panels, controls, timeline, popovers, and modals all use the same tokens. The preview viewport may remain deep plum in both themes so rendered scene colors read as video content; surrounding chrome is theme-aware cream/aubergine. Hairlines separate regions; elevation is reserved for floating popovers/modals and remains subtle.
- Light and dark are equal citizens. Dark is the reference aubergine, not zinc black or generic violet.

## Deliberately unchanged

- Editor layout, feature set, keyboard shortcuts, panel information architecture, scene/timeline interaction model, markdown source-of-truth behavior, export/share flows, and overnight editable-properties/assets/insertion work.
- Landing copy, section order, links, and real rendered video/image artifacts.
- `apps/render` and `packages/scenes` rendering aesthetics: those are video content, not product UI.
- Product name/voice. The reference contributes design language only.

## Accessibility and responsive invariants

- Every text/background pairing used by product chrome must meet WCAG AA in both themes (4.5:1 normal text, 3:1 large text and non-color UI indicators), measured rather than assumed.
- Focus-visible state is a 2px raspberry outline/ring with adequate offset; interactive meaning is never carried by color alone.
- `prefers-reduced-motion` disables nonessential animation.
- No horizontal overflow at 320, 768, 1024, or 1440 in either theme on either surface.
