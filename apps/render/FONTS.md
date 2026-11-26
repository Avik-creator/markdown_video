# Render-page font provenance

The render host does not use system or network fonts. It bundles the same WOFF2
files that `next/font/google` downloads and serves for the Next.js editor in
`apps/web/app/layout.tsx`.

## Generation method

`next/font` fetches Google Fonts CSS with a Chrome 104 user agent so Google
returns WOFF2, downloads every `@font-face` source into `.next/static/media`,
and rewrites the CSS to those local files. `scripts/download-fonts.mjs`
reproduces those exact requests for the nine editor families:

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

The generated set contains 69 subset files. At generation time on 2026-11-26
its SHA-256 multiset matched all 69 `.woff2` files emitted by the editor's
Next.js production build exactly (no missing or extra hashes). Individual
source URLs, byte sizes, and hashes are committed in
`src/fonts/provenance.json`.

To regenerate after intentionally changing `apps/web/app/layout.tsx` font
configuration:

```sh
pnpm --dir apps/render fonts:update
```

Then verify the hash multiset against a fresh `apps/web` production build and
commit the changed files, CSS, and provenance metadata together.

## Licenses

All nine upstream font projects are distributed under the **SIL Open Font
License 1.1**. The bundled files are unmodified upstream WOFF2 binaries, so
redistribution with this application is license-compatible. The complete
license text is committed at `src/fonts/OFL-1.1.txt`.

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

The CSS variables in `src/styles.css` deliberately use the original family
names (`"Inter"`, `"JetBrains Mono"`, and so on). Those are the same family
names in the `next/font`-generated editor CSS, so scene font resolution is
consistent while still satisfying the `@markdown-video/scenes` host contract.
