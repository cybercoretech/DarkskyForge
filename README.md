# DarkskyForge

**[Open the studio](https://darkskyforge.pages.dev)** · [Source](https://github.com/cybercoretech/DarkskyForge)

A browser-local creative studio for outlined logos, custom glyphs, and Cybercore
themes. No accounts, tracking, or document uploads. The app ships its fonts and
WebAssembly engine on the same origin.

## Working features

- Logo composer: real outlines, spacing, colours, symbols, transparency, presets,
  SVG/PNG/asset ZIP downloads, editable project files and undo/redo.
- 27 bundled open-source typefaces in four groups (Code · mono, Techno · display,
  Pixel · retro, Clean · sans) and 17 logo symbols plus wordmark-only.
- Glyph lab: draggable Bézier points, coordinate editing, blank-glyph drawing,
  side-bearing handles, visual pair kerning, and a ligature substitution map.
- SVG-to-glyph import/drop: path geometry only; convert shapes to paths and flatten
  transforms first. Imported markup is never attached to the document.
- Font compilation: a renamed subset as OTF (CFF), TTF (TrueType `glyf`) and/or
  WOFF2 with a ready `@font-face` CSS file, including custom metrics, `kern` pairs
  and GSUB ligatures. The original OFL licence accompanies every font/artwork export.
  Exports are checked by fontTools in CI and by Chrome's font sanitizer in the browser tests.
- Live `@font-face` preview with size and light/dark controls. This uses the actual
  current browser/OS renderer, not an imitation of ClearType or macOS.
- Google Fonts browser: 1,679 OFL families with a Latin subset.
  - Search by name or designer, filter by category, pick a style.
  - The font and its `OFL.txt` download straight from the google/fonts repository at a
    pinned commit (`public/google-fonts/catalog.json`, built by
    `tools/build-google-catalog.mjs`; no API key).
  - Projects store the pinned reference, so a Google font survives a reload.
  - Exports record the source URL and commit.
  - Variable fonts are edited at their default instance and exported as static fonts.
- Autohinting for TTF/WOFF2 exports. It's on by default and can be switched off.
  - ttfautohint 1.8.4 compiled to WebAssembly, running in a Web Worker.
  - Its output is byte-identical to the native ttfautohint in every hinting table.
  - Hints sharpen small text where TrueType instructions are used (Windows,
    bi-level rendering); macOS and most Linux setups largely ignore them.
  - Hinted files are about 30% larger.
- Local TTF/OTF/WOFF imports accompanied by an OFL 1.1 licence. WOFF2 and other
  licences are not yet supported. Reserved names are checked before font export.
- Project saving via File System Access where supported, with a download fallback.
  Repeat saves reuse the chosen handle in the current session.
- Integrated Cybercore Theme Studio: embedded themes, palette/appearance editing,
  native-engine contrast reports, local custom themes, CSS and theme export,
  family packs and conflict-aware pack import.

The current project auto-saves to browser storage when using a bundled font.
Imported fonts stay in memory; save a project JSON to preserve the font and licence.
Font export includes composition characters plus edited/metric/pair/ligature glyphs,
not the entire source font. Source hinting, shaping and variation tables are not
preserved. See [ROADMAP.md](ROADMAP.md) for the larger typography features.

## Develop and verify

Node 22.12+ (Node 24 recommended):

```sh
npm ci
npm run dev
npm test
npm run test:browser
npm run build
```

Local browser checks use `/usr/bin/chromium`, overridable with `CHROMIUM_PATH`.
CI installs Playwright's Chromium. Tests cover model validation, binary font
round-trips/checksums, licences, real downloads, typography controls, local file
saving through a test handle, persistence, invalid imports, and desktop/mobile UI.
A real operating-system save dialog still requires a manual browser check.

## Shared theme engine

Generated WASM/JS is tracked so a normal frontend build needs no Rust toolchain.
`src/theme-engine/provenance.json` records the upstream commit. To regenerate:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked
CYBERCORE_SOURCE=/path/to/cybercore npm run build:themes
```

The upstream change is [cybercore#1](https://github.com/cybercoretech/cybercore/pull/1).
The default local source path is `../../framework/cybercore`.

## Deploy

The Pages project is `darkskyforge`, on the Darkstardevx Cloudflare account.
`npm run deploy` builds and directly uploads `dist/` to the production Pages branch.
Wrangler runs in a temporary directory to avoid Workers autoconfiguration changing
this frontend project. GitHub PR merges remain manual.

## Licences and provenance

App: MIT. Bundled Monaspace Krypton ExtraBold: GitHub / Lettermatic, OFL 1.1,
Reserved Font Names listed in `public/fonts/OFL-Monaspace.txt`. JetBrains Mono Bold:
JetBrains Mono Project Authors, OFL 1.1 in `public/fonts/OFL-JetBrains.txt`.

The Monaspace WOFF is the unchanged Fontsource Latin asset retained from DWCode's
approved Bracket pack. JetBrains Mono is from its official upstream repository.

The other 25 typefaces are Fontsource Latin WOFF files, each next to its licence in
`public/fonts/OFL-<id>.txt`. They're listed in `tools/fonts.json`;
`node tools/fetch-fonts.mjs` downloads them and accepts a font only if:
- its licence passes the app's own SIL OFL 1.1 reader with no ambiguous
  Reserved Font Name;
- it covers A–Z, a–z and 0–9;
- its bytes match the SHA-256 in `tools/fonts.lock.json`.

The script then generates `src/font-library.js`. CI runs it with `--check`. Iosevka
and Share Tech Mono were left out: their published licence files are not a complete
OFL text, or declare reserved names ambiguously.
Cybercore's MIT notice is in `public/theme-engine/LICENSE-MIT`. opentype.js and
fflate are MIT licensed; see [THIRD_PARTY.md](THIRD_PARTY.md).

Licence recognition supports the standard OFL text and declared reserved names;
it cannot establish ownership of arbitrary user-provided fonts or licences.
