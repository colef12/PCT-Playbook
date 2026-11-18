"""Georeference each 65H figure: similarity fit (scale, rotation, tx, ty) of the figure's
video-map linework to the Vice STARS map (M_NORTH / M_SOUTH).

Coarse: brute force over scale x rotation, translation by FFT cross-correlation.
Fine:   truncated chamfer distance minimised with Nelder-Mead.
Output: geo.json {fig: {s, th, tx, ty, score}} mapping figure px (u, v) -> plane nm:
        [x, y] = s * R(th) @ [u, -v] + [tx, ty]
"""
import json, math, sys
import numpy as np, cv2
from scipy.optimize import minimize
from common import map_lines, raster, masks, RES, HALF

def xform(P, s, th, tx, ty):
    c, d = math.cos(th), math.sin(th)
    u, v = P[:, 0], -P[:, 1]
    return np.c_[s * (c * u - d * v) + tx, s * (d * u + c * v) + ty]

def fit(img, dt, coarse_map, cres, hint=None, srange=(0.008, 0.25), thr=(-16, 16)):
    mp, _, _ = masks(img)
    ys, xs = np.nonzero(mp)
    P = np.c_[xs, ys].astype(float)
    rng = np.random.default_rng(0)
    if len(P) > 6000: P = P[rng.choice(len(P), 6000, replace=False)]
    c0 = P.mean(0); Pc = P - c0
    n = coarse_map.shape[0]
    F = np.fft.rfft2(coarse_map.astype(np.float32))
    best = (-1,)
    ss = np.geomspace(*srange, 70) if hint is None else np.geomspace(hint * .85, hint * 1.15, 15)
    for s in ss:
        for thd in np.arange(thr[0], thr[1] + .1, 1.0):
            xy = xform(Pc, s, math.radians(thd), 0, 0)
            img2 = np.zeros((n, n), np.float32)
            ij = np.round(np.c_[xy[:, 0] / cres + n / 2, n / 2 - xy[:, 1] / cres]).astype(int)
            ok = (ij[:, 0] >= 0) & (ij[:, 0] < n) & (ij[:, 1] >= 0) & (ij[:, 1] < n)
            if ok.mean() < .9: continue
            img2[ij[ok, 1], ij[ok, 0]] = 1
            cc = np.fft.irfft2(F * np.conj(np.fft.rfft2(img2)), s=(n, n))
            k = np.argmax(cc); dy, dx = divmod(k, n)
            sc = cc.flat[k] / ok.sum()
            if sc > best[0]:
                dx = dx - n if dx > n / 2 else dx; dy = dy - n if dy > n / 2 else dy
                best = (sc, s, math.radians(thd), dx * cres, -dy * cres)
    sc, s, th, tx, ty = best
    T = 1.0   # nm truncation
    def cost(q):
        xy = xform(Pc, q[0], q[1], q[2], q[3])
        i = np.clip(((HALF - xy[:, 1]) / RES).astype(int), 0, dt.shape[0] - 1)
        j = np.clip(((xy[:, 0] + HALF) / RES).astype(int), 0, dt.shape[1] - 1)
        return np.minimum(dt[i, j] * RES, T).mean()
    q = np.array([s, th, tx, ty])
    for _ in range(3):
        r = minimize(cost, q, method='Nelder-Mead', options={'xatol': 1e-6, 'fatol': 1e-6, 'maxiter': 4000,
                     'initial_simplex': np.vstack([q, q + np.diag([q[0] * .01, .005, .2, .2])])})
        q = r.x
    s, th, tx, ty = q
    # express against raw pixel coords (undo centering)
    c, d = math.cos(th), math.sin(th)
    u0, v0 = c0[0], -c0[1]
    tx2 = tx - s * (c * u0 - d * v0); ty2 = ty - s * (d * u0 + c * v0)
    inl = (cost(q) )
    return dict(s=s, th=th, tx=tx2, ty=ty2, coarse=float(sc), chamfer=float(inl))

if __name__ == '__main__':
    mappack, figdir, out = sys.argv[1:4]
    only = sys.argv[4].split(',') if len(sys.argv) > 4 else None
    figs = json.load(open(f'{figdir}/pages.json'))
    try: geo = json.load(open(out))
    except FileNotFoundError: geo = {}
    cache = {}
    for k in figs:
        if only and k not in only: continue
        names = {'N': ['M_NORTH'], 'S': ['M_SOUTH']}.get(k[-1], ['M_NORTH', 'M_SOUTH'])
        key = ','.join(names)
        if key not in cache:
            L = map_lines(mappack, names)
            full = raster(L)
            dt = cv2.distanceTransform(255 - full, cv2.DIST_L2, 5)
            cres = 0.25
            cm = cv2.dilate(raster(L, cres), np.ones((3, 3), np.uint8)).astype(np.float32) / 255
            cache[key] = (dt, cm, cres)
        dt, cm, cres = cache[key]
        img = cv2.imread(f'{figdir}/img/{k}.png')
        geo[k] = fit(img, dt, cm, cres)
        print(k, {a: round(b, 4) for a, b in geo[k].items()}, flush=True)
        json.dump(geo, open(out, 'w'), indent=1)
