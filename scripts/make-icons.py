"""Tegner app-ikonerne (to røde terninger på sort) i icons/. Kræver Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "icons"
PIPS = {5: [(0, 0), (2, 0), (1, 1), (0, 2), (2, 2)], 6: [(0, 0), (2, 0), (0, 1), (2, 1), (0, 2), (2, 2)]}


def die(size, n, angle):
    s = size
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(s * 0.2)
    d.rounded_rectangle([0, 0, s - 1, s - 1], r, fill=(150, 10, 16))
    d.rounded_rectangle([int(s * .03), int(s * .03), s - 1 - int(s * .05), s - 1 - int(s * .06)], r, fill=(214, 22, 30))
    hl = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([int(s * .05), int(s * .02), int(s * .6), int(s * .45)], fill=(255, 255, 255, 50))
    im = Image.alpha_composite(im, hl.filter(ImageFilter.GaussianBlur(s * .08)))
    d = ImageDraw.Draw(im)
    pr = s * 0.085
    for cx, cy in PIPS[n]:
        x = s * (0.25 + cx * 0.25)
        y = s * (0.25 + cy * 0.25)
        d.ellipse([x - pr, y - pr + s * .01, x + pr, y + pr + s * .01], fill=(90, 0, 0))
        d.ellipse([x - pr, y - pr, x + pr, y + pr], fill=(250, 250, 246))
    return im.rotate(angle, resample=Image.BICUBIC, expand=True)


def icon(size, pad=0.0):
    W = 1024
    bg = Image.new("RGBA", (W, W), (12, 12, 14, 255))
    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([150, 200, 874, 824], fill=(255, 255, 255, 18))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(120)))
    ds = int(W * 0.34 * (1 - pad))
    for n, ang, cx, cy in [(5, 14, 0.29, 0.42), (6, -11, 0.71, 0.60)]:
        dimg = die(ds, n, ang)
        sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        x = int(W * cx - dimg.width / 2)
        y = int(W * cy - dimg.height / 2)
        sh.paste((0, 0, 0, 170), (x + 18, y + 30, x + 18 + dimg.width, y + 30 + dimg.height), dimg)
        bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(26)))
        bg.alpha_composite(dimg, (x, y))
    return bg.convert("RGB").resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
icon(512).save(OUT / "icon-512.png")
icon(192).save(OUT / "icon-192.png")
icon(180).save(OUT / "apple-touch-icon.png")
icon(32).save(OUT / "favicon-32.png")
icon(512, pad=0.22).save(OUT / "maskable-512.png")
print("ikoner skrevet til", OUT)
