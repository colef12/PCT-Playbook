#!/usr/bin/env python3
"""Rebuild the SID/STAR block (line 2) of an area visualizer data file from the FAA CIFP.

Usage:  python3 tools/build_procs.py <FAACIFP18 text or .zst> [chp|mtv] [out.js]

  chp (default) -> chp/chp-data.js   window.CHP_AIR.procs=
  mtv           -> mtv/mtv-data.js   window.MTV_AIR.procs=

The CIFP ships with Vice (resources/FAACIFP18.zst) and is free from the FAA.
Sector / handoff captions live in each area's CAPTIONS (PCT 7110.65H CHG 1).

Each WANT row: (airport, SID|STAR, ids or None, json key, {flow: runway}, cross)
  json key  'flows' = the page's own flow switch; 'dflows'/'bflows'/'iflows'/'sflows'
            = a secondary layer with its own switch (DCA, BWI, IAD, satellites).
  runway    '' = no runway legs (common + enroute only).
  cross     True = keep only if the procedure crosses the area (faces on line 1 of
            the data file); enroute transitions that never touch the area are dropped.
"""
import json, math, re, sys

BWI = (-76.6683, 39.1754)
DCA = (-77.0377, 38.8521)
BWI_ARR = {'W': '28', 'N': '33L', 'E': '10', 'S': '15R'}   # BWI landing runway per flow
BWI_DEP = {'W': '28', 'N': '28', 'E': '15R', 'S': '15R'}   # BWI jet departure runway per flow
DCA_RW = {'N': '01', 'S': '19'}                            # DCA / ADW landing direction
IAD_ARR = {'N': '01C', 'S': '19C'}                         # matches RW01C or RW01B (01C/01R)
IAD_DEP = {'N': '01C', 'S': '19C'}
NONE = {'A': ''}                                           # satellites: no runway legs

# DoD procedures are not in the FAA CIFP. Fix sequence from CRC NavData (CANNY1, cycle 2611).
MANUAL = {
  ('KDOV', 'SID', 'CANNY1'): dict(com=['CANNY', 'TROTZ', 'WONCE', 'TERPZ'], enr={
    'FLASK': ['TERPZ', 'LITME', 'HIRCK', 'BUTRZ', 'CLTCH', 'KERRK', 'TEEMS', 'FLASK'],
    'GLANC': ['TERPZ', 'LITME', 'HIRCK', 'SCRAM', 'DANOO', 'WALCE', 'GLANC'],
    'JERES': ['TERPZ', 'LINSE', 'JERES'],
    'MAULS': ['TERPZ', 'LITME', 'HIRCK', 'BUTRZ', 'CLTCH', 'KERRK', 'MAULS'],
    'MCRAY': ['TERPZ', 'LINSE', 'BUFFR', 'MCRAY'],
    'MELTN': ['TERPZ', 'LITME', 'HIRCK', 'JDUBB', 'CASLY', 'MELTN'],
    'OTTTO': ['TERPZ', 'FOXHL', 'OTTTO'],
    'RAMAY': ['TERPZ', 'FOXHL', 'RAMAY'],
    'RRSIN': ['TERPZ', 'LITME', 'HIRCK', 'JDUBB', 'TYPNZ', 'SCORN', 'RRSIN']}),
}

AREAS = {
  'chp': dict(
    out='chp/chp-data.js', var='CHP_AIR', ref=BWI,
    recip={'28': '10', '15R': '33L'},
    want=[('KBWI', 'STAR', None, 'flows', BWI_ARR, False), ('KBWI', 'SID', None, 'flows', BWI_DEP, False),
          ('KDCA', 'STAR', ['CLIPR', 'SKILS', 'DEALE'], 'dflows', DCA_RW, False),
          ('KADW', 'STAR', ['SPISY'], 'dflows', DCA_RW, False),
          # KDOV CANNY# (Dover AFB): no runway legs, shown in every BWI flow
          ('KDOV', 'SID', ['CANNY'], 'flows', {'W': '', 'N': '', 'E': '', 'S': ''}, False)],
    captions={
      ('KDOV', 'CANNY'): ('GRACO → WOOLY → MTV‑FLUKY / BUFFR', 'GRACO→WOOLY AOA 120 · →FLUKY climb via SID 170 · →BUFFR AOA 120 ↑160'),
      'ANTHM': ('BUFFR → WOOLY', 'ZDC 05 (LDN)'), 'EMI': ('BUFFR → WOOLY', 'ZDC 05 (LDN) · non‑RNAV/props'),
      'TRISH': ('WOOLY', 'ZNY 25 / PHL'), 'MIIDY': ('GRACO', 'ZDC 51 (CAS)'), 'RAVNN': ('MTV‑KRANT → BWIFS', 'ZDC 20/37'),
      'TERPZ': ('WOOLY → MTV‑TYSON', 'CLTCH/SCRAM/JDUBB · 170'), 'FOXHL': ('WOOLY → MTV‑TYSON', 'RAMAY/OTTTO · 170'),
      'LINSE': ('WOOLY → BUFFR', 'JERES/MCRAY · 170'), 'CONLE': ('GRACO → MTV‑KRANT', 'COLIN · 140'),
      'FIXET': ('GRACO → MTV‑KRANT', 'CLTCH/SCRAM/JDUBB/RAMAY/OTTTO · 140'), 'DUKPN': ('GRACO → ZDC 17', 'SWANN/AGARD · 140'),
      'CLIPR': ('WOOLY → MTV‑ENSUE', 'ZNY 25 (MXE) · cross BAL 100 / 250 kt'),
      'SKILS': ('WOOLY → MTV‑ENSUE', 'ZNY 25 (LRP/PSB) · cross BAL 100 / 250 kt'),
      'DEALE': ('PALEO → MTV‑ENSUE', 'ZDC 51 (CAS) via BILIT · 100'),
      'SPISY': ('PALEO → MTV‑ADWAR', 'ZDC 51 (CAS) via BILIT · 40'),
    }),
  'mtv': dict(
    out='mtv/mtv-data.js', var='MTV_AIR', ref=DCA,
    recip={'01': '19', '19': '01', '28': '10', '15R': '33L', '01C': '19C', '19C': '01C'},
    want=[('KDCA', 'STAR', None, 'flows', DCA_RW, False), ('KDCA', 'SID', None, 'flows', DCA_RW, False),
          ('KADW', 'STAR', None, 'flows', DCA_RW, False), ('KADW', 'SID', None, 'flows', DCA_RW, False),
          ('KBWI', 'STAR', None, 'bflows', BWI_ARR, True), ('KBWI', 'SID', None, 'bflows', BWI_DEP, True),
          ('KIAD', 'STAR', None, 'iflows', IAD_ARR, True), ('KIAD', 'SID', None, 'iflows', IAD_DEP, True),
          # satellites: only procedures no primary airport above already carries
          ('KHEF', 'SID', None, 'sflows', NONE, True), ('KJYO', 'SID', ['PTOMC'], 'sflows', NONE, True),
          ('KGAI', 'STAR', ['TRSTN'], 'sflows', NONE, True), ('KMRB', 'SID', ['TRIXY'], 'sflows', NONE, True),
          ('KDOV', 'SID', ['CANNY'], 'sflows', NONE, True)],
    # (sector path, handoff / where it comes from) — PCT 7110.65H CHG 1 Chapter 8 hand-off tables
    captions={
      ('KDOV', 'CANNY'): ('CHP‑GRACO → WOOLY → FLUKY', 'From CHP‑WOOLY climbing via SID to 170 · FLUKY turns west · ZDC 05/60'),
      ('KDCA', 'CAPSS'): ('OJAAY → DCAFR', 'ZDC → OJAAY · DCAFR at 60 (S) / 70 (N) (T8-11-2)'),
      ('KDCA', 'IRONS'): ('TAPPA → OJAAY → DCAFR', 'TAPPA 80 · DCAFR at 60 on downwind (S) / 70 (N)'),
      ('KDCA', 'FRDMM'): ('LURAY → OJAAY → DCAFR', 'Descend via to 60 (N) / 80 (S) at OJAAY · DCAFR at 60'),
      ('KDCA', 'TRUPS'): ('LURAY → OJAAY → DCAFR', 'Descend via to 60 (N) / 80 (S) at OJAAY · DCAFR at 60'),
      ('KDCA', 'NUMMY'): ('LURAY → OJAAY → DCAFR', 'Descend via to 60 (N) / 80 (S) at OJAAY · DCAFR at 60'),
      ('KDCA', 'CLIPR'): ('CHP‑WOOLY → ENSUE → DCAFR', 'ZNY 25 (MXE) · cross BAL 100 / 250 kt · DCAFR at 60'),
      ('KDCA', 'SKILS'): ('CHP‑WOOLY → ENSUE → DCAFR', 'ZNY 25 (LRP/PSB) · cross BAL 100 / 250 kt · DCAFR at 60'),
      ('KDCA', 'DEALE'): ('CHP‑PALEO → ENSUE → DCAFR', 'ZDC 51 (CAS) via BILIT · 100 · DCAFR at 60'),
      ('KDCA', 'TIKEE'): ('JRV‑BARIN → DCAFR (N) / TYSON (S)', 'Props · 50 · no runway legs'),
      ('KDCA', 'CLTCH'): ('TYSON → FLUKY', '110 · on SID or direct BUTRZ/POOCH/HAFNR'),
      ('KDCA', 'SCRAM'): ('TYSON → FLUKY', '110 · on SID or direct BUTRZ/POOCH/HAFNR'),
      ('KDCA', 'JDUBB'): ('TYSON → FLUKY', '110 · on SID or direct BUTRZ/POOCH/HAFNR'),
      ('KDCA', 'WYNGS'): ('TYSON → LURAY', 'AOA 120 (N) / 140 (S) ↑170 · join by RAMAY/OTTTO'),
      ('KDCA', 'REBLL'): ('TYSON → LURAY', 'AOA 120 (N) / 140 (S) ↑170 · join by RAMAY/OTTTO'),
      ('KDCA', 'HORTO'): ('TYSON → CHP‑BUFFR', 'AOA 110 ↑170 · on SID or direct HORTO'),
      ('KDCA', 'SOOKI'): ('KRANT → CHP‑GRACO', 'AOA 60 ↑70 · heading 090 toward ANP'),
      ('KDCA', 'DOCTR'): ('KRANT → CHP‑GRACO', 'AOA 60 ↑70 (PHL jets ↑110) · direct PALEO/DOCTR'),
      ('KDCA', 'AMEEE'): ('KRANT → JRV‑CSIDW', '120 · on route or direct COLIN'),
      ('KADW', 'FRDMM'): ('LURAY → OJAAY → DCAFR / TYSON → KRANT', 'Descend via to 60 (N) / 80 (S) · ADW S via TYSON/KRANT at 30'),
      ('KADW', 'TRUPS'): ('LURAY → OJAAY → DCAFR / TYSON → KRANT', 'Descend via to 60 (N) / 80 (S) · ADW S via TYSON/KRANT at 30'),
      ('KADW', 'NUMMY'): ('LURAY → OJAAY → DCAFR / TYSON → KRANT', 'Descend via to 60 (N) / 80 (S) · ADW S via TYSON/KRANT at 30'),
      ('KADW', 'SPISY'): ('CHP‑PALEO → ADWAR', 'ZDC 51 (CAS) via BILIT · 40'),
      ('KADW', 'VUDOO'): ('JRV‑CSIDE → DEALE → ADWAR', 'Descend via to 80 (N) / 50 (S) · ADWAR at 50'),
      ('KADW', 'TIKEE'): ('JRV‑BARIN → DCAFR (N) / TYSON (S)', 'Props · 50 · no runway legs'),
      ('KBWI', 'TERPZ'): ('CHP‑WOOLY → FLUKY', 'Climb via SID to 170 · FLUKY left turns on contact'),
      ('KBWI', 'FOXHL'): ('CHP‑WOOLY → FLUKY', 'Climb via SID to 170 · FLUKY left turns on contact'),
      ('KBWI', 'CONLE'): ('CHP‑GRACO → KRANT', 'AOA 110 ↑140 via the CONLE Gate'),
      ('KBWI', 'FIXET'): ('CHP‑GRACO → KRANT → FLUKY', 'TMU‑assigned only · AOA 110 ↑140 · FL190 to FLUKY'),
      ('KBWI', 'RAVNN'): ('DEALE → CHP‑BWIFS', 'Descend via · BWIFS turns/descent to 50 at RAVNN'),
      ('KIAD', 'RNLDI'): ('SHD‑TILLY → LURAY', '↑100 · on SID or direct RNLDI'),
      ('KIAD', 'BUNZZ'): ('SHD‑TILLY → LURAY', '↑100 · on SID or direct BUNZZ'),
      ('KIAD', 'CLTCH'): ('SHD‑TILLY → FLUKY', '100 · direct BUTRZ/POOCH/HAFNR'),
      ('KIAD', 'SCRAM'): ('SHD‑TILLY → FLUKY', '100 · direct BUTRZ/POOCH/HAFNR'),
      ('KIAD', 'JDUBB'): ('SHD‑TILLY → FLUKY', '100 · direct BUTRZ/POOCH/HAFNR'),
      ('KIAD', 'JCOBY'): ('SHD‑ASPER → KRANT', '100 · on SID or direct RIGNZ'),
      ('KHEF', 'GABBE'): ('SHD‑TILLY → FLUKY', '100 · on SID or direct CLTCH/SCRAM/JDUBB'),
      ('KHEF', 'ARSNL'): ('SHD‑BRSTO → LURAY', '↑100 · on the ARSNL SID'),
    }),
}


def read(path):
    raw = open(path, 'rb').read()
    if raw[:4] == b'\x28\xb5\x2f\xfd':
        import zstandard
        raw = zstandard.ZstdDecompressor().stream_reader(open(path, 'rb')).read()
    return raw.decode('latin-1').splitlines()


def ll(lat, lon):
    try:
        a = (int(lat[1:3]) + int(lat[3:5]) / 60 + int(lat[5:9]) / 360000) * (1 if lat[0] == 'N' else -1)
        o = (int(lon[1:4]) + int(lon[4:6]) / 60 + int(lon[6:10]) / 360000) * (1 if lon[0] == 'E' else -1)
        return (round(o, 5), round(a, 5))
    except ValueError:
        return None


def area_shape(src, var):
    """Union of every face in the data file's line 1 (shapely), or None."""
    try:
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        d = json.loads(src[0][len('window.%s=' % var):].rstrip(';'))
        polys = [Polygon(f['poly'][0], f['poly'][1:]) for fl in d['faces'].values() for f in fl]
        return unary_union([p.buffer(0) for p in polys])
    except Exception as e:  # noqa: BLE001
        print('area outline unavailable, no cross-area filter:', e)
        return None


def main():
    L = read(sys.argv[1])
    A = AREAS[sys.argv[2] if len(sys.argv) > 2 else 'chp']
    out = sys.argv[3] if len(sys.argv) > 3 else A['out']
    REF, RECIP, CAP = A['ref'], A['recip'], A['captions']
    src = open(out, encoding='utf-8').read().split('\n')
    shape = area_shape(src, A['var']) if any(w[5] for w in A['want']) else None
    dist = lambda a: math.hypot((a[0] - REF[0]) * math.cos(math.radians(REF[1])), a[1] - REF[1])
    cycle = L[0][35:39] if L[0].startswith('HDR') else ''
    pts, rwy, legs, arp = {}, {}, {}, {}
    for l in L:
        if len(l) < 100 or l[0] != 'S': continue
        sec, sub = l[4], l[5]
        if sec == 'E' and sub == 'A': pts.setdefault(l[13:18].strip(), []).append(ll(l[32:41], l[41:51]))
        elif sec == 'D': pts.setdefault(l[13:17].strip(), []).append(ll(l[32:41], l[41:51]) or ll(l[55:64], l[64:74]))
        elif sec == 'P' and l[12] == 'A': arp[l[6:10].strip()] = ll(l[32:41], l[41:51])
        elif sec == 'P' and l[12] == 'C': pts.setdefault(l[13:18].strip(), []).append(ll(l[32:41], l[41:51]))
        elif sec == 'P' and l[12] == 'G': rwy[(l[6:10], l[13:18].strip())] = ll(l[32:41], l[41:51])
        elif sec == 'P' and l[12] in 'DE' and l[38] in '01':
            legs.setdefault((l[6:10], 'SID' if l[12] == 'D' else 'STAR', l[13:19].strip()), []).append(l)
    fixes = {}

    def fix(name):
        if name not in fixes:
            c = [p for p in pts.get(name, []) if p]
            if not c: return None
            fixes[name] = list(min(c, key=dist))
        return name

    def restr(l):
        d, a1, a2, sp = l[82], l[84:89].strip(), l[89:94].strip(), l[99:102].strip()
        h = lambda a: a[2:] if a.startswith('FL') else ('%03d' % round(int(a) / 100) if a.isdigit() else '')
        t = ''
        if h(a1): t = {'+': '≥' + h(a1), '-': '≤' + h(a1), 'B': h(a2) + '–' + h(a1)}.get(d, h(a1))
        if sp.isdigit() and int(sp): t = (t + ' ' if t else '') + str(int(sp)) + 'K'
        return t

    def chain(rows, x):
        p = []
        for l in sorted(rows, key=lambda r: r[26:29]):
            n = l[29:34].strip()
            if not n or l[36:38] == 'PA' or n.startswith('RW') or not fix(n): continue
            r = restr(l)
            if r: x.setdefault(n, r)
            if not p or p[-1] != n: p.append(n)
        return p

    def touches(path):
        from shapely.geometry import LineString
        return shape is None or LineString([fixes[n] for n in path]).intersects(shape)

    procs = []
    for apt, kind, ids, key, rwmap, cross in A['want']:
        for (a, k, pid), rows in sorted(legs.items()):
            base = re.sub(r'\d+$', '', pid)
            if a != apt or k != kind or (ids and base not in ids): continue
            tr = {}
            for l in rows: tr.setdefault((l[19], l[20:25].strip()), []).append(l)
            ENR, COM, RWT = (('36', '25', '4') if kind == 'SID' else ('14', '25', '36'))
            # a few procedures code the common route as transition "ALL"
            enr = sorted(n for t, n in tr if t in ENR and not n.startswith('RW') and n != 'ALL')

            def build(rw):
                x = {}
                rk = rw and next((q for q in tr if q[0] in RWT and q[1] in ('RW' + rw, 'RW' + rw[:2] + 'B')), None)
                r = chain(tr[rk], x) if rk else []
                c = [p for q in tr if q[0] in COM for p in [chain(tr[q], x)] if p]
                e = [(n, chain(tr[q], x)) for n in enr for q in tr if q[0] in ENR and q[1] == n]
                if cross: e = [(n, p) for n, p in e if len(p) > 1 and touches(p)]
                seq = ([r] + c + [p for _, p in e]) if kind == 'SID' else ([p for _, p in e] + c + [r])
                paths = [p for p in seq if len(p) > 1]
                if not paths: return None
                if cross and not any(touches(p) for p in paths): return None
                com = c[0] if c else (r if r else paths[0])
                o = {'rw': rw, 'paths': paths, 'x': x, 'lb': (com[-1] if kind == 'SID' else com[0]), 'coded': bool(rk)}
                if kind == 'SID':
                    first = (r or com)[0]; o['first'] = first
                    der = rwy.get((apt, 'RW' + RECIP.get(rw, ''))) if rk else None
                    if der: o['der'] = list(der)
                    elif rw == '' and arp.get(apt): o['der'] = list(arp[apt])
                if cross: o['tr'] = [n for n, _ in e]
                return o

            cap = CAP.get((apt, base)) or CAP.get(base) or ('', '')
            fl = {f: o for f in rwmap for o in [build(rwmap[f])] if o}
            if not fl: continue
            p = {'id': pid, 't': kind, 'apt': apt[1:], 'sec': cap[0], 'from': cap[1], 'tr': enr, key: fl}
            procs.append(p)
    for apt, kind, ids, key, rwmap, cross in A['want']:
        for (a, k, pid), m in MANUAL.items():
            base = re.sub(r'\d+$', '', pid)
            if a != apt or k != kind or (ids and base not in ids): continue
            allf = m['com'] + [n for q in m['enr'].values() for n in q]
            miss = [n for n in allf if not fix(n)]
            if miss: print('MANUAL', pid, 'missing fixes', miss); continue
            e = [(n, q) for n, q in sorted(m['enr'].items()) if not cross or touches(q)]
            o = {'rw': '', 'paths': [m['com']] + [q for _, q in e], 'x': {}, 'lb': m['com'][-1], 'coded': False, 'first': m['com'][0]}
            if arp.get(apt): o['der'] = list(arp[apt])
            if cross: o['tr'] = [n for n, _ in e]
            cap = CAP.get((apt, base)) or CAP.get(base) or ('', '')
            procs.append({'id': pid, 't': kind, 'apt': apt[1:], 'sec': cap[0], 'from': cap[1], 'tr': sorted(m['enr']),
                          'src': 'CRC NavData (DoD SID, not in FAA CIFP)', key: {f: o for f in rwmap}})
    keys = ('flows', 'dflows', 'bflows', 'iflows', 'sflows')
    pfl = lambda p: next(p[k] for k in keys if k in p)
    used = {n for p in procs for fl in pfl(p).values() for path in fl['paths'] for n in path}
    data = {'cycle': cycle, 'fixes': {n: fixes[n] for n in sorted(used)}, 'procs': procs}
    head = 'window.%s.procs=' % A['var']
    line = head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
    i = next((i for i, s in enumerate(src) if s.startswith(head)), None)
    if i is None: src.insert(1, line)
    else: src[i] = line
    open(out, 'w', encoding='utf-8').write('\n'.join(src))
    for p in procs:
        k = next(k for k in keys if k in p)
        print(p['apt'], p['t'], p['id'], k, '|', ' '.join(f"{f}:{v['rw']}{'' if v['coded'] else '(no rwy legs)'}:{sum(map(len, v['paths']))}" for f, v in p[k].items()), '|', p['sec'])
    print('cycle', cycle, 'procs', len(procs), 'fixes', len(used))


main()
