#!/usr/bin/env python3
"""
Genera los iconos de la PWA: la escalera de «Paso a Paso»: escalones que suben, con el último en lima,
sobre un degradado violeta a rosa (identidad Aurora, #97).

Escribe PNG a mano (zlib + struct) para no depender de Pillow ni de ningún
convertidor de SVG. Se corre con `npm run icons` y solo hace falta repetirlo
si cambia el motivo del icono. El borde del trazo se suaviza con
supermuestreo, también sin dependencias.
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

# El motivo, en un lienzo de 100 x 100 (el mismo del mockup aprobado).
GRAD = [(0.0, (109, 75, 255)), (0.55, (179, 69, 245)), (1.0, (255, 111, 177))]
LIME = (182, 255, 92)
STAIRS = [(22, 74), (40, 74), (40, 58), (58, 58), (58, 42), (78, 42), (78, 26)]
LAST = STAIRS[-3:]   # el último escalón, el que se enciende
HALF = 4.5           # medio grosor del trazo
DOT = (78, 26, 6)    # x, y, radio


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


def dist_seg(px, py, a, b):
    """Distancia del punto al segmento a-b."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dist_poly(px, py, pts):
    return min(dist_seg(px, py, pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def degradado(t):
    for (t0, c0), (t1, c1) in zip(GRAD, GRAD[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            return tuple(c0[i] + (c1[i] - c0[i]) * k for i in range(3))
    return GRAD[-1][1]


def mezcla(base, color, a):
    return tuple(base[i] + (color[i] - base[i]) * a for i in range(3))


def stairs_icon(size, scale):
    """El lienzo lleno de degradado y la escalera centrada, a `scale` de su tamaño."""
    u = 100 / size     # unidades del lienzo por pixel
    ss = 2             # supermuestreo ss x ss por pixel

    def muestra(px, py):
        # Se deshace el escalado alrededor del centro para quedarse en coordenadas del motivo.
        mx = (px - 50) / scale + 50
        my = (py - 50) / scale + 50
        c = degradado((px + py) / 200)
        if dist_poly(mx, my, STAIRS) <= HALF:
            c = mezcla(c, (255, 255, 255), 0.35)
        if dist_poly(mx, my, LAST) <= HALF or math.hypot(mx - DOT[0], my - DOT[1]) <= DOT[2]:
            c = LIME
        return c

    def pixel(x, y):
        acc = [0.0, 0.0, 0.0]
        for j in range(ss):
            for i in range(ss):
                c = muestra((x + (i + 0.5) / ss) * u, (y + (j + 0.5) / ss) * u)
                for k in range(3):
                    acc[k] += c[k]
        n = ss * ss
        return tuple(int(round(v / n)) for v in acc)

    return pixel


if __name__ == "__main__":
    print("Generando iconos en public/icons/")
    # Normales: la escalera ocupa buena parte del lienzo.
    png(OUT / "icon-192.png", 192, 192, stairs_icon(192, 1.0))
    png(OUT / "icon-512.png", 512, 512, stairs_icon(512, 1.0))
    png(OUT / "apple-touch-icon.png", 180, 180, stairs_icon(180, 1.0))
    # Maskable: Android recorta hasta un 20 % por lado, así que el motivo va más
    # pequeño y el degradado llega hasta el borde.
    png(OUT / "icon-maskable-512.png", 512, 512, stairs_icon(512, 0.78))
    print("Listo.")
