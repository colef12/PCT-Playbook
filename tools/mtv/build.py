"""MTV sector build: hand-assigned figure faces -> one planar face set per DCA flow -> mtv/mtv-data.js line 1.

  per figure : assigned faces (+ inherited fragments, + 'extra' polygons) -> one region per label (shelf)
  per flow   : vertices snapped to Vice video-map vertices (M_NORTH/M_SOUTH) and clustered across all
               17 figures -> every shelf outline noded together -> polygonize -> slivers/islands merged
               into their longest-edge neighbour -> neighbours with identical shelf sets dissolved ->
               coverage_simplify (shared edges simplified once, so faces keep exact shared vertices)
  output     : faces[flow] = [{poly:[rings lon/lat], st:[shelf idx], at:[lon,lat], a:nm2}]
"""
import json, math, os, re, sys
from collections import defaultdict
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, Point, LineString, MultiLineString
from shapely.ops import unary_union, polygonize, polylabel
from scipy.spatial import cKDTree
from common import map_lines, nm2ll, ll2nm
from vec import nm2px, px2nm

TOLV = 0.30      # nm: snap a figure vertex to a video-map vertex
TOLC = 0.30      # nm: cluster figure vertices across figures
INHERIT = 1.5    # nm^2: unassigned faces below this inherit a neighbour's label
SLIVER = 0.25    # nm^2
THIN = 0.022     # area / perimeter^2 below this (and area < 8 nm^2) = sliver
ISLAND = 2.5     # nm^2
SIMPLIFY = 0.12  # nm, coverage_simplify tolerance
DEBUG = None

SECTORS = [  # 65H Table 8-1-1 / §8-9..8-17
    ('ADWAR', '1A', 'A', '128.000', 'ADW arrivals & finals; SPISY/VUDOO; ADW/DCA sats to BWI via ANP'),
    ('DEALE', '1D', 'D', '128.350', 'South/east — VUDOO#, RAVNN# to BWIFS, WHINO..COLIN T-route props'),
    ('OJAAY', '1J', 'J', '119.850', 'Sequences DCA/ADW arrivals from the west/south — FRDMM/TRUPS/NUMMY/CAPSS/IRONS'),
    ('DCAFR', '1V', 'V', '124.700', 'DCA final; NDY/DAA/W32/2W5/VKX (north ops)'),
    ('ENSUE', '1E', 'E', '124.200', 'Sequences DCA arrivals from the north/east — CLIPR/SKILS via BAL, DEALE#'),
    ('FLUKY', '1F', 'F', '121.050', 'Southwest departures — CLTCH/SCRAM/JDUBB, TERPZ/FOXHL, GABBE'),
    ('TYSON', '1Y', 'Y', '118.950', 'DCA/ADW departures west & north; DAA/2W5 (south ops)'),
    ('KRANT', '1K', 'K', '125.650', 'Main combine; south/east departures (CONLE gate, PALEO/DOCTR/SWANN), CGS, VKX (south)'),
    ('LURAY', '1L', 'L', '118.670', 'Western arrivals — merges FRDMM/TRUPS/NUMMY; RNLDI/BUNZZ/WYNGS/REBLL climbs'),
]
FIGS = {  # figure -> (sector, flows, 65H figure number)
    'ADWAR_N': ('ADWAR', 'N', '8-9-1'), 'ADWAR_S': ('ADWAR', 'S', '8-9-2'),
    'DEALE_N': ('DEALE', 'N', '8-10-1'), 'DEALE_S': ('DEALE', 'S', '8-10-2'),
    'OJAAY_N': ('OJAAY', 'N', '8-11-1'), 'OJAAY_S': ('OJAAY', 'S', '8-11-2'),
    'DCAFR_N': ('DCAFR', 'N', '8-12-2'), 'DCAFR_S': ('DCAFR', 'S', '8-12-3'),
    'ENSUE_N': ('ENSUE', 'N', '8-13-1'), 'ENSUE_S': ('ENSUE', 'S', '8-13-2'),
    'FLUKY_N': ('FLUKY', 'N', '8-14-1'), 'FLUKY_S': ('FLUKY', 'S', '8-14-2'),
    'TYSON_N': ('TYSON', 'N', '8-15-2'), 'TYSON_S': ('TYSON', 'S', '8-15-3'),
    'KRANT_N': ('KRANT', 'N', '8-16-1'), 'KRANT_S': ('KRANT', 'S', '8-16-2'),
    'LURAY': ('LURAY', 'NS', '8-17-1'),
}


def parse(lbl):
    """'AOB 20 & 40-80 & 180-190' -> [[0,20],[40,80],[180,190]] (hundreds of ft)."""
    out = []
    for t in lbl.split('&'):
        t = t.strip()
        m = re.fullmatch(r'AOB (\d+)', t) or re.fullmatch(r'(\d+)-(\d+)', t) or re.fullmatch(r'(\d+)(?: only)?', t)
        if not m: raise ValueError(lbl)
        g = [int(x) for x in m.groups()]
        out.append([0, g[0]] if t.startswith('AOB') else (g if len(g) == 2 else [g[0], g[0]]))
    if out == [[40, 40], [50, 50]]: out = [[40, 50]]
    return out


def pretty(lbl):
    return ' & '.join(('AOB ' + p.split()[1].zfill(3)) if p.startswith('AOB') else
                      ('–'.join(x.zfill(3) for x in p.split('-')) if '-' in p else p.zfill(3) + ' only')
                      for p in [x.strip() for x in lbl.split('&')]).replace('040 only & 050 only', '040 & 050')


def fig_regions(k, vec, assign, geo):
    """{label: shapely geometry in nm} for one figure."""
    F = {f['id']: f for f in vec}
    P = {i: shapely.make_valid(Polygon(f['poly'][0], f['poly'][1:])) for i, f in F.items()}
    lab = {int(i): v for i, v in assign.items() if i.isdigit()}
    inh = assign.get('inherit', INHERIT)       # hatched figures: larger fragments inherit too
    for i, f in F.items():
        if i not in lab and f['area'] >= inh:
            print(f'  ! {k} face {i} ({f["area"]} nm2) unassigned — dropped')
    # inherit: repeat until stable, longest shared boundary wins
    todo = [i for i in F if i not in lab and F[i]['area'] < inh]
    tree = shapely.STRtree([P[i] for i in F]); ids = list(F)
    for _ in range(30):
        changed = False
        for i in todo:
            if i in lab: continue
            best, bl = None, 1e-9
            for j in tree.query(P[i]):
                j = ids[j]
                if j == i or j not in lab: continue
                L = P[i].boundary.intersection(P[j].boundary.buffer(1e-3)).length
                if L > bl: best, bl = j, L
            if best is not None: lab[i] = lab[best]; changed = True
        if not changed: break
    reg = defaultdict(list)
    for i, v in lab.items():
        if v != '-' and i in P: reg[v].append(P[i])
    for v, ring in assign.get('extra', []):
        reg[v].append(Polygon(px2nm(geo, np.array(ring))))
    out = {}
    for v, ps in reg.items():
        u = unary_union(ps).buffer(0.03, join_style=2).buffer(-0.03, join_style=2)
        # fill pin-holes left by dropped text glyphs
        polys = list(u.geoms) if hasattr(u, 'geoms') else [u]
        polys = [Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area > 0.3]) for p in polys if p.area > 0.02]
        out[v] = unary_union(polys)
    # a region drawn inside another region of the same figure is cut out of it
    for a in out:
        for b in out:
            if a != b and out[a].area > out[b].area and out[a].buffer(0.05).contains(out[b].buffer(-0.05)):
                out[a] = out[a].difference(out[b])
    return out


def snap_vertices(geoms, mapverts):
    """Snap every vertex: to a video-map vertex within TOLV, else to the centroid of its cross-figure cluster."""
    V = np.array([c for g in geoms for p in (g.geoms if hasattr(g, 'geoms') else [g])
                  for r in [p.exterior, *p.interiors] for c in r.coords[:-1]])
    mt = cKDTree(mapverts)
    d, j = mt.query(V)
    tgt = V.copy()
    on = d < TOLV
    tgt[on] = mapverts[j[on]]
    # cluster the rest greedily (no transitive chains): seed + everything unassigned within TOLC -> mean;
    # a cluster that contains a map-snapped vertex goes to that map vertex
    t = cKDTree(V); done = np.zeros(len(V), bool)
    for i in np.argsort(~on):            # map-snapped vertices seed first
        if done[i]: continue
        grp = [j for j in t.query_ball_point(V[i], TOLC) if not done[j]]
        done[grp] = True
        if on[i]: tgt[grp] = tgt[i]
        else: tgt[grp] = V[grp].mean(0)
    M = {tuple(v): tuple(np.round(t, 4)) for v, t in zip(V, tgt)}
    def polys(g):
        if g.geom_type == 'Polygon': return [g]
        return [q for x in getattr(g, 'geoms', []) for q in polys(x)]
    def tr(g):
        out = []
        for p in polys(g):
            rings = [[M[tuple(c)] for c in r.coords[:-1]] for r in [p.exterior, *p.interiors]]
            if len(set(rings[0])) < 3: continue
            out += polys(shapely.make_valid(Polygon(rings[0], [r for r in rings[1:] if len(set(r)) >= 3])))
        return unary_union([q for q in out if q.area > 1e-6])
    return [tr(g) for g in geoms]


def merge_small(faces):
    """faces: list of dict(g=Polygon, st=frozenset). Merge slivers/islands into the longest-edge neighbour."""
    while True:
        def bad(f):
            a = f['g'].area; per = f['g'].length
            return a < SLIVER or (a < 8 and a / per ** 2 < THIN) or (a < ISLAND and f['iso'])
        tree = shapely.STRtree([f['g'] for f in faces])
        for f in faces:
            f['iso'] = False
        cand = sorted([i for i, f in enumerate(faces) if bad(f)], key=lambda i: faces[i]['g'].area)
        if not cand: return faces
        i = cand[0]; f = faces[i]
        best, bl = None, 0
        for j in tree.query(f['g']):
            if j == i: continue
            try: L = f['g'].boundary.intersection(faces[j]['g'].boundary).length
            except shapely.errors.GEOSException: L = f['g'].buffer(1e-4).intersection(faces[j]['g'].buffer(1e-4)).area / 2e-4
            if L > bl: best, bl = j, L
        if best is None:
            faces.pop(i); continue
        faces[best]['g'] = shapely.make_valid(unary_union([faces[best]['g'], f['g']]))
        faces.pop(i)


def dissolve(faces):
    """Union neighbours with identical shelf sets."""
    by = defaultdict(list)
    for f in faces: by[f['st']].append(f['g'])
    out = []
    for st, gs in by.items():
        u = unary_union(gs)
        for p in (u.geoms if hasattr(u, 'geoms') else [u]):
            if p.geom_type == 'Polygon' and p.area > 1e-6: out.append({'g': p, 'st': st})
    return out


def build(figdir, geo, vecdir, assign, mappack):
    mapL = map_lines(mappack, ['M_NORTH', 'M_SOUTH'])
    mapverts = np.unique(np.round(np.vstack([l for l in mapL if len(l) and np.hypot(*(l.max(0) - l.min(0))) > 0.8]), 4), axis=0)
    shelves, regions = [], []      # regions: (shelf index, flows, geometry)
    for k, (sec, flows, fig) in FIGS.items():
        R = fig_regions(k, json.load(open(f'{vecdir}/{k}.json')), assign[k], geo[k])
        for lbl, g in sorted(R.items(), key=lambda x: (parse(x[0])[-1][1], parse(x[0])[0][0])):
            si = next((i for i, s in enumerate(shelves) if s['sec'] == sec and s['lbl'] == pretty(lbl)), None)
            if si is None:
                shelves.append({'sec': sec, 'lbl': pretty(lbl), 'r': parse(lbl), 'fig': fig}); si = len(shelves) - 1
            elif fig not in shelves[si]['fig']:
                shelves[si]['fig'] += ', ' + fig
            regions.append((si, flows, g))
        print(f'  {k}: {len(R)} labels, {sum(g.area for g in R.values()):.0f} nm2')
    out = {}
    for fl in 'NS':
        R0 = [(s, g) for s, f, g in regions if fl in f and not g.is_empty]
        R = [(s, g) for (s, _), g in zip(R0, snap_vertices([g for _, g in R0], mapverts)) if not g.is_empty]
        lines = unary_union([g.boundary for _, g in R])
        lines = shapely.set_precision(lines, 0.0005)
        atoms = [p for p in polygonize(lines) if p.area > 1e-5]
        tree = shapely.STRtree([g for _, g in R])
        faces = []
        for p in atoms:
            q = p.representative_point()
            st = frozenset(R[j][0] for j in tree.query(q) if R[j][1].buffer(1e-4).contains(q))
            faces.append({'g': p, 'st': st})
        # atoms covered by no shelf are holes between sectors: keep them only to merge slivers away, then drop
        dbg = lambda tag: DEBUG and print('DBG', fl, tag, [(round(f['g'].area, 2), sorted(f['st'])) for f in faces if f['g'].buffer(1e-6).contains(DEBUG)])
        dbg('atoms')
        faces = dissolve(faces); dbg('dissolve1')
        faces = merge_small(faces); dbg('merge1')
        faces = dissolve([f for f in faces if f['st']]); dbg('dissolve2')
        faces = merge_small(faces); dbg('merge2')
        cov = shapely.coverage_simplify([f['g'] for f in faces], SIMPLIFY, simplify_boundary=True)
        if DEBUG:
            for f, g in zip(faces, cov):
                if f['g'].contains(DEBUG): print('DBG', f['g'].geom_type, f['g'].area, g.geom_type, g.area, g.is_valid)
        res = []
        for f, g in zip(faces, cov):
            if g.is_empty or g.area < 0.05: continue
            g = shapely.make_valid(g)
            for p in (g.geoms if hasattr(g, 'geoms') else [g]):
                if p.geom_type != 'Polygon' or p.area < 0.05: continue
                rings = [[list(map(lambda v: round(v, 5), nm2ll(*c))) for c in r.coords] for r in [p.exterior, *p.interiors]]
                lp = polylabel(p, 0.05)
                res.append({'poly': rings, 'st': sorted(f['st']), 'at': [round(v, 5) for v in nm2ll(lp.x, lp.y)], 'a': round(p.area, 2)})
        out[fl] = node_faces(res)
        print(f'  flow {fl}: {len(atoms)} atoms -> {len(res)} faces')
    return shelves, out, mapL


def node_faces(res, tol=2e-5):
    """Insert every face vertex that lies on another face's edge into that edge (exact shared vertices
    for the page's edge index), working on the rounded lon/lat rings."""
    V = np.array(sorted({tuple(c) for f in res for r in f['poly'] for c in r}))
    T = cKDTree(V)
    for f in res:
        for k, r in enumerate(f['poly']):
            nr = [r[0]]
            for a, b in zip(r, r[1:]):
                a_, b_ = np.array(a), np.array(b); d = b_ - a_; L = np.hypot(*d)
                mids = []
                if L > 0:
                    for j in T.query_ball_point((a_ + b_) / 2, L / 2 + tol):
                        p = V[j]; t = np.dot(p - a_, d) / L ** 2
                        if 1e-6 < t < 1 - 1e-6 and abs(d[0] * (p - a_)[1] - d[1] * (p - a_)[0]) / L < tol: mids.append((t, list(p)))
                nr += [p for _, p in sorted(mids)] + [b]
            f['poly'][k] = nr
    return res


def vm_segments(mappack):
    """Display video map: M_NORTH ∪ M_SOUTH linework (deduped polylines) and P_BDRYS area boundaries."""
    seen, vm = set(), []
    for l in map_lines(mappack, ['M_NORTH', 'M_SOUTH']):
        pts = [tuple(round(v, 4) for v in nm2ll(*c)) for c in l]
        key = tuple(pts) if pts <= pts[::-1] else tuple(pts[::-1])
        if key in seen: continue
        seen.add(key); vm.append([list(p) for p in pts])
    bd = [[[round(v, 4) for v in nm2ll(*c)] for c in l] for l in map_lines(mappack, ['P_BDRYS'])]
    return vm, bd


if __name__ == '__main__':
    mappack, figdir, out_js = sys.argv[1:4]
    here = os.path.dirname(os.path.abspath(__file__))
    geo = json.load(open(f'{figdir}/geo.json'))
    assign = json.load(open(f'{here}/assign.json'))
    shelves, faces, _ = build(figdir, geo, f'{figdir}/vec', assign, mappack)
    vm, bd = vm_segments(mappack)
    data = {'source': 'PCT 7110.65H CHG 1 (10/03/2024) Chapter 8 Mount Vernon sector figures (Figs 8-9-1 … 8-17-1), '
                      'georeferenced to the real PCT STARS video maps (M_NORTH / M_SOUTH) from the Vice ZDC-PCT map pack',
            'sectors': [{'id': a, 'stars': b, 'pos': c, 'vhf': d, 'role': e} for a, b, c, d, e in SECTORS],
            'flows': {'N': 'North', 'S': 'South'}, 'vmap': vm, 'bdry': bd, 'shelves': shelves, 'faces': faces}
    line = 'window.MTV_AIR=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
    src = open(out_js, encoding='utf-8').read().split('\n') if os.path.exists(out_js) else []
    if src and src[0].startswith('window.MTV_AIR='): src[0] = line
    else: src = [line] + src
    open(out_js, 'w', encoding='utf-8').write('\n'.join(src) + ('' if len(src) > 1 else '\n'))
    print('shelves', len(shelves), 'faces', {k: len(v) for k, v in faces.items()}, 'vmap', len(vm), 'bytes', len(line))
