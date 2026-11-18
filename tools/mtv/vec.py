"""Vectorise each figure's blue sector linework into faces in the DCA nm plane.

blue mask -> drop text blobs -> skeleton (skan paths) -> georeference (geo.json)
-> simplify -> bridge gaps (dangling ends extended / joined within GAP nm)
-> polygonize. Writes vec/<fig>.json [{id, area, pt, poly}] and vec/<fig>.png
(faces numbered on the figure) for the hand face->label assignment (assign.json).
"""
import json, math, os, sys
import numpy as np, cv2
from shapely.geometry import LineString, Point, MultiLineString
from shapely.ops import unary_union, polygonize, nearest_points
from skimage.morphology import skeletonize
from skan import Skeleton
from common import masks

MINNM = 1.2     # text blob cut-off (bbox diagonal, nm)
GAP = 0.45      # max gap bridged to the nearest line, nm
RAY = 1.0       # max extension of a dangling end along its own direction, nm
SIMP = 0.06     # polyline simplification, nm
MINA = 0.0005  # min face area, nm^2 (tiny faces are kept and inherit a neighbour label)
CLOSE = 0.15    # morphological close radius, nm (vertex dots / map lines break the blue)

def px2nm(g, P):
    s, th, tx, ty = g['s'], g['th'], g['tx'], g['ty']
    c, d = math.cos(th), math.sin(th)
    u, v = P[:, 0], -P[:, 1]
    return np.c_[s * (c * u - d * v) + tx, s * (d * u + c * v) + ty]

def nm2px(g, P):
    s, th, tx, ty = g['s'], g['th'], g['tx'], g['ty']
    c, d = math.cos(th), math.sin(th)
    X, Y = (P[:, 0] - tx) / s, (P[:, 1] - ty) / s
    return np.c_[c * X + d * Y, -(-d * X + c * Y)]

def lines_of(img, g, extra_erase=()):
    mapm, blue, _ = masks(img)
    # vertex dots and map lines drawn over the sector lines break the blue: fill dark/green pixels
    # that sit between blue pixels
    r = max(1, int(round(0.2 / g['s'])))
    near = cv2.dilate(blue.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0
    blue = blue | (mapm & near)
    for (x0, y0, x1, y1) in extra_erase: blue[y0:y1, x0:x1] = False
    bl = blue.astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(bl, 8)
    keep = np.zeros(n, bool)
    for i in range(1, n):
        keep[i] = math.hypot(st[i, 2], st[i, 3]) * g['s'] >= MINNM
    m = keep[lab].astype(np.uint8)
    r = max(1, int(round(CLOSE / g['s'])))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    sk = skeletonize(m > 0)
    if sk.sum() < 2: return []
    S = Skeleton(sk)
    out = []
    for i in range(S.n_paths):
        p = S.path_coordinates(i)[:, ::-1].astype(float)   # (u, v)
        if len(p) < 2: continue
        q = px2nm(g, p)
        ls = LineString(q).simplify(SIMP)
        if ls.length > 0.05: out.append(ls)
    return out

def prune(segs, spur=0.35):
    """Drop short dangling skeleton spurs (repeat until stable)."""
    while True:
        deg = {}
        for l in segs:
            for e in (l.coords[0], l.coords[-1]):
                k = (round(e[0], 6), round(e[1], 6)); deg[k] = deg.get(k, 0) + 1
        keep = []
        for l in segs:
            a = deg[(round(l.coords[0][0], 6), round(l.coords[0][1], 6))]
            b = deg[(round(l.coords[-1][0], 6), round(l.coords[-1][1], 6))]
            if l.length < spur and (a == 1) != (b == 1): continue
            keep.append(l)
        if len(keep) == len(segs): return segs
        from shapely.ops import linemerge
        m = linemerge(keep); segs = list(m.geoms) if hasattr(m, 'geoms') else [m]

def bridge(lines):
    U = unary_union(lines)
    segs = prune(list(U.geoms) if hasattr(U, 'geoms') else [U])
    deg = {}
    for l in segs:
        for e in (l.coords[0], l.coords[-1]):
            k = (round(e[0], 6), round(e[1], 6)); deg[k] = deg.get(k, 0) + 1
    add = []
    for l in segs:
        cs = list(l.coords)
        for e, prev in ((cs[0], cs[1]), (cs[-1], cs[-2])):
            k = (round(e[0], 6), round(e[1], 6))
            if deg.get(k, 0) != 1: continue
            P = Point(e)
            others = unary_union([o for o in segs if o is not l] + [LineString(cs[1:-1])] if len(cs) > 3 else [o for o in segs if o is not l])
            # extend along direction
            dx, dy = e[0] - prev[0], e[1] - prev[1]; L = math.hypot(dx, dy) or 1
            ray = LineString([e, (e[0] + dx / L * RAY, e[1] + dy / L * RAY)])
            hit = ray.intersection(others)
            if not hit.is_empty:
                pts = [hit] if hit.geom_type == 'Point' else [g for g in getattr(hit, 'geoms', [hit]) if g.geom_type == 'Point']
                if pts:
                    t = min(pts, key=P.distance); add.append(LineString([e, t.coords[0]])); continue
            a, b = nearest_points(P, others)
            if P.distance(b) <= GAP: add.append(LineString([e, b.coords[0]]))
    import shapely
    M = MultiLineString([list(x.coords) for x in segs + add])
    M = shapely.snap(M, M, 0.02)          # weld ends that stop a hair short of a line
    return unary_union(shapely.set_precision(M, 0.002))

def run(figdir, g, k, outdir, erase=()):
    img = cv2.imread(f'{figdir}/img/{k}.png')
    L = lines_of(img, g, erase)
    net = bridge(L)
    polys = [p for p in polygonize(net) if p.area >= MINA]
    polys.sort(key=lambda p: -p.area)
    out = []
    vis = img.copy()
    rng = np.random.default_rng(1)
    for i, p in enumerate(polys):
        pt = p.representative_point() if p.area < 2 else p.buffer(-min(1.0, math.sqrt(p.area) / 4)).representative_point()
        if pt.is_empty: pt = p.representative_point()
        out.append({'id': i, 'area': round(p.area, 3), 'pt': [pt.x, pt.y], 'poly': [list(p.exterior.coords)] + [list(r.coords) for r in p.interiors]})
        ring = nm2px(g, np.array(p.exterior.coords))
        col = tuple(int(c) for c in rng.integers(60, 230, 3))
        ov = vis.copy(); cv2.fillPoly(ov, [np.round(ring).astype(np.int32)], col); vis = cv2.addWeighted(ov, .25, vis, .75, 0)
    for l in (net.geoms if hasattr(net, 'geoms') else [net]):
        cv2.polylines(vis, [np.round(nm2px(g, np.array(l.coords))).astype(np.int32)], False, (0, 0, 230), 1, cv2.LINE_AA)
    fs = .45 if img.shape[1] < 1500 else 1.1
    for f in out:
        x, y = nm2px(g, np.array([f['pt']]))[0]
        cv2.putText(vis, str(f['id']), (int(x) - 5, int(y) + 5), 0, fs, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(vis, str(f['id']), (int(x) - 5, int(y) + 5), 0, fs, (0, 0, 200), 1 if fs < 1 else 2, cv2.LINE_AA)
    os.makedirs(outdir, exist_ok=True)
    json.dump(out, open(f'{outdir}/{k}.json', 'w'))
    cv2.imwrite(f'{outdir}/{k}.png', vis)
    return len(out)

if __name__ == '__main__':
    figdir, geofile, outdir = sys.argv[1:4]
    geo = json.load(open(geofile))
    erase = json.load(open(f'{figdir}/erase.json')) if os.path.exists(f'{figdir}/erase.json') else {}
    # per-figure parameter overrides, e.g. {"OJAAY_N": {"GAP": 1.0}}
    over = json.load(open(os.path.join(os.path.dirname(__file__), 'vec_params.json')))
    base = dict(GAP=GAP, RAY=RAY, CLOSE=CLOSE, MINNM=MINNM)
    for k in (sys.argv[4].split(',') if len(sys.argv) > 4 else geo):
        globals().update(base); globals().update(over.get(k, {}))
        print(k, run(figdir, geo[k], k, outdir, erase.get(k, ())), flush=True)
