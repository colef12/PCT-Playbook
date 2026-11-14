#!/usr/bin/env python3
"""Rebuild the SID/STAR block (line 2) of chp/chp-data.js from the FAA CIFP.

Usage:  python3 tools/build_procs.py <FAACIFP18 text or .zst> [chp/chp-data.js]

The CIFP ships with Vice (resources/FAACIFP18.zst) and is free from the FAA.
Sector / handoff captions live in CAPTIONS below (PCT 7110.65H CHG 1).
"""
import json, math, re, sys

BWI = (-76.6683, 39.1754)
ARR = {'W': '28', 'N': '33L', 'E': '10', 'S': '15R'}      # BWI landing runway per flow
DEP = {'W': '28', 'N': '28', 'E': '15R', 'S': '15R'}      # BWI jet departure runway per flow
RECIP = {'28': '10', '15R': '33L'}
DCA = {'N': '01', 'S': '19'}                              # DCA / ADW landing direction
WANT = [  # airport, kind, ids (None = every procedure the CIFP holds for that airport)
    ('KBWI', 'STAR', None), ('KBWI', 'SID', None),
    ('KDCA', 'STAR', ['CLIPR', 'SKILS', 'DEALE']), ('KADW', 'STAR', ['SPISY']),
]
CAPTIONS = {
    'ANTHM': ('BUFFR → WOOLY', 'ZDC 05 (LDN)'), 'EMI': ('BUFFR → WOOLY', 'ZDC 05 (LDN) · non‑RNAV/props'),
    'TRISH': ('WOOLY', 'ZNY 25 / PHL'), 'MIIDY': ('GRACO', 'ZDC 51 (CAS)'), 'RAVNN': ('MTV‑KRANT → BWIFS', 'ZDC 20/37'),
    'TERPZ': ('WOOLY → MTV‑TYSON', 'CLTCH/SCRAM/JDUBB · 170'), 'FOXHL': ('WOOLY → MTV‑TYSON', 'RAMAY/OTTTO · 170'),
    'LINSE': ('WOOLY → BUFFR', 'JERES/MCRAY · 170'), 'CONLE': ('GRACO → MTV‑KRANT', 'COLIN · 140'),
    'FIXET': ('GRACO → MTV‑KRANT', 'CLTCH/SCRAM/JDUBB/RAMAY/OTTTO · 140'), 'DUKPN': ('GRACO → ZDC 17', 'SWANN/AGARD · 140'),
    'CLIPR': ('WOOLY → MTV‑ENSUE', 'ZNY 25 (MXE) · cross BAL 100 / 250 kt'),
    'SKILS': ('WOOLY → MTV‑ENSUE', 'ZNY 25 (LRP/PSB) · cross BAL 100 / 250 kt'),
    'DEALE': ('PALEO → MTV‑ENSUE', 'ZDC 51 (CAS) via BILIT · 100'),
    'SPISY': ('PALEO → MTV‑ADWAR', 'ZDC 51 (CAS) via BILIT · 40'),
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

def dist(a, b=BWI):
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(39.1)), a[1] - b[1])

def main():
    L = read(sys.argv[1]); out = sys.argv[2] if len(sys.argv) > 2 else 'chp/chp-data.js'
    cycle = L[0][35:39] if L[0].startswith('HDR') else ''
    pts, rwy, legs = {}, {}, {}
    for l in L:
        if len(l) < 100 or l[0] != 'S': continue
        sec, sub = l[4], l[5]
        if sec == 'E' and sub == 'A': pts.setdefault(l[13:18].strip(), []).append(ll(l[32:41], l[41:51]))
        elif sec == 'D': pts.setdefault(l[13:17].strip(), []).append(ll(l[32:41], l[41:51]) or ll(l[55:64], l[64:74]))
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
    procs = []
    for apt, kind, ids in WANT:
        for (a, k, pid), rows in sorted(legs.items()):
            base = re.sub(r'\d+$', '', pid)
            if a != apt or k != kind or (ids and base not in ids): continue
            tr = {}
            for l in rows: tr.setdefault((l[19], l[20:25].strip()), []).append(l)
            ENR, COM, RWT = (('36', '25', '4') if kind == 'SID' else ('14', '25', '36'))
            # a few procedures code the common route as transition "ALL"
            enr = sorted(n for t, n in tr if t in ENR and not n.startswith('RW') and n != 'ALL')
            def build(rw, flowkey=None):
                x = {}
                rk = next((key for key in tr if key[0] in RWT and key[1] in ('RW' + rw, 'RW' + rw[:2] + 'B')), None)
                r = chain(tr[rk], x) if rk else []
                c = [p for key in tr if key[0] in COM for p in [chain(tr[key], x)] if p]
                e = [chain(tr[key], x) for n in enr for key in tr if key[0] in ENR and key[1] == n]
                seq = ([r] + c + e) if kind == 'SID' else (e + c + [r])
                paths = [p for p in seq if len(p) > 1]
                if not paths: return None
                com = c[0] if c else (r if r else paths[0])
                o = {'rw': rw, 'paths': paths, 'x': x, 'lb': (com[-1] if kind == 'SID' else com[0]), 'coded': bool(rk)}
                if kind == 'SID':
                    first = (r or com)[0]; o['first'] = first
                    der = rwy.get((apt, 'RW' + RECIP.get(rw, '')))
                    if der: o['der'] = list(der)
                return o
            cap = CAPTIONS.get(base, ('', ''))
            p = {'id': pid, 't': kind, 'apt': apt[1:], 'sec': cap[0], 'from': cap[1], 'tr': enr}
            if apt == 'KBWI':
                p['flows'] = {f: o for f in 'WNES' for o in [build((DEP if kind == 'SID' else ARR)[f])] if o}
            else:
                p['dflows'] = {f: o for f in 'NS' for o in [build(DCA[f])] if o}
            procs.append(p)
    used = {n for p in procs for fl in (p['flows'] if 'flows' in p else p['dflows']).values() for path in fl['paths'] for n in path}
    data = {'cycle': cycle, 'fixes': {n: fixes[n] for n in sorted(used)}, 'procs': procs}
    src = open(out, encoding='utf-8').read().split('\n')
    i = next(i for i, s in enumerate(src) if s.startswith('window.CHP_AIR.procs='))
    src[i] = 'window.CHP_AIR.procs=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
    open(out, 'w', encoding='utf-8').write('\n'.join(src))
    for p in procs:
        fl = p['flows'] if 'flows' in p else p['dflows']
        print(p['apt'], p['t'], p['id'], '|', ' '.join(f"{k}:{v['rw']}{'' if v['coded'] else '(no rwy legs)'}:{sum(map(len, v['paths']))}" for k, v in fl.items()), '| trans', ','.join(p['tr']))
    print('cycle', cycle, 'fixes', len(used))

main()
