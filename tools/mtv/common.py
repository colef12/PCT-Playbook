"""Shared helpers for the MTV geometry build (tools/build_geometry.py).

Plane: nautical miles east/north of the DCA ARP, x scaled by cos(DCA lat) — locally conformal.
"""
import math, os, sys
import numpy as np
import cv2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from vice_mappack import MapPack  # noqa: E402

DCA = (-77.0377, 38.8521)
K = math.cos(math.radians(DCA[1]))
RES = 0.05            # nm per px of the reference raster
HALF = 60.0           # raster covers ±60 nm around DCA
N = int(2 * HALF / RES)


def ll2nm(lon, lat):
    return ((lon - DCA[0]) * 60 * K, (lat - DCA[1]) * 60)


def nm2ll(x, y):
    return (DCA[0] + x / (60 * K), DCA[1] + y / 60)


def nm2px(x, y, res=RES):
    return ((x + HALF) / res, (HALF - y) / res)


def map_lines(mappack, names):
    mp = MapPack(mappack)
    out = []
    for n in names:
        for l in mp.get(n)['lines']:
            out.append(np.array([ll2nm(*p) for p in l['pts']]))
    return out


def raster(lines, res=RES, thick=1):
    n = int(2 * HALF / res)
    img = np.zeros((n, n), np.uint8)
    for l in lines:
        p = np.array([nm2px(x, y, res) for x, y in l]) * 16
        cv2.polylines(img, [p.astype(np.int32)], False, 255, thick, cv2.LINE_8, 4)
    return img


def masks(img):
    """img BGR -> (map-line mask, sector-line mask, ring mask) as bool arrays."""
    b, g, r = [img[:, :, i].astype(int) for i in range(3)]
    blue = (b > 110) & (b - r > 45) & (b - g > 30)
    green = (g > 110) & (g - r > 60) & (g - b > 30)
    dark = (np.maximum(np.maximum(r, g), b) < 100) & ~blue
    gray = (abs(r - g) < 12) & (abs(g - b) < 12) & (r > 165) & (r < 218)
    return dark | green, blue, gray
