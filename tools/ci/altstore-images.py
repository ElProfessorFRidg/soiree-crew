# The pictures of the AltStore source (docs/ALTSTORE.md), drawn from each version's own screenshots:
# a card per version (screens/<version>/banner.png, the 5:3 cards Feather, KSign and AltStore show at
# the top of the source) and the source's header (header.png). Needs Pillow.
#
#   python3 tools/ci/altstore-images.py <altstore branch folder>
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Same order as SHOWCASE in altstore-source.mjs: the screens that show the app best come first.
SHOWCASE = ["party", "add-drink", "curve", "games", "my-stats", "history", "leaderboard", "bars", "me", "limits"]
INK = (20, 16, 13)
DEEP = (10, 8, 7)
AMBER = (244, 179, 61)
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
]


def font(size):
    for path in FONTS:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def screen_name(file):
    return re.sub(r"^\d+-", "", file[:-4])


def showcase(folder):
    files = [f for f in os.listdir(folder) if f.endswith(".png") and f != "banner.png"]
    by_name = {screen_name(f): f for f in files}
    return [os.path.join(folder, by_name[n]) for n in SHOWCASE if n in by_name]


def backdrop(width, height):
    """Night background: a dark vertical gradient with a warm glow behind the phones."""
    image = Image.new("RGB", (width, height), DEEP)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / height
        draw.line([(0, y), (width, y)], fill=tuple(round(INK[i] * (1 - t) + DEEP[i] * t) for i in range(3)))
    glow = Image.new("L", (width, height), 0)
    ImageDraw.Draw(glow).ellipse([width * 0.18, height * 0.05, width * 0.82, height * 0.95], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(height / 5))
    image.paste(Image.new("RGB", (width, height), AMBER), (0, 0), glow)
    return image


def phone(path, height):
    """A screenshot as a phone screen: rounded corners and a thin rim."""
    shot = Image.open(path).convert("RGB")
    width = round(shot.width * height / shot.height)
    shot = shot.resize((width, height), Image.LANCZOS)
    radius = round(width * 0.12)
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width - 1, height - 1], radius, fill=255)
    rim = 6
    framed = Image.new("RGBA", (width + rim * 2, height + rim * 2), (0, 0, 0, 0))
    ImageDraw.Draw(framed).rounded_rectangle([0, 0, framed.width - 1, framed.height - 1], radius + rim, fill=(58, 50, 44, 255))
    framed.paste(shot, (rim, rim), mask)
    return framed


def place(canvas, item, center_x, top, angle=0):
    if angle:
        item = item.rotate(angle, resample=Image.BICUBIC, expand=True)
    shadow = Image.new("RGBA", item.size, (0, 0, 0, 0))
    shadow.putalpha(item.getchannel("A").point(lambda a: a * 0.55))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    x = round(center_x - item.width / 2)
    canvas.paste(shadow, (x + 10, top + 24), shadow)
    canvas.paste(item, (x, top), item)


def pill(canvas, text, x, y, size):
    draw = ImageDraw.Draw(canvas)
    face = font(size)
    box = draw.textbbox((0, 0), text, font=face)
    pad_x, pad_y = round(size * 0.6), round(size * 0.35)
    width, height = box[2] - box[0] + pad_x * 2, box[3] - box[1] + pad_y * 2
    draw.rounded_rectangle([x, y, x + width, y + height], height // 2, fill=AMBER)
    draw.text((x + pad_x - box[0], y + pad_y - box[1]), text, font=face, fill=DEEP)


def banner(shots, version, out):
    """5:3 card. Feather and KSign lay the title over its bottom: the phones sit high, the pill top right."""
    width, height = 1500, 900
    canvas = backdrop(width, height).convert("RGBA")
    picks = (shots + shots[:1] * 3)[:3]
    side, front = round(height * 0.86), round(height * 0.98)
    place(canvas, phone(picks[1], side), width * 0.27, round(height * 0.12), 9)
    place(canvas, phone(picks[2], side), width * 0.73, round(height * 0.12), -9)
    place(canvas, phone(picks[0], front), width * 0.5, round(height * 0.06))
    pill(canvas, version, width - 300, 46, 54)
    canvas.convert("RGB").save(out, optimize=True)


def header(shots, icon, out):
    """Wide header: the icon and name on the left, a fan of phones on the right."""
    width, height = 1800, 600
    canvas = backdrop(width, height).convert("RGBA")
    picks = (shots * 5)[:5]
    angles = [10, 5, 0, -5, -10]
    for i, (path, angle) in enumerate(zip(picks, angles)):
        place(canvas, phone(path, round(height * 0.92)), width * (0.5 + i * 0.095), round(height * 0.1) + abs(i - 2) * 22, angle)
    if os.path.exists(icon):
        mark = Image.open(icon).convert("RGBA").resize((168, 168), Image.LANCZOS)
        mask = Image.new("L", mark.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, 167, 167], 38, fill=255)
        canvas.paste(mark, (90, 150), mask)
    draw = ImageDraw.Draw(canvas)
    draw.text((90, 350), "Soirée Crew", font=font(84), fill=(250, 244, 236))
    draw.text((94, 456), "Ta soirée, ton crew, ton taux.", font=font(38), fill=AMBER)
    canvas.convert("RGB").save(out, optimize=True)


def version_key(name):
    return [int(p) for p in name.split(".")] if re.fullmatch(r"\d+\.\d+\.\d+", name) else None


def main(root):
    screens = os.path.join(root, "screens")
    versions = sorted((d for d in os.listdir(screens) if version_key(d) and os.path.isdir(os.path.join(screens, d))), key=version_key) if os.path.isdir(screens) else []
    latest = None
    for version in versions:
        shots = showcase(os.path.join(screens, version))
        if not shots:
            continue
        latest = shots
        out = os.path.join(screens, version, "banner.png")
        if not os.path.exists(out) or os.path.getmtime(out) < max(os.path.getmtime(s) for s in shots):
            banner(shots, version, out)
            print(f"card for {version}")
    if latest:
        header(latest, os.path.join(root, "icon.png"), os.path.join(root, "header.png"))
        print("header")


if __name__ == "__main__":
    main(sys.argv[1])
