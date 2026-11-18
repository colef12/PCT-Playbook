#!/usr/bin/env python3
"""Rebuild the MTV sector geometry (line 1 of mtv/mtv-data.js) from the PCT 7110.65H CHG 1 figures.

Usage:
  python3 tools/build_geometry.py <65H.pdf> <ZDC-PCT.mappack> [workdir] [--georef]

Steps (scripts in tools/mtv/):
  1. extract.py  figures 8-9-1 … 8-17-1 -> workdir/img (PDF pages in tools/mtv/pages.json)
  2. georef.py   similarity fit of each figure's map linework to Vice M_NORTH/M_SOUTH
                 (only with --georef; otherwise the committed tools/mtv/geo.json is used)
  3. vec.py      blue sector lines -> faces (per-figure overrides: tools/mtv/vec_params.json)
  4. build.py    hand-verified labels (tools/mtv/assign.json) -> snapped planar faces per DCA flow
  5. check.py    validity / shared-edge report
QA images: tools/mtv/show.py (numbered faces for assign.json), overlay.py (georef), qa_render.py.
Needs: pip install pymupdf opencv-python-headless shapely scipy scikit-image skan msgpack
"""
import os, shutil, subprocess, sys
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mtv')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pdf, mappack = sys.argv[1:3]
work = next((a for a in sys.argv[3:] if not a.startswith('--')), '/tmp/mtv-build')
run = lambda *a: subprocess.run([sys.executable, *a], cwd=T, check=True)
run('extract.py', pdf, work)
if '--georef' in sys.argv:
    run('georef.py', mappack, work, f'{work}/geo.json'); shutil.copy(f'{work}/geo.json', f'{T}/geo.json')
else:
    shutil.copy(f'{T}/geo.json', f'{work}/geo.json')
run('vec.py', work, f'{work}/geo.json', f'{work}/vec')
run('build.py', mappack, work, os.path.join(ROOT, 'mtv', 'mtv-data.js'))
run('check.py', os.path.join(ROOT, 'mtv', 'mtv-data.js'))
