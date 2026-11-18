"""Draw the Vice map (red) over a georeferenced figure for visual QA."""
import json, math, sys
import numpy as np, cv2
from common import map_lines

def inv(g, xy):
    s, th, tx, ty = g['s'], g['th'], g['tx'], g['ty']
    c, d = math.cos(th), math.sin(th)
    X, Y = (xy[:, 0] - tx) / s, (xy[:, 1] - ty) / s
    u = c * X + d * Y; w = -d * X + c * Y
    return np.c_[u, -w]

if __name__ == '__main__':
    mappack, figdir, geo, k, out = sys.argv[1:6]
    g = json.load(open(geo))[k]
    names = {'N': ['M_NORTH'], 'S': ['M_SOUTH']}.get(k[-1], ['M_NORTH', 'M_SOUTH'])
    img = cv2.imread(f'{figdir}/img/{k}.png')
    img = (img * .6 + 100).astype(np.uint8)
    for l in map_lines(mappack, names):
        p = inv(g, l)
        cv2.polylines(img, [np.round(p * 4).astype(np.int32)], False, (0, 0, 255), 1, cv2.LINE_AA, 2)
    cv2.imwrite(out, img)
