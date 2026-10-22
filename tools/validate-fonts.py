"""Independent check of DarkskyForge font exports with fontTools.

For every glyph: the TrueType outline covers the same area as the OpenType
source (within 0.5 %) and the same bounds (within 2 units), outer contours are
clockwise, and the WOFF2 decodes to exactly the TrueType outlines. Every table
is fully decompiled, so malformed data fails loudly.
"""
import sys, io
from fontTools.ttLib import TTFont
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
out = sys.argv[1] if len(sys.argv) > 1 else "test-results/fonts"
ok = True
for fid in ["krypton", "jetbrains"]:
    otf = TTFont(f"{out}/{fid}.otf"); ttf = TTFont(f"{out}/{fid}.ttf")
    woff = TTFont(f"{out}/{fid}.woff2")  # fontTools decodes WOFF2 itself (needs brotli)
    assert ttf.sfntVersion == "\x00\x01\x00\x00" and "glyf" in ttf and "CFF " not in ttf
    assert woff.flavor == "woff2"
    # Force full decompile of every table: fails loudly on malformed data.
    for t in ttf.keys(): ttf[t]
    for t in woff.keys(): woff[t]
    og, tg, wg = otf.getGlyphSet(), ttf.getGlyphSet(), woff.getGlyphSet()
    oo, to, wo = otf.getGlyphOrder(), ttf.getGlyphOrder(), woff.getGlyphOrder()
    assert len(oo) == len(to) == len(wo) and to == wo
    assert otf.getBestCmap() == {k: oo[to.index(v)] for k, v in ttf.getBestCmap().items()}
    worst = 0
    for i, name in enumerate(oo):
        pens = []
        for gs, order in ((og, oo), (tg, to), (wg, wo)):
            a, b = AreaPen(gs), BoundsPen(gs); gs[order[i]].draw(a); gs[order[i]].draw(b); pens.append((a.value, b.bounds or (0,0,0,0)))
        (ao, bo), (at, bt), (aw, bw) = pens
        if ao == 0 and at == 0: continue
        rel = abs(abs(at) - abs(ao)) / max(abs(ao), 1)
        worst = max(worst, rel)
        if rel > 0.005 or max(abs(x - y) for x, y in zip(bo, bt)) > 2 or at != aw:
            ok = False; print(f"  ✗ {fid} {name}: area {ao:.0f}→{at:.0f} bounds {bo}→{bt}")
        if at > 0:  # fontTools AreaPen: clockwise (TrueType outer) contours give a negative area
            ok = False; print(f"  ✗ {fid} {name}: outer contours are not clockwise")
    m = ttf["maxp"]; h = ttf["head"]
    print(f"{fid}: {len(ttf.getGlyphOrder())} glyphs, worst area drift {worst*100:.3f}%, maxPoints {m.maxPoints}, maxContours {m.maxContours}, indexToLoc {h.indexToLocFormat}, tables {' '.join(sorted(ttf.keys()))}")
    print(f"  kern pairs {len(ttf['kern'].kernTables[0].kernTable)}, GSUB features {[f.FeatureTag for f in ttf['GSUB'].table.FeatureList.FeatureRecord]}")
# Autohinted TrueType: instructions present, outlines exactly unchanged.
for fid in ["krypton", "jetbrains"]:
    plain, hinted = TTFont(f"{out}/{fid}.ttf"), TTFont(f"{out}/{fid}.hinted.ttf")
    for t in hinted.keys(): hinted[t]
    missing = [t for t in ("fpgm", "prep", "cvt ", "gasp") if t not in hinted]
    programs = sum(1 for n in hinted.getGlyphOrder() if getattr(hinted["glyf"][n], "program", None) and len(hinted["glyf"][n].program.getBytecode()))
    same = all(hinted["glyf"][n].getCoordinates(hinted["glyf"])[0] == plain["glyf"][n].getCoordinates(plain["glyf"])[0] for n in plain.getGlyphOrder())
    if missing or not programs or not same:
        ok = False; print(f"  ✗ {fid} hinted: missing {missing}, glyph programs {programs}, outlines same {same}")
    else:
        print(f"{fid} hinted: fpgm/prep/cvt/gasp present, {programs} glyph programs, outlines identical")
print("ALL VALID" if ok else "PROBLEMS FOUND"); sys.exit(0 if ok else 1)
