#!/usr/bin/env python3

from __future__ import annotations

import binascii
import math
import struct
import sys
import zlib
from pathlib import Path

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read_chunks(data: bytes):
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("arquivo não é PNG válido")

    pos = len(PNG_SIGNATURE)

    while pos < len(data):
        if pos + 12 > len(data):
            raise ValueError("PNG truncado")

        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        payload = data[pos + 8:pos + 8 + length]

        yield kind, payload

        pos += 12 + length

        if kind == b"IEND":
            break


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)

    if pa <= pb and pa <= pc:
        return a

    if pb <= pc:
        return b

    return c


def decode_png(path: Path):
    data = path.read_bytes()

    width = height = None
    bit_depth = color_type = None
    compressed = bytearray()

    for kind, payload in read_chunks(data):
        if kind == b"IHDR":
            (
                width,
                height,
                bit_depth,
                color_type,
                compression,
                filter_method,
                interlace,
            ) = struct.unpack(">IIBBBBB", payload)

            if bit_depth != 8:
                raise ValueError(
                    f"PNG precisa usar 8 bits por canal; atual={bit_depth}"
                )

            if compression != 0 or filter_method != 0:
                raise ValueError("PNG usa método não suportado")

            if interlace != 0:
                raise ValueError(
                    "PNG entrelaçado não suportado. Exporte novamente sem interlace."
                )

        elif kind == b"IDAT":
            compressed.extend(payload)

    if width is None or height is None:
        raise ValueError("IHDR ausente")

    channels_by_type = {
        0: 1,
        2: 3,
        4: 2,
        6: 4,
    }

    if color_type not in channels_by_type:
        raise ValueError(
            f"tipo de PNG não suportado: color_type={color_type}. "
            "Exporte como PNG RGB/RGBA."
        )

    channels = channels_by_type[color_type]
    raw = zlib.decompress(bytes(compressed))

    stride = width * channels
    expected = (stride + 1) * height

    if len(raw) != expected:
        raise ValueError(
            f"tamanho PNG inesperado: {len(raw)} != {expected}"
        )

    rows = []
    prev = bytearray(stride)
    pos = 0

    for _ in range(height):
        filter_type = raw[pos]
        pos += 1

        scan = bytearray(raw[pos:pos + stride])
        pos += stride

        recon = bytearray(stride)

        for x in range(stride):
            left = recon[x - channels] if x >= channels else 0
            up = prev[x]
            up_left = prev[x - channels] if x >= channels else 0

            value = scan[x]

            if filter_type == 0:
                out = value
            elif filter_type == 1:
                out = (value + left) & 0xFF
            elif filter_type == 2:
                out = (value + up) & 0xFF
            elif filter_type == 3:
                out = (value + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                out = (value + paeth(left, up, up_left)) & 0xFF
            else:
                raise ValueError(f"filtro PNG inválido: {filter_type}")

            recon[x] = out

        rows.append(recon)
        prev = recon

    pixels = bytearray(width * height * 4)

    for y, row in enumerate(rows):
        for x in range(width):
            src = x * channels
            dst = (y * width + x) * 4

            if color_type == 6:
                r, g, b, a = row[src:src + 4]

            elif color_type == 2:
                r, g, b = row[src:src + 3]
                a = 255

            elif color_type == 0:
                g = row[src]
                r = b = g
                a = 255

            elif color_type == 4:
                g, a = row[src:src + 2]
                r = b = g

            pixels[dst:dst + 4] = bytes((r, g, b, a))

    return width, height, pixels


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(
            ">I",
            binascii.crc32(kind + payload) & 0xFFFFFFFF,
        )
    )


def write_png(
    path: Path,
    width: int,
    height: int,
    pixels: bytes,
):
    raw = bytearray()

    for y in range(height):
        raw.append(0)
        start = y * width * 4
        raw.extend(
            pixels[start:start + width * 4]
        )

    encoded = (
        PNG_SIGNATURE
        + png_chunk(
            b"IHDR",
            struct.pack(
                ">IIBBBBB",
                width,
                height,
                8,
                6,
                0,
                0,
                0,
            ),
        )
        + png_chunk(
            b"IDAT",
            zlib.compress(bytes(raw), 9),
        )
        + png_chunk(b"IEND", b"")
    )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)


def sample(
    pixels: bytes,
    width: int,
    height: int,
    x: float,
    y: float,
):
    x = max(0.0, min(width - 1.0, x))
    y = max(0.0, min(height - 1.0, y))

    x0 = int(math.floor(x))
    y0 = int(math.floor(y))

    x1 = min(width - 1, x0 + 1)
    y1 = min(height - 1, y0 + 1)

    tx = x - x0
    ty = y - y0

    result = []

    for channel in range(4):
        def p(px: int, py: int):
            return pixels[
                (py * width + px) * 4 + channel
            ]

        top = (
            p(x0, y0) * (1.0 - tx)
            + p(x1, y0) * tx
        )

        bottom = (
            p(x0, y1) * (1.0 - tx)
            + p(x1, y1) * tx
        )

        value = (
            top * (1.0 - ty)
            + bottom * ty
        )

        result.append(
            max(0, min(255, round(value)))
        )

    return tuple(result)


def resize_rgba(
    pixels: bytes,
    width: int,
    height: int,
    target_width: int,
    target_height: int,
):
    out = bytearray(
        target_width * target_height * 4
    )

    scale_x = width / target_width
    scale_y = height / target_height

    for y in range(target_height):
        sy = (
            (y + 0.5) * scale_y
            - 0.5
        )

        for x in range(target_width):
            sx = (
                (x + 0.5) * scale_x
                - 0.5
            )

            rgba = sample(
                pixels,
                width,
                height,
                sx,
                sy,
            )

            idx = (
                y * target_width + x
            ) * 4

            out[idx:idx + 4] = bytes(rgba)

    return out


def square_crop(
    pixels: bytes,
    width: int,
    height: int,
):
    size = min(width, height)

    left = (width - size) // 2
    top = (height - size) // 2

    out = bytearray(size * size * 4)

    for y in range(size):
        src_start = (
            ((top + y) * width + left)
            * 4
        )

        dst_start = y * size * 4

        out[
            dst_start:dst_start + size * 4
        ] = pixels[
            src_start:src_start + size * 4
        ]

    return size, size, out


def composite_on_background(
    pixels: bytes,
    width: int,
    height: int,
    bg=(9, 9, 11, 255),
):
    out = bytearray(width * height * 4)

    br, bgc, bb, _ = bg

    for i in range(width * height):
        idx = i * 4

        r, g, b, a = pixels[
            idx:idx + 4
        ]

        alpha = a / 255.0

        nr = round(
            r * alpha
            + br * (1.0 - alpha)
        )

        ng = round(
            g * alpha
            + bgc * (1.0 - alpha)
        )

        nb = round(
            b * alpha
            + bb * (1.0 - alpha)
        )

        out[idx:idx + 4] = bytes(
            (nr, ng, nb, 255)
        )

    return out


def make_maskable(
    pixels: bytes,
    width: int,
    height: int,
    size: int,
):
    bg = bytearray(
        bytes((9, 9, 11, 255))
        * (size * size)
    )

    # Safe-zone para máscaras agressivas do Android/PWA.
    glyph_size = round(size * 0.78)

    resized = resize_rgba(
        pixels,
        width,
        height,
        glyph_size,
        glyph_size,
    )

    left = (size - glyph_size) // 2
    top = (size - glyph_size) // 2

    for y in range(glyph_size):
        for x in range(glyph_size):
            src_idx = (
                y * glyph_size + x
            ) * 4

            dst_idx = (
                (top + y) * size
                + left + x
            ) * 4

            sr, sg, sb, sa = resized[
                src_idx:src_idx + 4
            ]

            alpha = sa / 255.0

            dr, dg, db, _ = bg[
                dst_idx:dst_idx + 4
            ]

            bg[dst_idx:dst_idx + 4] = bytes((
                round(
                    sr * alpha
                    + dr * (1.0 - alpha)
                ),
                round(
                    sg * alpha
                    + dg * (1.0 - alpha)
                ),
                round(
                    sb * alpha
                    + db * (1.0 - alpha)
                ),
                255,
            ))

    return bg


def write_ico_from_png(
    ico_path: Path,
    png_bytes: bytes,
    size: int,
):
    width_byte = (
        0 if size >= 256 else size
    )

    height_byte = width_byte

    header = struct.pack(
        "<HHH",
        0,
        1,
        1,
    )

    entry = struct.pack(
        "<BBBBHHII",
        width_byte,
        height_byte,
        0,
        0,
        1,
        32,
        len(png_bytes),
        6 + 16,
    )

    ico_path.write_bytes(
        header + entry + png_bytes
    )


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "uso: generate-brand-assets.py "
            "<master.png> <public-dir>"
        )

    source = Path(sys.argv[1])
    public = Path(sys.argv[2])

    if not source.is_file():
        raise SystemExit(
            f"master ausente: {source}"
        )

    width, height, pixels = decode_png(
        source
    )

    width, height, pixels = square_crop(
        pixels,
        width,
        height,
    )

    print(
        f"Master: {width}x{height}"
    )

    if width < 512 or height < 512:
        raise SystemExit(
            "master precisa ter pelo menos "
            "512x512 pixels"
        )

    outputs = {
        192: public / "icon-192.png",
        512: public / "icon-512.png",
        180: public / "apple-touch-icon.png",
        64: public / "favicon-64.png",
    }

    for size, target in outputs.items():
        resized = resize_rgba(
            pixels,
            width,
            height,
            size,
            size,
        )

        write_png(
            target,
            size,
            size,
            resized,
        )

        print(
            f"Gerado: {target} "
            f"({size}x{size})"
        )

    for size in (192, 512):
        target = (
            public
            / f"icon-maskable-{size}.png"
        )

        maskable = make_maskable(
            pixels,
            width,
            height,
            size,
        )

        write_png(
            target,
            size,
            size,
            maskable,
        )

        print(
            f"Gerado: {target} "
            f"({size}x{size}, maskable)"
        )

    favicon_png = (
        public / "favicon-64.png"
    ).read_bytes()

    write_ico_from_png(
        public / "favicon.ico",
        favicon_png,
        64,
    )

    print(
        f"Gerado: {public / 'favicon.ico'}"
    )

    brand_dir = public / "brand"
    brand_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    brand_512 = resize_rgba(
        pixels,
        width,
        height,
        512,
        512,
    )

    write_png(
        brand_dir
        / "dfl-entregas.png",
        512,
        512,
        brand_512,
    )

    print(
        "Gerado: "
        "public/brand/dfl-entregas.png"
    )


if __name__ == "__main__":
    main()
