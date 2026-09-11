#!/usr/bin/env python3
from __future__ import annotations

import colorsys
import sys
from pathlib import Path
from PIL import Image, ImageFilter

if len(sys.argv) != 4:
    raise SystemExit(
        "uso: generate-notification-icon.py <source.png> <res-dir> <resource-name>"
    )

source = Path(sys.argv[1])
res_dir = Path(sys.argv[2])
resource_name = sys.argv[3]

if not source.is_file():
    raise SystemExit(f"fonte ausente: {source}")

image = Image.open(source).convert("RGBA")
mask = Image.new("L", image.size, 0)
source_pixels = image.load()
mask_pixels = mask.load()

for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = source_pixels[x, y]
        if a < 20:
            continue

        rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
        _, saturation, value = colorsys.rgb_to_hsv(rf, gf, bf)

        # O ícone do DFL tem fundo grafite e pictograma verde/laranja.
        # Selecionamos apenas as partes cromáticas e claras do pictograma,
        # descartando o quadrado de fundo e sua borda.
        foreground = saturation >= 0.34 and value >= 0.36
        if foreground:
            mask_pixels[x, y] = min(255, max(0, int(a)))

# Fecha pequenos buracos e dá consistência ao desenho em 24dp.
mask = mask.filter(ImageFilter.MaxFilter(5))
bbox = mask.getbbox()
if not bbox:
    raise SystemExit("não foi possível extrair o pictograma do ícone")

cropped = mask.crop(bbox)

densities = {
    "drawable-mdpi": 24,
    "drawable-hdpi": 36,
    "drawable-xhdpi": 48,
    "drawable-xxhdpi": 72,
    "drawable-xxxhdpi": 96,
}

for folder, canvas_size in densities.items():
    target_dir = res_dir / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    # Android recomenda um glifo com respiro dentro dos 24dp.
    glyph_size = max(1, round(canvas_size * 0.72))
    ratio = min(
        glyph_size / cropped.width,
        glyph_size / cropped.height,
    )
    width = max(1, round(cropped.width * ratio))
    height = max(1, round(cropped.height * ratio))

    glyph = cropped.resize((width, height), Image.Resampling.LANCZOS)
    alpha = Image.new("L", (canvas_size, canvas_size), 0)
    left = (canvas_size - width) // 2
    top = (canvas_size - height) // 2
    alpha.paste(glyph, (left, top))

    output = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    output.putalpha(alpha)
    output.save(target_dir / f"{resource_name}.png", optimize=True)

print(
    "Ícone de notificação gerado:",
    ", ".join(
        str(res_dir / folder / f"{resource_name}.png")
        for folder in densities
    ),
)
