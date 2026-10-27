"""Adds U+202F (narrow no-break space) to the app fonts, drawn like their thin space (U+2009).

French typography puts it before ? ! ; (DESIGN.md, SLOP rules), but the Archivo cuts shipped in
apps/mobile/assets/fonts lack it, so it showed as a missing-glyph box.
Usage: python tools/dev/fonts_nnbsp.py apps/mobile/assets/fonts
"""
import glob
import sys

from fontTools.ttLib import TTFont

for path in sorted(glob.glob(f"{sys.argv[1]}/*.ttf")):
    font = TTFont(path)
    best = font.getBestCmap()
    if 0x202F in best:
        print(path, "already has U+202F")
        continue
    source = best.get(0x2009) or best[0x20]
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[0x202F] = source
    font.save(path)
    print(path, "U+202F ->", source)
