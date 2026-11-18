"""Render vec/<fig>.json faces over the figure, numbering faces >= MIN nm^2 (for assign.json)."""
import json, sys
import numpy as np, cv2
from vec import nm2px
figdir, geofile, vecdir, outdir = sys.argv[1:5]
MIN = float(sys.argv[6]) if len(sys.argv) > 6 else 0.4
geo = json.load(open(geofile))
for k in (sys.argv[5].split(',') if len(sys.argv) > 5 and sys.argv[5] else json.load(open(f'{figdir}/pages.json'))):
    g = geo[k]; img = cv2.imread(f'{figdir}/img/{k}.png'); F = json.load(open(f'{vecdir}/{k}.json'))
    f = 1500 / max(img.shape[:2]); img = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
    rng = np.random.default_rng(1); vis = img.copy()
    for fc in F:
        ring = nm2px(g, np.array(fc['poly'][0])) * f
        col = tuple(int(c) for c in rng.integers(60, 230, 3))
        if fc['area'] >= MIN:
            ov = vis.copy(); cv2.fillPoly(ov, [np.round(ring).astype(np.int32)], col); vis = cv2.addWeighted(ov, .22, vis, .78, 0)
        cv2.polylines(vis, [np.round(ring).astype(np.int32)], True, (0, 0, 220), 1, cv2.LINE_AA)
    for fc in F:
        if fc['area'] < MIN: continue
        x, y = nm2px(g, np.array([fc['pt']]))[0] * f
        cv2.putText(vis, str(fc['id']), (int(x) - 8, int(y) + 6), 0, .65, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(vis, str(fc['id']), (int(x) - 8, int(y) + 6), 0, .65, (0, 0, 210), 2, cv2.LINE_AA)
    cv2.imwrite(f'{outdir}/v_{k}.png', vis)
