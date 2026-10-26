# Builds the static Archivo files in apps/mobile/assets/fonts from the variable font.
# React Native cannot set variation axes, so each style of design/DESIGN.md §2 gets its own file.
# Usage: python tools/fonts/make-instances.py "Archivo[wdth,wght].ttf" apps/mobile/assets/fonts
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
src, out = sys.argv[1], sys.argv[2]
# Name -> (width %, weight). Matches design/DESIGN.md §2 type scale.
STYLES = {
  "Archivo-Numeral": (62, 900),
  "Archivo-Title": (76, 800),
  "Archivo-Heading": (82, 750),
  "Archivo-Body": (100, 400),
  "Archivo-Medium": (100, 500),
  "Archivo-Semibold": (100, 600),
  "Archivo-Tag": (100, 650),
  "Archivo-Bold": (100, 700),
}
for name, (wdth, wght) in STYLES.items():
    f = TTFont(src)
    inst = instantiateVariableFont(f, {"wdth": wdth, "wght": wght}, updateFontNames=False)
    for rec in inst["name"].names:
        if rec.nameID in (1, 4, 16):
            rec.string = name.replace("-", " ")
        elif rec.nameID == 6:
            rec.string = name
        elif rec.nameID in (2, 17):
            rec.string = "Regular"
    inst.save(f"{out}/{name}.ttf")
    print(name, wdth, wght)
