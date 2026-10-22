#!/usr/bin/env bash
# Rebuilds src/autohint/ttfautohint.{mjs,wasm} from the signed ttfautohint
# release, compiled with Emscripten against its FreeType and HarfBuzz ports.
#
# Requirements: emsdk 6.0.11 activated (source emsdk_env.sh), a C toolchain
# and FreeType/HarfBuzz development files (configure generates headers).
#
# The output must stay CSP-safe: no embind, -sDYNAMIC_EXECUTION=0, so the
# loader never builds code from strings (the site has no 'unsafe-eval').
set -euo pipefail
VERSION=1.8.4
SHA256=8a876117fa6ebfd2ffe1b3682a9a98c802c0f47189f57d3db4b99774206832e1
EMSDK_VERSION=6.0.11
root=$(cd "$(dirname "$0")/.." && pwd); out=$root/src/autohint
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
emcc --version | head -1 | grep -q " $EMSDK_VERSION " || { echo "need emsdk $EMSDK_VERSION active"; exit 1; }
curl -fsSL -o "$work/ta.tar.gz" "https://download.savannah.gnu.org/releases/freetype/ttfautohint-$VERSION.tar.gz"
echo "$SHA256  $work/ta.tar.gz" | sha256sum -c -
mkdir "$work/src" && tar -xzf "$work/ta.tar.gz" -C "$work/src" --strip-components=1   # keep timestamps: no autoreconf
cd "$work/src" && ./configure --without-qt --without-doc -q >/dev/null && make -s -j"$(nproc)" >/dev/null
mapfile -t SRCS < <(sed -n '/^lib_libttfautohint_la_SOURCES/,/^$/p' Makefile.in | grep -oE 'lib/[a-z_-]+\.c'; echo lib/numberset.c; echo lib/sds-wrapper.c)
emcc -O2 -I. -Ilib -Ignulib "${SRCS[@]}" "$out/dsf_autohint.c" \
  -sUSE_FREETYPE=1 -sUSE_HARFBUZZ=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createTtfautohint \
  -sENVIRONMENT=web,worker,node -sDYNAMIC_EXECUTION=0 -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS=_dsf_autohint,_dsf_last_error,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32,UTF8ToString -o "$out/ttfautohint.mjs" 2>/dev/null
if grep -qE 'new Function|[^a-zA-Z_.]Function\(|[^a-zA-Z_.$]eval\(' "$out/ttfautohint.mjs"; then echo "loader uses eval: not CSP-safe"; exit 1; fi
cat > "$out/provenance.json" <<JSON
{
  "ttfautohint": {"version": "$VERSION", "source": "https://download.savannah.gnu.org/releases/freetype/ttfautohint-$VERSION.tar.gz", "sha256": "$SHA256", "signature": "Werner Lemberg <wl@gnu.org>, DSA key 58E0C111E39F5408C5D3EC76C1A60EACE707FDA5", "license": "FreeType License (FTL), chosen from FTL/GPLv2"},
  "emscripten": "$EMSDK_VERSION",
  "ports": {"freetype": "$(grep -oE "VER-[0-9-]+" "$(dirname "$(which emcc)")/tools/ports/freetype.py" | head -1)", "harfbuzz": "$(grep -oE "VERSION = '[0-9.]+'" "$(dirname "$(which emcc)")/tools/ports/harfbuzz.py" | grep -oE '[0-9.]+')"},
  "outputs": {"ttfautohint.mjs": "$(sha256sum "$out/ttfautohint.mjs" | cut -d' ' -f1)", "ttfautohint.wasm": "$(sha256sum "$out/ttfautohint.wasm" | cut -d' ' -f1)"}
}
JSON
echo "built $(stat -c %s "$out/ttfautohint.wasm") byte wasm; provenance in $out/provenance.json"
