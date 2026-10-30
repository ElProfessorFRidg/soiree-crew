"""App icons: two pints meeting in a cheers, in the design system's colours (design/tokens.json).

Usage: python tools/dev/icons.py apps/mobile/assets [seasons]
Writes icon.png, the Android adaptive layers, splash-icon.png, favicon.png and the JOY-03 alternates;
with "seasons", only the four seasonal alternates.
"""
import math
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
SIZE = 1024
SS = 3  # supersampling for smooth edges

SLATE = (30, 38, 36)
SLATE_LIGHT = (44, 55, 52)
AMBER = (244, 179, 61)
AMBER_DEEP = (201, 138, 26)
AMBER_DARK = (160, 104, 14)
CREAM = (241, 238, 230)
GREEN = (155, 216, 168)
GREEN_DEEP = (95, 168, 115)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def pint(w, h, line, beer_top, beer_bottom, foam, stroke):
    """One pint on its own transparent layer: tapered body, beer gradient, foam head, bubbles, shine."""
    pad = int(stroke * 2)
    layer = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top_w, bottom_w = w, w * 0.74
    cx = pad + w / 2
    y0, y1 = pad + h * 0.12, pad + h
    body = [(cx - top_w / 2, y0), (cx + top_w / 2, y0), (cx + bottom_w / 2, y1), (cx - bottom_w / 2, y1)]

    # Beer: vertical gradient, clipped to the glass.
    beer = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beer)
    foam_line = y0 + h * 0.2
    for y in range(int(foam_line), int(y1) + 1):
        t = (y - foam_line) / max(1, y1 - foam_line)
        bd.line([(0, y), (layer.size[0], y)], fill=lerp(beer_top, beer_bottom, t) + (255,))
    mask = Image.new("L", layer.size, 0)
    ImageDraw.Draw(mask).polygon(body, fill=255)
    layer.paste(beer, (0, 0), Image.composite(mask, Image.new("L", layer.size, 0), mask))

    # Bubbles rising on one side.
    for i, (fx, fy, r) in enumerate([(0.62, 0.78, 0.035), (0.68, 0.62, 0.025), (0.58, 0.5, 0.02), (0.7, 0.42, 0.016)]):
        bx, by, br = pad + w * fx, pad + h * fy, w * r
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=lerp(beer_top, CREAM, 0.55) + (200,))

    # Foam head: a band with three soft bumps above the rim.
    if foam:
        d.polygon([(cx - top_w / 2, y0), (cx + top_w / 2, y0), (cx + top_w / 2 - w * 0.01, foam_line), (cx - top_w / 2 + w * 0.01, foam_line)], fill=foam + (255,))
        for fx, r in [(0.22, 0.2), (0.5, 0.24), (0.78, 0.19)]:
            bx, r = pad + w * fx, w * r
            d.ellipse([bx - r, y0 - r * 0.85, bx + r, y0 + r * 0.85], fill=foam + (255,))

    # Outline with round joins.
    d.line(body + [body[0]], fill=line + (255,), width=int(stroke), joint="curve")
    for x, y in body:
        d.ellipse([x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2], fill=line + (255,))

    # Shine down the left wall.
    shine = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sx = cx - top_w / 2 + stroke * 1.6
    sd.line([(sx, foam_line + h * 0.08), (sx + (top_w - bottom_w) * 0.18, y1 - h * 0.14)], fill=(255, 255, 255, 70), width=int(stroke * 0.9))
    layer = Image.alpha_composite(layer, shine)
    return layer


def sparkle(d, cx, cy, r, colour):
    """Four-point star where the glasses meet, with two short rays."""
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=colour + (255,))
    for a, length in [(-math.pi * 0.82, 0.9), (-math.pi * 0.18, 0.9)]:
        x0, y0 = cx + r * 1.25 * math.cos(a), cy + r * 1.25 * math.sin(a)
        x1, y1 = cx + r * (1.25 + length) * math.cos(a), cy + r * (1.25 + length) * math.sin(a)
        d.line([(x0, y0), (x1, y1)], fill=colour + (255,), width=int(r * 0.22))


def cheers(size, glyph, line, beer_top, beer_bottom, foam, spark):
    """The two pints, tilted towards each other, rims touching, on a transparent canvas."""
    big = size * SS
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    w, h = big * glyph * 0.36, big * glyph * 0.62
    stroke = big * glyph * 0.034
    one = pint(int(w), int(h), line, beer_top, beer_bottom, foam, stroke)
    # PIL turns counter-clockwise: the left glass leans right and the right one left, rims meeting.
    for angle, dx in [(-13, -1), (13, 1)]:
        g = one.rotate(angle, resample=Image.BICUBIC, expand=True)
        x = big / 2 + dx * w * 0.6 - g.size[0] / 2
        y = big / 2 - g.size[1] / 2 + big * glyph * 0.06
        canvas.alpha_composite(g, (int(x), int(y)))
    if spark:
        sparkle(ImageDraw.Draw(canvas), big / 2, big / 2 - h * 0.56, big * glyph * 0.065, spark)
    return canvas


def background(size, inner, outer):
    """Slate with a soft light from above, so the glasses sit on something."""
    big = size * SS
    big = int(big)
    bg = Image.new("RGB", (big, big), outer)
    glow = Image.new("L", (big, big), 0)
    ImageDraw.Draw(glow).ellipse([big * 0.1, -big * 0.05, big * 0.9, big * 0.75], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(big * 0.12))
    bg.paste(Image.new("RGB", (big, big), inner), (0, 0), glow)
    return bg.convert("RGBA")


def save(img, name, size, rgb=True):
    img = img.resize((size, size), Image.LANCZOS)
    (img.convert("RGB") if rgb else img).save(f"{OUT}/{name}.png")


def full_icon(name, inner, outer, line, beer_top, beer_bottom, foam, spark, glyph=0.86, size=SIZE):
    img = background(size, inner, outer)
    img.alpha_composite(cheers(size, glyph, line, beer_top, beer_bottom, foam, spark))
    save(img, name, size)


def seasons():
    """JOY-03 seasonal alternates, unlocked by a night out together in that season (checked by the server)."""
    full_icon("icons/icon-winter", (214, 228, 236), (168, 194, 212), line=SLATE, beer_top=AMBER, beer_bottom=AMBER_DEEP, foam=(255, 255, 255), spark=(255, 255, 255))
    full_icon("icons/icon-spring", (200, 228, 192), (148, 198, 150), line=SLATE, beer_top=AMBER, beer_bottom=AMBER_DEEP, foam=CREAM, spark=(232, 120, 150))
    full_icon("icons/icon-summer", (250, 156, 112), (222, 98, 78), line=SLATE, beer_top=AMBER, beer_bottom=AMBER_DEEP, foam=CREAM, spark=CREAM)
    full_icon("icons/icon-autumn", (172, 94, 46), (116, 58, 30), line=AMBER, beer_top=AMBER, beer_bottom=AMBER_DARK, foam=CREAM, spark=AMBER)


if len(sys.argv) > 2 and sys.argv[2] == "seasons":
    # Only the seasonal set, so the other icons stay byte for byte as they are.
    seasons()
    print("ok")
    sys.exit(0)

night = dict(line=AMBER, beer_top=AMBER, beer_bottom=AMBER_DARK, foam=CREAM, spark=CREAM)
full_icon("icon", SLATE_LIGHT, SLATE, **night)
full_icon("favicon", SLATE_LIGHT, SLATE, size=48, **night)

# Android adaptive icon: glyph inside the 66 % safe zone on a transparent layer, slate behind.
save(cheers(SIZE, 0.6, **night), "android-icon-foreground", SIZE, rgb=False)
save(background(SIZE, SLATE_LIGHT, SLATE), "android-icon-background", SIZE)
white = (255, 255, 255)
save(cheers(SIZE, 0.6, line=white, beer_top=white, beer_bottom=white, foam=None, spark=white), "android-icon-monochrome", SIZE, rgb=False)
save(cheers(SIZE, 0.66, **night), "splash-icon", SIZE, rgb=False)

# JOY-03 alternates, unlocked by crew titles.
full_icon("icons/icon-boss", AMBER, AMBER_DEEP, line=SLATE, beer_top=(70, 58, 30), beer_bottom=SLATE, foam=CREAM, spark=SLATE)
full_icon("icons/icon-globetrotter", (52, 66, 62), (34, 44, 41), line=GREEN, beer_top=GREEN, beer_bottom=GREEN_DEEP, foam=CREAM, spark=CREAM)
full_icon("icons/icon-nomad", CREAM, (224, 219, 206), line=SLATE, beer_top=AMBER, beer_bottom=AMBER_DEEP, foam=(255, 255, 255), spark=AMBER_DEEP)
seasons()
print("ok")
