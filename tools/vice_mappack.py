#!/usr/bin/env python3
"""Reader for Vice VMV3 video-map packs (e.g. resources/videomaps/ZDC-PCT.mappack).

Format (from Vice's videomaps/videomaps.go and math/latlong.go):
  "VMV3" + uint32 LE header length + msgpack header {s:[{n,l,i,g,c,co,o,sz}], e:[...]}
  then a raw-DEFLATE geometry region. Each STARS map's payload at (o, sz):
    uvarint nLines; per line: uvarint nPts, 3 style bytes
    chained path for all points: per axis (lon, then lat) 4*n bytes, byte-split
      uint32 deltas of the float32 bit patterns
    uvarint nSymbols; per symbol f32 x, f32 y, 3 bytes
    uvarint nLabels; per label f32 x, f32 y, 5 bytes, uvarint len, text

Usage:
  python3 tools/vice_mappack.py ZDC-PCT.mappack            # list maps
  python3 tools/vice_mappack.py ZDC-PCT.mappack NAME out.json  # dump one map
"""
import json
import struct
import sys
import zlib

import msgpack


def _uvarint(b, p):
    x = s = 0
    while True:
        c = b[p]
        p += 1
        x |= (c & 0x7F) << s
        if c < 0x80:
            return x, p
        s += 7


def _axis(stream, n):
    out, prev = [], 0
    for i in range(n):
        u = stream[i] | stream[n + i] << 8 | stream[2 * n + i] << 16 | stream[3 * n + i] << 24
        prev = (prev + u) & 0xFFFFFFFF
        out.append(struct.unpack('<f', struct.pack('<I', prev))[0])
    return out


def _valid(x, y):
    return 1 <= abs(x) <= 180 and 1 <= abs(y) <= 90


def decode(payload):
    p = 0
    nl, p = _uvarint(payload, p)
    counts, styles = [], []
    for _ in range(nl):
        n, p = _uvarint(payload, p)
        counts.append(n)
        styles.append(tuple(payload[p:p + 3]))
        p += 3
    tot = sum(counts)
    lines = []
    if tot:
        xs = _axis(payload[p:p + 4 * tot], tot)
        ys = _axis(payload[p + 4 * tot:p + 8 * tot], tot)
        p += 8 * tot
        k = 0
        for n, st in zip(counts, styles):
            run = []
            for j in range(k, k + n):
                if _valid(xs[j], ys[j]):
                    run.append((xs[j], ys[j]))
                else:
                    if len(set(run)) > 1:
                        lines.append({'style': st, 'pts': run})
                    run = []
            if len(set(run)) > 1:
                lines.append({'style': st, 'pts': run})
            k += n
    ns, p = _uvarint(payload, p)
    syms = []
    for _ in range(ns):
        x, y = struct.unpack_from('<ff', payload, p)
        syms.append({'p': (x, y), 'style': payload[p + 8], 'size': payload[p + 9]})
        p += 11
    nlab, p = _uvarint(payload, p)
    labs = []
    for _ in range(nlab):
        x, y = struct.unpack_from('<ff', payload, p)
        p += 13
        ln, p = _uvarint(payload, p)
        labs.append({'p': (x, y), 'text': payload[p:p + ln].decode('utf-8', 'replace')})
        p += ln
    return lines, syms, labs


class MapPack:
    def __init__(self, path):
        raw = open(path, 'rb').read()
        assert raw[:4] == b'VMV3', 'not a VMV3 map pack'
        hl = struct.unpack_from('<I', raw, 4)[0]
        self.header = msgpack.unpackb(raw[8:8 + hl], raw=False, strict_map_key=False)
        self.geom = zlib.decompress(raw[8 + hl:], -15)
        self.index = {e['n']: e for e in self.header.get('s') or []}

    def names(self):
        return sorted(self.index)

    def get(self, name):
        """Look up by map name (RVMPCT112S) or label (C_AREA)."""
        e = self.index.get(name) or next(v for v in self.index.values() if v.get('l') == name)
        name = e['n']
        lines, syms, labs = decode(self.geom[e['o']:e['o'] + e['sz']])
        return {'name': name, 'label': e.get('l'), 'id': e.get('i'), 'lines': lines,
                'symbols': syms, 'labels': labs}


if __name__ == '__main__':
    mp = MapPack(sys.argv[1])
    if len(sys.argv) == 2:
        for n in mp.names():
            e = mp.index[n]
            print(f"{e.get('i'):>5} {n:<24} {e.get('l')!r} g={e.get('g')} sz={e['sz']}")
    else:
        m = mp.get(sys.argv[2])
        json.dump(m, open(sys.argv[3], 'w'))
        print(len(m['lines']), 'lines', len(m['symbols']), 'symbols', len(m['labels']), 'labels')
