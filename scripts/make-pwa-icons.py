"""Generates the PWA / home-screen icon set in public/icons from the brand mark.

Run by hand — it is not part of `npm run build`, because its inputs change only
when the brand mark does, and the alternative (a Python step in a Node build)
would put Pillow between a developer and a deployable bundle.

    python scripts/make-pwa-icons.py        # needs Pillow

WHY THERE IS A PLATE BEHIND THE MARK AT ALL. public/quest-mall-logo.jpg is dark ink
on white, and it is drawn everywhere else inside components/Logo.tsx's white
badge for exactly that reason: on the dark theme's charcoal, or on the arbitrary
wallpaper an Android launcher puts behind an icon, the mark alone would be ink
on ink. The badge travels with it here.

THE MASKABLE ICON IS A DIFFERENT PICTURE, NOT THE SAME ONE RESIZED. Android
crops a maskable icon to whatever shape the launcher uses — circle, squircle,
teardrop — and only the centre 80% is guaranteed to survive. So that variant is
full-bleed white with the mark held inside that safe circle, while the `any`
variant keeps its own rounded corners because nothing is going to add them.
iOS rounds apple-touch-icon itself and renders transparency as black, so that
one is square, full-bleed and opaque.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "quest-mall-logo.jpg"
OUT = ROOT / "public" / "icons"
# THE PLATE IS THE SOURCE'S OWN GROUND, SAMPLED, NOT PURE WHITE. The brand JPEG
# is drawn on a warm off-white; a pure-white plate behind it therefore rendered
# the logo as a visible grey rectangle floating inside a white square. Reading
# the corner pixel makes the join seamless whatever the mark is replaced with.
def plate_colour() -> tuple:
    with Image.open(SOURCE) as probe:
        r, g, b = probe.convert("RGB").getpixel((0, 0))
    return (r, g, b, 255)

# Supersampling factor: the corner radius is drawn at 4x and scaled down, which
# is the cheapest way to get an antialiased rounded rect out of Pillow.
SS = 4


def mark(box: int) -> Image.Image:
    """The brand mark, contained in a `box`-pixel square, aspect preserved."""
    src = Image.open(SOURCE).convert("RGBA")
    scale = min(box / src.width, box / src.height)
    return src.resize((max(1, round(src.width * scale)), max(1, round(src.height * scale))), Image.LANCZOS)


def compose(size: int, mark_fraction: float, radius_fraction: float) -> Image.Image:
    canvas = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    if radius_fraction > 0:
        plate = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(plate).rounded_rectangle(
            (0, 0, canvas.size[0] - 1, canvas.size[1] - 1),
            radius=round(size * SS * radius_fraction),
            fill=PLATE,
        )
        canvas = plate
    else:
        canvas.paste(PLATE, (0, 0, canvas.size[0], canvas.size[1]))

    glyph = mark(round(size * SS * mark_fraction))
    canvas.alpha_composite(glyph, ((canvas.size[0] - glyph.width) // 2, (canvas.size[1] - glyph.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def write(image: Image.Image, name: str, opaque: bool = False) -> None:
    if opaque:
        flat = Image.new("RGB", image.size, PLATE[:3])
        flat.paste(image, mask=image.split()[3])
        image = flat
    path = OUT / name
    image.save(path, "PNG", optimize=True)
    print(f"{path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}  {path.stat().st_size // 1024} KB")


PLATE = plate_colour()
OUT.mkdir(parents=True, exist_ok=True)
write(compose(192, 0.80, 0.22), "icon-192.png")
write(compose(512, 0.80, 0.22), "icon-512.png")
# 0.66 keeps the mark inside the 80%-diameter safe circle with room to spare.
write(compose(512, 0.66, 0.0), "icon-maskable-512.png")
write(compose(180, 0.82, 0.0), "apple-touch-icon-180.png", opaque=True)
