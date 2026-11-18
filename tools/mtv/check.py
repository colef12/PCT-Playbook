"""Topology check of mtv-data.js faces: validity, and interior edges not shared exactly by two faces."""
import json, sys
from collections import Counter
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
D = json.loads(open(sys.argv[1]).read().split('\n')[0][len('window.MTV_AIR='):].rstrip(';'))
for fl, F in D['faces'].items():
    E = Counter(); bad = 0
    for f in F:
        p = Polygon(f['poly'][0], f['poly'][1:]); bad += not p.is_valid
        for r in f['poly']:
            for a, b in zip(r, r[1:]): E[tuple(sorted((tuple(a), tuple(b))))] += 1
    U = unary_union([Polygon(f['poly'][0], f['poly'][1:]) for f in F]).boundary.buffer(1e-5)
    single = [e for e, n in E.items() if n == 1 and not U.contains(LineString(e))]
    L = sum(LineString(e).length for e in single) * 60
    print(f'{fl}: {len(F)} faces, invalid {bad}, edges {len(E)}, unshared interior edges {len(single)} ({L:.1f} nm)')
