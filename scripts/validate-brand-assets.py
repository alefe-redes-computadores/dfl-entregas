#!/usr/bin/env python3

from __future__ import annotations

import struct
from pathlib import Path

PNG = b"\x89PNG\r\n\x1a\n"


def png_size(path: Path):
    data = path.read_bytes()

    if not data.startswith(PNG):
        raise SystemExit(
            f"{path}: PNG inválido"
        )

    if data[12:16] != b"IHDR":
        raise SystemExit(
            f"{path}: IHDR ausente"
        )

    width, height = struct.unpack(
        ">II",
        data[16:24],
    )

    return width, height


expected = {
    Path("public/icon-192.png"): (192, 192),
    Path("public/icon-512.png"): (512, 512),
    Path("public/icon-maskable-192.png"): (192, 192),
    Path("public/icon-maskable-512.png"): (512, 512),
    Path("public/apple-touch-icon.png"): (180, 180),
    Path("public/favicon-64.png"): (64, 64),
    Path("public/brand/dfl-entregas.png"): (512, 512),
}

for path, target in expected.items():
    if not path.is_file():
        raise SystemExit(
            f"ASSET AUSENTE: {path}"
        )

    actual = png_size(path)

    if actual != target:
        raise SystemExit(
            f"{path}: {actual} != {target}"
        )

    print(
        f"OK: {path} {actual[0]}x{actual[1]}"
    )

favicon = Path("public/favicon.ico")

if not favicon.is_file():
    raise SystemExit(
        "favicon.ico ausente"
    )

if favicon.stat().st_size < 100:
    raise SystemExit(
        "favicon.ico inválido"
    )

print("OK: public/favicon.ico")
