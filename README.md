# PCT Playbook

**Live site: https://colef12.github.io/PCT-Playbook/**

Working playbook for **Potomac TRACON (PCT)** on the VATSIM network (vZDC). Static HTML, no build step, hosted on GitHub Pages.

> Flight simulation use only. Not for real-world navigation or ATC.

## What's on the page

| Section | What it does |
|---|---|
| **My Position** | Enter your VATSIM CID once. Finds you in the vNAS controller feed (primary + secondary positions), shows callsign/frequency/rating/time on, maps your positions to PCT sectors and areas, highlights your sector rows, and can filter the page to your areas. |
| **ATIS** | IAD, DCA, BWI. VATSIM ATIS by default, real-world D-ATIS fallback, per-airport Auto / VATSIM / Real world toggle. Letter turns **green** when VATSIM matches real world, **red** when it doesn't. Parsed chips for landing/departure runways, wind, ceiling/visibility. Paste-ATIS fallback. |
| **PCT Departures** | Departure scratchpads by area (MTV · SHD · CHP · JRV), with a **VATSIM / Real world** toggle and a **Hide JRV** option. |
| Sectors & Frequencies | All PCT sectors with VHF/UHF/IA code, filterable by area. |
| Position Combining · Tower Frequencies · Adjacent Facilities · Procedures · References | Quick-reference tables and rule cards. |

### MTV airspace visualizer (`mtv/`)

Real-world Mount Vernon sectors (PCT 7110.65H CHG 1 Chapter 8 figures 8-9-1 … 8-17-1) snapped to the PCT STARS video maps (Vice `M_NORTH` / `M_SOUTH`), per DCA flow. Same features as CHP.

- **Flows / views** — North (DCA 01) · South (DCA 19) (`1`–`2`); ALL shelves or owner BY ALT (`A`, `↑`/`↓`, SFC–230).
- **Sectors** — ADWAR 128.000 · DEALE 128.350 · OJAAY 119.850 · DCAFR 124.700 · ENSUE 124.200 · FLUKY 121.050 · TYSON 118.950 · KRANT 125.650 · LURAY 118.670. LURAY's single figure applies to both flows.
- **Procedures** — every DCA SID (9) and STAR (9) and every ADW STAR (6) from the FAA CIFP with the runway transition for the DCA flow (the CIFP has no ADW SIDs). BWI, IAD and satellite (HEF/JYO/GAI/MRB) procedures that cross MTV are a dashed lavender layer: BWI follows its own W/N/E/S switch (`B`), IAD its own N/S switch (`I`). Hand-off captions from the 65H Ch. 8 tables.
- **Live VATSIM**, layers, range rings (from DCA), deep links (`mtv/#s/alt/60/s:krant/p:frdmm7`, cross-area keys like `p:frdmm7-adw`) as on CHP.

Rebuild:

```
python3 tools/build_geometry.py <PCT 7110.65H CHG 1.pdf> <Vice ZDC-PCT.mappack>   # line 1 of mtv/mtv-data.js
python3 tools/build_procs.py <FAACIFP18[.zst]> mtv                                # line 2
```

The geometry pipeline lives in `tools/mtv/`: `extract.py` (figures from the PDF), `georef.py` (similarity fit to the video map → `geo.json`), `vec.py` (blue sector lines → faces), `assign.json` (hand-verified face → 65H label, per figure), `build.py` (snap to video-map vertices, polygonize, sliver merge, coverage simplify), `check.py` (validity / shared edges). QA helpers: `show.py`, `overlay.py`, `qa_render.py`. `tools/vice_mappack.py` reads Vice `.mappack` files.

### CHP airspace visualizer (`chp/`)

Real-world Chesapeake sectors (PCT 7110.65H Ch. 5 figures on the PCT STARS video map), per BWI flow.

- **Flows / views** — West · North · East · South (`1`–`4`); ALL shelves or owner BY ALT (`A`, `↑`/`↓`).
- **Vertical profile** — hover or click-to-pin a point to see who owns every 1,000 ft from SFC to 170; click a band to jump to that altitude.
- **Procedures** — every BWI SID (6) and STAR (5) from the FAA CIFP with the runway transition for the selected flow, crossing restrictions, and per-procedure leg lists. DCA/ADW STARs that cross CHP (CLIPR, SKILS, DEALE, SPISY) are a separate layer with its own North/South switch (`D`).
- **Live VATSIM** (`L`) — traffic tagged and coloured by the CHP sector that owns it at its position and altitude, staffed CHP positions (VATSIM + vNAS feeds), and the BWI ATIS landing runway as a flow suggestion (or auto-follow).
- **Layers** — video map, PCT areas, airports, altitude labels, BWI range rings (`R`), traffic (`T`); choices persist. Cursor readout is magnetic bearing/distance from BWI.
- **Deep links** — `chp/#n/alt/40/s:bwifn/p:trish5` (flow / altitude / sector / procedure).

Geometry and procedures live in `chp/chp-data.js`; the page is `chp/index.html`. Rebuild the procedure block after an AIRAC change with `python3 tools/build_procs.py <FAACIFP18[.zst]> chp` (the CIFP ships with Vice under `resources/`).

### PCT Departures

- **VATSIM** — scratchpads from vZDC-PCT-P-01G QRG 6–2, with the altitude and handoff sector for each SID from the area departure tables (TBL 3-1-2 / 3-2-2 / 3-3-2 / 3-4-2). Departures that transit another area (e.g. IAD SIDs through MTV) appear in that area's column with an origin tag. Hover an altitude for the sector-by-sector climb.
- **Real world** — scratchpads from PCT 7110.65H Appendix E. Every route shows **ALT**; hover it for the handoff chain built from the 65H "From X To" sector tables. Steps the order doesn't cover (tower → first sector, PCT → ZDC exit) are labelled as inferred / per LOA.

## Structure

```
index.html              Page shell and section layout
assets/css/playbook.css Theme (STARS-inspired dark)
assets/js/playbook.js   Rendering, search/filters, ATIS + vNAS feeds
data/pct-data.js        ALL content: sectors, freqs, departures, chains, procedures, refs
```

Content edits go in `data/pct-data.js` only — the page renders whatever is there.

Key data blocks in `data/pct-data.js`:

| Block | Purpose |
|---|---|
| `vatsimDepartures` | VATSIM rows: `[scratchpad, SID, gate, airport, altitude, handoff to, note, transit?]` |
| `departures` | Real-world App. E routes → scratchpads |
| `depChains` | Handoff chains (steps: `from`, `to`, `alt`, `req`, `note`) |
| `depRouteChains` | Real-world route → chain ID |
| `atis` | ATIS airports and feed endpoints |
| `me` | vNAS / VATSIM feed endpoints for My Position |

## Live data sources

| Feed | Used for | Refresh |
|---|---|---|
| `https://data.vatsim.net/v3/afv-atis-data.json` | VATSIM ATIS | 120 s |
| `https://atis.info/api/KXXX` | Real-world D-ATIS | 120 s |
| `https://live.env.vnas.vatsim.net/data-feed/controllers.json` | My Position (CID lookup, secondary positions) | 30 s |
| `https://data.vatsim.net/v3/vatsim-data.json` | My Position fallback for non-vNAS clients (Pages only) | 30 s |

Inside Claude, the page reads these feeds through the Claude desktop app's built-in browser.

## Run locally

Open `index.html` directly, or run `python3 -m http.server` in the repo root and browse to `http://localhost:8000`.

## Sources

- vZDC-PCT-P-01G, Potomac TRACON SOP (Dec 2025)
- PCT 7110.65H CHG 1 (redacted) — Appendix E (scratchpads), Appendix J (frequencies), Ch. 5–8 sector tables
- vZDC ATCT SOPs (DCA, BWI, IAD, RIC), DC SFRA procedures, PCT-ZNY and PHL-PCT LOAs
- vZDC-B-20260710B (vCCS)
