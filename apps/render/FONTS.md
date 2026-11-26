# Render-page font provenance

The render host does not use system or network fonts. It bundles the same WOFF2
files that `next/font/google` downloads and serves for the Next.js editor in
`apps/web/app/layout.tsx`, plus a bundled color emoji webfont used by every
scene font fallback chain.

## Generation method

`next/font` fetches Google Fonts CSS with a Chrome 104 user agent so Google
returns WOFF2, downloads every `@font-face` source into `.next/static/media`,
and rewrites the CSS to those local files. `scripts/download-fonts.mjs`
reproduces those exact requests for the nine editor text families and for Noto
Color Emoji:

| Family | Google Fonts request |
| --- | --- |
| Inter | `family=Inter:wght@100..900&display=swap` |
| Geist Mono | `family=Geist+Mono:wght@100..900&display=swap` |
| Playfair Display | `family=Playfair+Display:wght@400..900&display=swap` |
| JetBrains Mono | `family=JetBrains+Mono:wght@100..800&display=swap` |
| Fira Code | `family=Fira+Code:wght@300..700&display=swap` |
| Source Code Pro | `family=Source+Code+Pro:wght@200..900&display=swap` |
| Inconsolata | `family=Inconsolata:wght@200..900&display=swap` |
| IBM Plex Mono | `family=IBM+Plex+Mono:wght@400;500;600;700&display=swap` |
| Merriweather | `family=Merriweather:wght@300..900&display=swap` |
| Noto Color Emoji | `family=Noto+Color+Emoji&display=swap` |

The generated set contains 80 files: 69 text-family subset files and 11 color
emoji unicode-range shard files. At generation time on 2026-11-26 the 69 text
files' SHA-256 multiset matched all 69 `.woff2` files emitted by the editor's
Next.js production build exactly (no missing or extra hashes). Individual
source URLs, byte sizes, and hashes are committed in
`src/fonts/provenance.json`.

To regenerate after intentionally changing `apps/web/app/layout.tsx` font
configuration or the emoji font choice:

```sh
pnpm --dir apps/render fonts:update
```

Then verify the text-font hash multiset against a fresh `apps/web` production
build and commit the changed files, CSS, and provenance metadata together. The
script removes only generated `.woff2`/provenance artifacts; license and notice
files in `src/fonts` are deliberately preserved.

## Color emoji font choice

The bundled emoji font is **Noto Color Emoji**, served by Google Fonts to
Chromium as COLRv1/CPAL vector WOFF2. The committed shards report font version
`2.055;GOOG;noto-emoji:20260909:d95d1b76f2c62771c34acbbcd7269145e8398e10` in
their name tables. Their combined size is 2,084,740 bytes.

Why this format and family:

- Chromium has supported COLRv1 since Chrome 98; the headless renderer uses a
  current Playwright Chromium. The committed files were inspected with
  fonttools and contain `COLR` version 1, `CPAL`, `glyf`, and no bitmap or
  SVG-in-OpenType color table.
- Google's CBDT/CBLC Noto Color Emoji bitmap font is roughly 9 MB before
  subsetting and bitmap scaling is less suitable for video resolutions. The
  COLRv1 vector representation is about 1.85 MB in Google's commonly cited
  single-file compression measurements; the committed Google unicode-range
  shards total about 2.08 MB while preserving the full upstream repertoire.
- Twemoji Mozilla's COLRv0 font is similarly small, but its latest upstream
  release is Twemoji/Emoji 14-era and the artwork is CC-BY 4.0. OpenMoji is
  actively maintained but CC-BY-SA. Noto Color Emoji is actively maintained,
  tracks current Unicode emoji, and uses the same SIL OFL 1.1 as the existing
  text families, so it introduces no new attribution or share-alike contract.
- OpenType-SVG is not implemented by Chromium, and CBDT bitmap fonts retain the
  size/scaling problems above. COLRv0 would be more portable to old browsers
  but cannot represent Noto's gradient artwork; COLRv1 is the correct tradeoff
  for the controlled Chromium render host.

No project-local subsetting beyond Google's own unicode-range shards is used.
Coverage therefore follows the upstream Noto Color Emoji repertoire rather than
a hand-maintained list: BMP emoji/symbol blocks, supplementary-plane emoji,
regional-indicator flags, keycap sequences, skin-tone modifiers, ZWJ sequences,
variation-selector-16 emoji presentation, and tag-based subdivision flags. The
font is not a general Unicode font; non-emoji scripts remain the responsibility
of the nine text families or future script-specific fonts.

## Fallback and unicode-range strategy

`src/styles.css` defines `--font-emoji: "Noto Color Emoji"`. Scene font chains
place `var(--font-emoji, …)` after the primary text family variable. That order
is deliberate:

1. Latin letters, ASCII digits, punctuation, and symbols covered by the chosen
   text font continue to use that text font. This matters because Google's
   emoji shard range includes ASCII digits, `#`, `*`, ©, ®, and ™ so keycap
   and emoji-variation sequences can be shaped.
2. Emoji not covered by the text font resolve to the bundled color face before
   Chromium asks fontconfig or the operating system for an environment-dependent
   emoji font.
3. Each emoji `@font-face` retains Google's exact `unicode-range`, so the face
   is scoped to emoji-related codepoints and sequence components rather than
   acting as another general-purpose text family. The ranges include ZWJ
   (`U+200D`), variation selector 16 (`U+FE0F`), keycap (`U+20E3`), skin-tone
   modifiers, regional indicators, and tag characters used by subdivision flags.

The result is deterministic in the headless host even though different host
operating systems have different system emoji fonts. It also means emoji inside
explicit text/code font families, standalone `!emoji` scenes, emoji timeline
elements, and DOM-rendered captions share the same color font.

## Licenses

All ten upstream font projects are distributed under the **SIL Open Font
License 1.1**. The bundled files are unmodified upstream WOFF2 binaries, so
redistribution with this application is license-compatible. The complete
license text is committed at `src/fonts/OFL-1.1.txt`. Copyright/license metadata
is also embedded in the font binaries; Noto Color Emoji carries
`Copyright 2022 Google Inc.` and the OFL URL in its name table. OFL does not
require attribution in videos or documents produced with the fonts, and no
separate NOTICE is required for these unmodified files.

Upstream projects:

- Inter — Rasmus Andersson / Inter Project Authors: <https://github.com/rsms/inter>
- Geist Mono — Vercel / Geist Project Authors: <https://github.com/vercel/geist-font>
- Playfair Display — Claus Eggers Sørensen / Playfair Project Authors: <https://github.com/clauseggers/Playfair-Display>
- JetBrains Mono — JetBrains / JetBrains Mono Project Authors: <https://github.com/JetBrains/JetBrainsMono>
- Fira Code — Nikita Prokopov / Fira Code Project Authors: <https://github.com/tonsky/FiraCode>
- Source Code Pro — Adobe / Paul D. Hunt: <https://github.com/adobe-fonts/source-code-pro>
- Inconsolata — Raph Levien / Inconsolata Project Authors: <https://github.com/googlefonts/Inconsolata>
- IBM Plex Mono — IBM Corp. / Mike Abbink and Bold Monday: <https://github.com/IBM/plex>
- Merriweather — Sorkin Type / Merriweather Project Authors: <https://github.com/SorkinType/Merriweather>
- Noto Color Emoji — Google / Noto Project Authors: <https://github.com/googlefonts/noto-emoji> (license: <https://github.com/googlefonts/noto-emoji/blob/main/LICENSE>)

The CSS variables in `src/styles.css` deliberately use the original family
names (`"Inter"`, `"JetBrains Mono"`, `"Noto Color Emoji"`, and so on). Those
are the same family names in the `next/font`-generated editor CSS where the
editor uses the corresponding font, so scene font resolution is consistent
while still satisfying the `@markdown-video/scenes` host contract.
