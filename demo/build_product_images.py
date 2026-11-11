"""Render flat packshot PNGs for the quiz demo catalog (fictional supplement brand DAYLINE).

4 goals x 3 formats = 12 products. The goal sets the color and icon (energy = amber + bolt,
sleep = indigo + moon, gut = green + leaf, calm = lavender + waves); the format sets the pack
shape (drink mix tub, capsule bottle, gummy pouch). Transparent background, like real packshots.
Run: python3 demo/build_product_images.py  ->  demo/product-images/*.png
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).parent / "product-images"
SIZE = 1200
SS = 2  # supersample for smooth edges
BRAND = "DAYLINE"
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)

FONT_DIRS = [Path.home() / "Library/Fonts", Path("/Library/Fonts"), Path("/System/Library/Fonts/Supplemental")]
FONTS = {"black": ["Gilroy-Black.ttf", "Arial Black.ttf"], "bold": ["Gilroy-ExtraBold.ttf", "Arial Bold.ttf"]}


def font(kind, size):
    for name in FONTS[kind]:
        for d in FONT_DIRS:
            if (d / name).exists():
                return ImageFont.truetype(str(d / name), size * SS)
    return ImageFont.load_default()


def hexrgb(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def S(*v):
    return [x * SS for x in v]


def text_center(draw, cx, y, text, kind, size, fill, max_w):
    """Draw text centered at cx, shrinking to fit max_w. Returns bottom y."""
    while size > 10:
        f = font(kind, size)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_w * SS:
            break
        size -= 2
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((cx * SS - w / 2 - box[0], y * SS - box[1]), text, font=f, fill=fill)
    return y + h / SS


def shading(w, h, base, edge_dark=0.28, highlight=0.35, hl_pos=0.28):
    """Horizontal cylinder shading as an RGBA strip (w x h)."""
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    for x in range(w):
        t = x / max(1, w - 1)
        edge = abs(t - 0.5) * 2
        c = mix(base, BLACK, edge_dark * edge**3)
        hl = max(0, 1 - abs(t - hl_pos) / 0.09)
        c = mix(c, WHITE, highlight * hl)
        d.line([(x, 0), (x, h)], fill=c)
    return img


def paste_shaded(img, x, y, w, h, color, radius, **shade):
    body = shading(w * SS, h * SS, color, **shade)
    mask = Image.new("L", body.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w * SS, h * SS], radius=radius * SS, fill=255)
    img.paste(body, (int(x * SS), int(y * SS)), mask)


def shadow(canvas, cx, cy, rx, ry, alpha=70):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(S(cx - rx, cy - ry, cx + rx, cy + ry), fill=(30, 10, 60, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(18 * SS))
    canvas.alpha_composite(layer)


# ---------- goal icons ----------
def bolt(d, cx, cy, r, fill, bg):
    pts = [(0.25, -1.0), (-0.55, 0.15), (-0.02, 0.15), (-0.25, 1.0), (0.55, -0.2), (0.02, -0.2), (0.4, -1.0)]
    d.polygon([(cx * SS + x * r * SS, cy * SS + y * r * SS) for x, y in pts], fill=fill)


def moon(d, cx, cy, r, fill, bg):
    d.ellipse(S(cx - r, cy - r, cx + r, cy + r), fill=fill)
    ox, oy, r2 = cx + r * 0.42, cy - r * 0.32, r * 0.86
    d.ellipse(S(ox - r2, oy - r2, ox + r2, oy + r2), fill=bg)
    # two 4-point sparkles in the open side of the crescent
    for sx, sy, sr in [(cx + r * 0.42, cy - r * 0.38, r * 0.28), (cx + r * 0.88, cy + r * 0.12, r * 0.18)]:
        k = 0.22
        pts = [(0, -1), (k, -k), (1, 0), (k, k), (0, 1), (-k, k), (-1, 0), (-k, -k)]
        d.polygon([((sx + x * sr) * SS, (sy + y * sr) * SS) for x, y in pts], fill=fill)


def leaf(d, cx, cy, r, fill, bg):
    ang = math.radians(-35)
    ca, sa = math.cos(ang), math.sin(ang)
    upper, lower = [], []
    for i in range(41):
        t = i / 40
        along, half = (2 * t - 1) * r, math.sin(math.pi * t) ** 0.9 * r * 0.45
        upper.append((along, -half))
        lower.append((along, half))
    pts = upper + lower[::-1]
    rot = lambda x, y: ((cx + x * ca - y * sa) * SS, (cy + x * sa + y * ca) * SS)
    d.polygon([rot(x, y) for x, y in pts], fill=fill)
    d.line([rot(-r * 0.85, 0), rot(r * 0.85, 0)], fill=bg, width=int(r * 0.08 * SS))


def waves(d, cx, cy, r, fill, bg):
    for k in (-1, 0, 1):
        y0 = cy + k * r * 0.5
        pts = [((cx - r + 2 * r * i / 60) * SS, (y0 + math.sin(i / 60 * math.pi * 2.5) * r * 0.16) * SS) for i in range(61)]
        d.line(pts, fill=fill, width=int(r * 0.16 * SS), joint="curve")


# ---------- pack shapes ----------
def tub(p):
    """Drink mix: wide canister with a ridged lid."""
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    cx, w, top, bottom = 600, 580, 330, 1050
    shadow(img, cx, bottom + 6, 330, 34)
    col, acc, ink = hexrgb(p["color"]), hexrgb(p["accent"]), hexrgb(p["ink"])
    paste_shaded(img, cx - w / 2, top, w, bottom - top, col, 36, edge_dark=0.32, highlight=0.3, hl_pos=0.24)
    # lid
    lw, lt, lb = w + 24, top - 120, top + 14
    paste_shaded(img, cx - lw / 2, lt, lw, lb - lt, hexrgb(p["lid"]), 22, edge_dark=0.3, highlight=0.45, hl_pos=0.24)
    d = ImageDraw.Draw(img)
    ridge = mix(hexrgb(p["lid"]), BLACK, 0.12)
    for i in range(1, 32):
        x = cx - lw / 2 + i * lw / 32
        d.line(S(x, lt + 14, x, lb - 14), fill=ridge, width=3 * SS)
    # wrap label
    lt2, lb2 = top + 70, bottom - 70
    d.rectangle(S(cx - w / 2 + 2, lt2, cx + w / 2 - 2, lb2), fill=acc)
    d.rectangle(S(cx - w / 2 + 2, lt2, cx + w / 2 - 2, lt2 + 16), fill=col)
    text_center(d, cx, lt2 + 46, BRAND, "black", 40, ink, w - 140)
    p["icon"](d, cx, lt2 + 175, 62, col, acc)
    y = text_center(d, cx, lt2 + 270, p["line1"], "black", 104, ink, w - 110)
    text_center(d, cx, y + 22, p["kind"], "bold", 40, col if p.get("kind_on_color") else ink, w - 140)
    text_center(d, cx, lb2 - 66, p["small"], "bold", 26, mix(ink, WHITE, 0.25), w - 140)
    return img


def bottle(p):
    """Capsules: supplement bottle with a ridged cap and a wrap label."""
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    cx, w, top, bottom = 600, 450, 330, 1060
    shadow(img, cx, bottom + 6, 270, 32)
    col, acc, ink = hexrgb(p["color"]), hexrgb(p["accent"]), hexrgb(p["ink"])
    # neck, then cap
    paste_shaded(img, cx - 125, top - 70, 250, 110, mix(col, BLACK, 0.15), 10)
    paste_shaded(img, cx - 150, top - 220, 300, 160, hexrgb(p["lid"]), 18, edge_dark=0.3, highlight=0.45, hl_pos=0.24)
    d = ImageDraw.Draw(img)
    ridge = mix(hexrgb(p["lid"]), BLACK, 0.12)
    for i in range(1, 20):
        x = cx - 150 + i * 300 / 20
        d.line(S(x, top - 206, x, top - 74), fill=ridge, width=3 * SS)
    paste_shaded(img, cx - w / 2, top, w, bottom - top, col, 70, edge_dark=0.32, highlight=0.32, hl_pos=0.24)
    d = ImageDraw.Draw(img)
    lt2, lb2 = top + 120, bottom - 90
    d.rectangle(S(cx - w / 2 + 2, lt2, cx + w / 2 - 2, lb2), fill=acc)
    text_center(d, cx, lt2 + 40, BRAND, "black", 38, ink, w - 120)
    p["icon"](d, cx, lt2 + 160, 56, col, acc)
    y = text_center(d, cx, lt2 + 250, p["line1"], "black", 96, ink, w - 90)
    text_center(d, cx, y + 22, p["kind"], "bold", 38, ink, w - 120)
    text_center(d, cx, lb2 - 60, p["small"], "bold", 24, mix(ink, WHITE, 0.25), w - 110)
    return img


def gummy(d, cx, cy, s, color):
    dark = mix(color, BLACK, 0.25)
    d.rounded_rectangle(S(cx - s, cy - s * 0.8, cx + s, cy + s * 0.8), radius=s * 0.7 * SS, fill=color, outline=dark, width=4 * SS)
    d.ellipse(S(cx - s * 0.6, cy - s * 0.55, cx - s * 0.1, cy - s * 0.2), fill=(255, 255, 255, 150))


def pouch(p):
    """Gummies: stand-up pouch with a zip line, a label and loose gummies below it."""
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    cx, w, top, bottom = 600, 620, 130, 1060
    shadow(img, cx, bottom + 4, 320, 30)
    col, acc, ink = hexrgb(p["color"]), hexrgb(p["accent"]), hexrgb(p["ink"])
    bh = bottom - top
    body = shading(w * SS, bh * SS, col, edge_dark=0.35, highlight=0.25, hl_pos=0.3)
    mask = Image.new("L", body.size, 0)
    md = ImageDraw.Draw(mask)
    # straight sealed top, sides flare slightly outward toward a rounded gusset bottom
    pts = [(30, 0), (w - 30, 0), (w - 16, 40), (w, bh - 120), (w - 30, bh), (30, bh), (0, bh - 120), (16, 40)]
    md.polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    img.paste(body, (int((cx - w / 2) * SS), top * SS), mask)
    d = ImageDraw.Draw(img)
    dark = mix(col, BLACK, 0.22)
    d.line(S(cx - w / 2 + 30, top + 90, cx + w / 2 - 30, top + 90), fill=dark, width=6 * SS)  # zip
    for sx in (cx - w / 2 + 18, cx + w / 2 - 18):  # tear notches
        d.ellipse(S(sx - 8, top + 52, sx + 8, top + 68), fill=(0, 0, 0, 0))
    text_center(d, cx, top + 130, BRAND, "black", 46, hexrgb(p["body_ink"]), w - 200)
    d.rounded_rectangle(S(cx - 240, top + 220, cx + 240, top + 610), radius=40 * SS, fill=acc)
    p["icon"](d, cx, top + 315, 54, col, acc)
    y = text_center(d, cx, top + 395, p["line1"], "black", 96, ink, 400)
    text_center(d, cx, y + 20, p["kind"], "bold", 38, ink, 400)
    g = hexrgb(p["gummy"])
    for gx, gy, s in [(cx - 170, bottom - 250, 52), (cx - 40, bottom - 215, 58), (cx + 100, bottom - 255, 50),
                      (cx + 200, bottom - 205, 46), (cx - 230, bottom - 185, 42), (cx + 30, bottom - 300, 44)]:
        gummy(d, gx, gy, s, g)
    text_center(d, cx, bottom - 120, p["small"], "bold", 26, hexrgb(p["body_ink"]), w - 200)
    return img


# ---------- catalog ----------
GOALS = {
    # goal: color (pack), accent (label), ink (text on label), body_ink (text on the pack), lid, gummy, icon, flavor
    "energy": dict(color="#FF9F1C", accent="#FFF3DC", ink="#4A2300", body_ink="#4A2300", lid="#FFFFFF", gummy="#FFB347", icon=bolt, word="ENERGY", flavor="CITRUS"),
    "sleep": dict(color="#3B3FA0", accent="#E9EAFF", ink="#1B1D5C", body_ink="#FFFFFF", lid="#1E2050", gummy="#7A4FD6", icon=moon, word="SLEEP", flavor="TART CHERRY"),
    "gut": dict(color="#22A06B", accent="#E5F7EE", ink="#0B3D2E", body_ink="#FFFFFF", lid="#FFFFFF", gummy="#F2C14E", icon=leaf, word="GUT", flavor="LEMON GINGER"),
    "calm": dict(color="#B07FE0", accent="#F5EDFF", ink="#3A1A5E", body_ink="#FFFFFF", lid="#FFFFFF", gummy="#F28DB2", icon=waves, word="CALM", flavor="MIXED BERRY"),
}
FORMATS = {
    "drink-mix": dict(shape=tub, kind="DRINK MIX", small=lambda g: f"30 SERVINGS · {g['flavor']}"),
    "capsules": dict(shape=bottle, kind="CAPSULES", small=lambda g: "60 CAPSULES · 30 DAYS"),
    "gummies": dict(shape=pouch, kind="GUMMIES", small=lambda g: "60 GUMMIES · 30 DAYS"),
}

PRODUCTS = []
for goal, g in GOALS.items():
    for fmt, f in FORMATS.items():
        PRODUCTS.append(dict(g, file=f"{goal}-{fmt}", shape=f["shape"], line1=g["word"], kind=f["kind"], small=f["small"](g)))

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for p in PRODUCTS:
        img = p["shape"](p).resize((SIZE, SIZE), Image.LANCZOS)
        img.save(OUT / f"{p['file']}.png", optimize=True)
        print("wrote", p["file"])
