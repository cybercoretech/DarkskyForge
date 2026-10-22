# Typography roadmap

The first public build implements the logo composer, basic glyph editing and
metrics, pair kerning, ligature mapping, actual browser font previews, local file
saving, and the integrated WASM Theme Studio. This document records the user's
2026-10-21 suggestions and the work still required.

## Next typography work

- Robust curve tools: add/delete nodes, tangent handles, smooth/corner conversion,
  contour direction/hole control, multi-selection, pan/zoom, snapping, and actions
  stored as bounded deltas rather than whole-project snapshots.
- Complete font preservation and language shaping: carry source layout/variation
  tables where safe, test composite glyphs, non-Latin scripts and glyph coverage.
- Metrics: class kerning, pair search, specimen strings and drag tests across zoom
  levels. Current pair editor and exported kern table are per-pair only.
- Ligatures: current map emits GSUB `liga` substitutions; a larger grid/search UI
  should support alternates, contextual rules and language/script-specific features.
- SVG import: flatten nested transforms and convert basic shapes; current import
  accepts outline paths and refuses unsupported geometry instead of distorting it.

## Autohinting and file formats

There is no cosmetic “autohinting” toggle in the current app. Genuine hinting must
emit valid instructions/tables and demonstrate better small-size rendering.
Evaluate [ttfautohint](https://freetype.org/ttfautohint/) compiled to WASM in a Worker
for TrueType outputs and a separate CFF/PostScript hinter for OTF. Validate hinted
fonts with independent parsers/sanitizers and size-by-size rendering comparisons.

Done: OTF (CFF), TTF (quadratic `glyf`/`loca` conversion in `src/fontformats.js`) and
WOFF2 (our own container writer with untransformed `glyf`/`loca` plus Brotli from
`brotli-wasm`, loaded only when needed; about 5% larger than Google's encoder, which
also rewrites glyph data, but it runs under the strict CSP with no runtime code
generation), with fontTools validation in CI and browser-sanitizer checks. Still to do:
keep compilation cancellable and off the UI thread as font sizes grow. [opentype.js](https://github.com/opentypejs/opentype.js) provides
our parser and OTF/GSUB writer; the app writes a standard kern table separately.

## Font-provider imports

Done:
- Local OFL imports, and a Google Fonts browser over a curated catalogue pinned to one
  google/fonts commit. It's built from the public git tree and
  fonts.google.com/metadata/fonts, so no account key sits in the public app.
- Each import fetches the family's own `OFL.txt` and must pass the app's OFL check.
- Projects keep the pinned reference; exports record the source URL and commit.
- Apache and UFL families are left out, because export enforces OFL rules.

Still to do:
- Variable-font instancing: pick axis values instead of the default instance.
- Font previews in the browser list (each would need a font download).
- Pre-checking every family's licence for ambiguous Reserved Font Names: today that
  is caught at export.
- A scheduled catalogue refresh: re-run the builder with a new commit and review the
  diff.

Adobe Fonts is not an open-source font catalogue. Its [licensing terms](https://helpx.adobe.com/fonts/web/font-licensing/font-licensing.html)
must be checked for the exact use; do not treat subscription font access as
permission to extract, modify, and redistribute font binaries. Adobe-published
open-source families can instead be imported from their licensed upstream source.

## Collaboration

Evaluate [Yjs](https://docs.yjs.dev/) with a WebSocket provider. Store glyphs in
separate shared maps, give contours/nodes stable IDs, and define conflict behavior
for metrics, rename/delete and global operations. This needs a hosted room service,
room access controls, reconnect/offline tests and an explicit sharing action.
The current app is local-only and has no collaboration transport. Update the
privacy copy when a user deliberately enters a shared room.

## Browser rendering

The current `@font-face` testbed uses the real local rasterizer with size and
light/dark controls. Browser CSS cannot reliably reproduce Windows ClearType on
macOS or vice versa. A genuine cross-platform comparison requires tests executed
on those platforms with captured output, labelled with environment/version.

## Other queue items

DWCode public project vitals and its private in-app statistics panel remain last,
as requested. They have not been started in this app milestone.
