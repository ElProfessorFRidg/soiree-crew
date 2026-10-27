"""App icons from the design system's glass glyph (design/icons.json "glass": M7 4h10l-1.2 16H8.2L7 4zM7.4 9h9.2)."""
import sys
from PIL import Image, ImageDraw

# Usage: python tools/dev/icons.py apps/mobile/assets/generated
OUT = sys.argv[1]
SS = 4  # supersampling for smooth edges
SIZE = 1024


def glass(draw, scale, ox, oy, stroke, line, fill, foam):
    # Glyph coordinates on a 24-unit grid.
    p = lambda x, y: (ox + x * scale, oy + y * scale)
    body = [p(7, 4), p(17, 4), p(15.8, 20), p(8.2, 20)]
    if fill:
        # Beer level from the foam line down, inside the outline.
        # Drawn under the outline, edge to edge, so no gap shows between the two.
        level = [p(7.4, 9), p(16.6, 9), p(15.8, 20), p(8.2, 20)]
        draw.polygon(level, fill=fill)
    if foam:
        top = [p(7, 4), p(17, 4), p(16.6, 9), p(7.4, 9)]
        draw.polygon(top, fill=foam)
    draw.line(body + [body[0]], fill=line, width=int(stroke), joint="curve")
    for pt in body:
        r = stroke / 2
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=line)
    a, b = p(7.4, 9), p(16.6, 9)
    draw.line([a, b], fill=line, width=int(stroke))
    for pt in (a, b):
        r = stroke / 2
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=line)


def icon(name, bg, line, fill, foam, glyph_frac=0.95, transparent=False, size=SIZE):
    big = size * SS
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0) if transparent else bg)
    draw = ImageDraw.Draw(im)
    scale = big * glyph_frac / 24
    ox = (big - 24 * scale) / 2
    # The glyph sits a little high on its grid (rows 4 to 20): centre what is drawn.
    oy = (big - 24 * scale) / 2 + 0 * scale
    glass(draw, scale, ox, oy, stroke=scale * 1.4, line=line, fill=fill, foam=foam)
    im = im.resize((size, size), Image.LANCZOS)
    if not transparent:
        im = im.convert("RGB")
    im.save(f"{OUT}/{name}.png")


SLATE = "#1E2624"
AMBER = "#F4B33D"
CREAM = "#F1EEE6"
AMBER_DEEP = "#C98A1A"

# Default: the night theme, an amber pint on slate.
icon("icon", SLATE, AMBER, AMBER_DEEP, CREAM)
# Android adaptive icon: transparent foreground (glyph within the safe zone), slate background.
icon("android-icon-foreground", SLATE, AMBER, AMBER_DEEP, CREAM, glyph_frac=0.62, transparent=True)
Image.new("RGB", (SIZE, SIZE), SLATE).save(f"{OUT}/android-icon-background.png")
icon("android-icon-monochrome", SLATE, "#FFFFFF", None, None, glyph_frac=0.62, transparent=True)
icon("splash-icon", SLATE, AMBER, AMBER_DEEP, CREAM, glyph_frac=0.7, transparent=True)
icon("favicon", SLATE, AMBER, AMBER_DEEP, CREAM, size=48)
# JOY-03 alternates, unlocked by crew titles.
icon("icon-boss", AMBER, SLATE, "#28322F", CREAM)
icon("icon-globetrotter", "#28322F", "#9BD8A8", "#5FA873", CREAM)
icon("icon-nomad", CREAM, SLATE, AMBER, "#FFFFFF")
print("ok")
