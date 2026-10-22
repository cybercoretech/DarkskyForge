# DarkskyForge

**[Open the studio](https://darkskyforge.pages.dev)** · [Source](https://github.com/cybercoretech/DarkskyForge)

A browser-local creative studio for outlined logos, custom glyphs, and Cybercore
themes. No accounts, tracking, or document uploads. The app ships its fonts and
WebAssembly engine on the same origin.

## Working features

- Logo composer: real outlines, spacing, colours, symbols, transparency, presets,
  SVG/PNG/asset ZIP downloads, editable project files and undo/redo.
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
Cybercore's MIT notice is in `public/theme-engine/LICENSE-MIT`. opentype.js and
fflate are MIT licensed; see [THIRD_PARTY.md](THIRD_PARTY.md).

Licence recognition supports the standard OFL text and declared reserved names;
it cannot establish ownership of arbitrary user-provided fonts or licences.
