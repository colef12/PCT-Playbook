# PCT Playbook

**Live site: https://colef12.github.io/PCT-Playbook/**

Working playbook for **Potomac TRACON (PCT)** on the VATSIM network (vZDC). Static HTML, no build step, hosted on GitHub Pages.

> Flight simulation use only. Not for real-world navigation or ATC.

## Structure

```
index.html              Page shell and section layout
assets/css/playbook.css Theme (STARS-inspired dark)
assets/js/playbook.js   Renders data + polls the VATSIM feed
data/pct-data.js        ALL content: areas, sectors, freqs, procedures, refs
```

Content edits go in `data/pct-data.js` only — the page renders whatever is there.

## Live VATSIM data

`playbook.js` polls `https://data.vatsim.net/v3/vatsim-data.json` every 60 s (configurable: `vatsim.refreshSec`) and shows:

- PCT-family controllers online (prefixes in `vatsim.controllerPrefixes`)
- Neighbor facilities online (`vatsim.neighborPrefixes`)
- ATIS letter, departures on the ground, and airborne arrivals for `vatsim.airports`
- Sector rows light up green when a callsign containing that sector name is online (e.g. `PCT_MANNE_APP`)

## Enable GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save.
Site URL: `https://colef12.github.io/PCT-Playbook/`

## Run locally

Open `index.html` directly, or `python3 -m http.server` in the repo root and browse to `http://localhost:8000`.

## Sources

- PCT 7110.65H CHG 1 (redacted) — Appendix B (satellites), Appendix J (frequencies), Ch. 3/7/8
- vZDC ATCT SOPs (DCA, BWI, IAD, RIC), DC SFRA procedures, PCT-ZNY and PHL-PCT LOAs
- vZDC-B-20260710B (vCCS)
