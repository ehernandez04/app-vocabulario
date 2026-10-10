#!/usr/bin/env python3
"""
Genera los iconos de la PWA: un post-it amarillo con la esquina doblada.

Escribe PNG a mano (zlib + struct) para no depender de Pillow ni de ningún
convertidor de SVG. Se corre con `npm run icons` y solo hace falta repetirlo
si cambia el motivo del icono.
"""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

PAPER = (243, 239, 230)   # el fondo de la app
NOTE = (255, 224, 102)    # amarillo post-it
INK = (28, 27, 25)
FOLD = (214, 186, 80)     # la esquina doblada, un amarillo más oscuro


def png(path, width, height, pixel):
    """pixel(x, y) -> (r, g, b). Escribe un PNG RGB sin compresión con pérdida."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)                      # filtro 0 (None) por fila
        for x in range(width):
            raw.extend(pixel(x, y))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    blob = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)
    print(f"  {path.name}  {width}x{height}  {len(blob) / 1024:.1f} KB")


def note_icon(size, margin_ratio, background):
    """Un post-it cuadrado centrado, con la esquina inferior derecha doblada."""
    m = int(size * margin_ratio)
    lo, hi = m, size - m
    side = hi - lo
    fold = int(side * 0.28)
    # Dos franjas de "escritura" en tinta, como una nota con dos renglones.
    line_h = max(2, int(side * 0.055))
    l1 = lo + int(side * 0.34)
    l2 = lo + int(side * 0.54)
    lx0, lx1 = lo + int(side * 0.18), lo + int(side * 0.70)
    lx2 = lo + int(side * 0.52)

    def pixel(x, y):
        if not (lo <= x < hi and lo <= y < hi):
            return background
        # esquina doblada: por debajo de la diagonal del triángulo inferior derecho
        dx, dy = hi - x, hi - y
        if dx + dy < fold:
            return background
        if dx + dy < fold * 1.5 and dx + dy >= fold:
            return FOLD
        if l1 <= y < l1 + line_h and lx0 <= x < lx1:
            return INK
        if l2 <= y < l2 + line_h and lx0 <= x < lx2:
            return INK
        return NOTE

    return pixel


if __name__ == "__main__":
    print("Generando iconos en public/icons/")
    # Normales: el post-it ocupa casi todo el lienzo.
    png(OUT / "icon-192.png", 192, 192, note_icon(192, 0.06, PAPER))
    png(OUT / "icon-512.png", 512, 512, note_icon(512, 0.06, PAPER))
    png(OUT / "apple-touch-icon.png", 180, 180, note_icon(180, 0.06, PAPER))
    # Maskable: Android recorta hasta un 20 % por lado, así que el motivo va más
    # pequeño y el papel llega hasta el borde.
    png(OUT / "icon-maskable-512.png", 512, 512, note_icon(512, 0.22, PAPER))
    print("Listo.")
