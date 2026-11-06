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
