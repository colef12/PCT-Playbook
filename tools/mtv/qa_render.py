"""QA render of mtv-data.js: faces coloured by sector (top shelf, or owner at an altitude), every face edge drawn."""
import json, math, sys
import numpy as np, cv2
COL = {'ADWAR': '#f43f5e', 'DEALE': '#f59e0b', 'OJAAY': '#84cc16', 'DCAFR': '#3b82f6', 'ENSUE': '#a855f7',
       'FLUKY': '#ec4899', 'TYSON': '#14b8a6', 'KRANT': '#eab308', 'LURAY': '#6366f1'}
def bgr(h): return tuple(int(h[i:i + 2], 16) for i in (5, 3, 1))
js, flow, out = sys.argv[1:4]; alt = int(sys.argv[4]) if len(sys.argv) > 4 else None
D = json.loads(open(js).read().split('\n')[0][len('window.MTV_AIR='):].rstrip(';'))
F = D['faces'][flow]; S = D['shelves']
pts = np.array([c for f in F for c in f['poly'][0]])
x0, y0 = pts.min(0) - .03; x1, y1 = pts.max(0) + .03; K = math.cos(math.radians(38.85))
W = 1800; H = int(W * (y1 - y0) / ((x1 - x0) * K))
P = lambda c: (int((c[0] - x0) / (x1 - x0) * W), int((y1 - c[1]) / (y1 - y0) * H))
img = np.full((H, W, 3), 24, np.uint8)
for l in D['vmap']: cv2.polylines(img, [np.array([P(c) for c in l], np.int32)], False, (70, 70, 70), 1, cv2.LINE_AA)
def inalt(s, a): return any((a <= hi if lo == 0 else lo <= a <= hi) for lo, hi in s['r'])
top = lambda s: max(r[1] for r in s['r'])
for f in F:
    ss = [S[i] for i in f['st']]
    if alt is None: o = max(ss, key=top)
    else:
        act = [s for s in ss if inalt(s, alt)]; o = min(act, key=top) if act else None
    if not o: continue
    ov = img.copy(); cv2.fillPoly(ov, [np.array([P(c) for c in r], np.int32) for r in f['poly']], bgr(COL[o['sec']]))
    img = cv2.addWeighted(ov, .45, img, .55, 0)
for f in F:
    for r in f['poly']: cv2.polylines(img, [np.array([P(c) for c in r], np.int32)], True, (230, 230, 230), 1, cv2.LINE_AA)
for f in F:
    ss = [S[i] for i in f['st']]
    if alt is None: o = max(ss, key=top)
    else:
        act = [s for s in ss if inalt(s, alt)]; o = min(act, key=top) if act else None
    if o and f['a'] > 6:
        x, y = P(f['at']); cv2.putText(img, f"{o['sec'][:3]} {o['lbl']}", (x - 40, y), 0, .38, (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(out, img)
