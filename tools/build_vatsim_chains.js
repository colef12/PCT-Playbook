// Rebuilds window.PCT.vatsimDepartures in data/pct-data.js: every row gets a full handoff chain (vZDC-PCT-P-01G).
const fs = require("fs");
const FILE = process.argv[2];
const src = fs.readFileSync(FILE, "utf8");
global.window = {}; eval(src); const V = window.PCT.vatsimDepartures;

const S = (from, to, alt, note, req) => { const o = { from, to }; if (alt) o.alt = alt; if (req) o.req = req; if (note) o.note = note; return o; };
// ---- segments ----
const TY_Z32_MTV = S("MTV - TYSON", "ZDC32", "FL210", "SHD/MTV in trail as one. ORF arrivals at 150.");
const TY_Z32_CHP = S("MTV - TYSON", "ZDC32", "FL230", "From CHP (BWI deps).");
const TY_Z05_CHP = S("MTV - TYSON", "ZDC05", "FL230", "From CHP (BWI deps).");
const TY_BUF = () => S("MTV - TYSON", "CHP - BUFFR", "AOA 100 ↑170", "On SID or direct HORTO. Control for turns NW of AML R-050. (TBL 4-1-4a lists AOA 110.)");
const BUF_Z05 = S("CHP - BUFFR", "ZDC05", "170", "On course.");
const TY_LUR = S("MTV - TYSON", "MTV - LURAY", "AOA 120 ↑170", "Jet. From MTV via RAMAY/OTTTO; non-RNAV via LDN, J134, J149, etc.");
const LUR_Z05 = S("MTV - LURAY", "ZDC05", "170", "All deps via RAMAY/OTTTO.");
const KR_Z17_SWN = S("MTV - KRANT", "ZDC17", "FL190", "DCA/SHD via SWANN. In trail as one, on the route.");
const KR_Z17_DCR = S("MTV - KRANT", "ZDC17", "170", "DCA/SHD via DOCTR. In trail as one, on the route. PHL arrivals to CHP-PALEO at 110.");
const KR_Z17_AGA = S("MTV - KRANT", "ZDC17", "190", "AGARD not listed in TBL 4-13-5b. 190 = East gate top (TBL 6-4-11).");
const KR_Z12 = S("MTV - KRANT", "ZDC12", "FL190", "DCA/SHD/CHP via COLIN/AMEEE. ORF arrivals at 140. (ADW via COLIN/AMEEE: 170.)");
const AS_TY = S("SHD - ASPER", "MTV - TYSON", "100", "Direct BUTRZ (CLTCH#) / POOCH (SCRAM#) / HAFNR (JDUBB#). TYSON control for turns leaving 80.");
const BA_AS_GAB = S("SHD - BARIN", "SHD - ASPER", "↑50", "GABBE# on SID, non-RNAV on vector.");
const BA_AS_HII = S("SHD - BARIN", "SHD - ASPER", "↑30", "HIICH#. Control for turns.");
const BA_AS_ARS = S("SHD - BARIN", "SHD - ASPER", "", "ARSNL# climb via SID (TBL 3-4-10). BARIN→ASPER handoff altitude not listed in P-01G.");
const AS_LUR = S("SHD - ASPER", "MTV - LURAY", "100", "On SID or direct RNLDI/BUNZZ.");
const AS_LUR_HII = S("SHD - ASPER", "MTV - LURAY", "100", "HIICH# RAMAY/OTTTO.");
const AS_BUF = S("SHD - ASPER", "CHP - BUFFR", "110", "Direct IDORE (JERES#) / HAYGR (MCRAY#) to join SID. BUFFR has control for turns to right leaving 80 (TBL 4-1-4a).");
const AS_BUF_HII = S("SHD - ASPER", "CHP - BUFFR", "110", "HIICH# MCRAY/JERES. BUFFR has control for turns. BUFFR has control for turns to right leaving 80 (TBL 4-1-4a).");
const AS_BUF_MRB = S("SHD - ASPER", "CHP - BUFFR", "110", "Direct MRB. BUFFR has control for turns to right leaving 80 (TBL 4-1-4a).", "Req. 110–170 (4-1-4a: req AOA 110)");
const MU_BUF = S("SHD - MULRR", "CHP - BUFFR", "110", "FDK is a MULRR satellite (TBL 3-4-10). No MULRR→BUFFR row; 110 per TBL 3-4-2 (SHD + SATs).");
const AS_WOO = S("SHD - ASPER", "CHP - WOOLY", "110", "Direct RAZZA to join. WOOLY has control for turns and climb to 110. (100 Tprop / AOB 70 prop)");
const AS_WOO_HII = S("SHD - ASPER", "CHP - WOOLY", "110", "HIICH# on SID. WOOLY has control for turn. (TBL 4-17-5b lists BUFFR; 4-4-5a and 3-4-2 list WOOLY.)");
const AS_WOO_NR = S("SHD - ASPER", "CHP - WOOLY", "AOB 110", "Non-RNAV: vector to join radial. WOOLY has control for turns. AOB 100 Tprop / AOB 70 prop (TBL 4-17-5b lists AOB 90 Tprop).");
const WOO_Z17 = S("CHP - WOOLY", "ZDC17", "150", "MTV/SHD via WOOLY.");
const AS_KR = S("SHD - ASPER", "MTV - KRANT", "100", "On SID, direct RIGNZ to join.");
const WOO_TY = S("CHP - WOOLY", "MTV - TYSON", "↑170", "Climb via SID to 170, on SID. TYSON control for left turns on contact.");
const GR_KR = S("CHP - GRACO", "MTV - KRANT", "AOA 110 ↑140", "On SID or direct CONLE. Control for west turns on contact.");
const KR_TY = S("MTV - KRANT", "MTV - TYSON", "FL190", "FIXET# on SID. TYSON control for turns on contact.");
const WOO_BUF = S("CHP - WOOLY", "CHP - BUFFR", "AOA 120 ↑160", "LINSE# climb via SID. Control for turns and climbs west of WOOLY intersection.");

const C = (top, ref, ...steps) => ({ top, ref, steps });
function chain(area, [sp, proc, gate, apt]) {
  const g = gate;
  switch (proc) {
    // ---------- BWI (CHP) ----------
    case "DUKPN#": return sp === "SWN"
      ? C("140", "TBL 3-1-2 · 4-3-2", S("CHP - GRACO", "ZDC17", "140", "DUKPN# climb via SID. Props via BROSS: 140 or lower requested."))
      : C("140", "TBL 3-1-2", S("CHP", "ZDC17", "140", "DUKPN# climb via SID. Props via AGARD: 140 or lower requested. Handing-off CHP sector not named in P-01G."));
    case "FIXET#": return /OTTTO|RAMAY/.test(g)
      ? C("230", "TBL 3-1-2 · 4-13-5 · 4-16-6b", GR_KR, KR_TY, TY_Z05_CHP)
      : C("230", "TBL 3-1-2 · 4-13-5 · 4-16-6b", GR_KR, KR_TY, TY_Z32_CHP);
    case "TERPZ#": return C("230", "TBL 3-1-2 · 4-4-5b · 4-16-6b", WOO_TY, TY_Z32_CHP);
    case "FOXHL#": return C("230", "TBL 3-1-2 · 4-4-5b · 4-16-6b", WOO_TY, TY_Z05_CHP);
    case "CONLE#": return C("190", "TBL 3-1-2 · 4-3-5b · 4-13-5b", GR_KR, S("MTV - KRANT", "ZDC12", "FL190", "DCA/SHD/CHP via COLIN/AMEEE."));
    case "LINSE#": return apt === "FDK"
      ? C("170", "TBL 3-4-10 · 3-4-2 · 4-1-4b", MU_BUF, BUF_Z05)
      : C("170", "TBL 4-4-5b · 4-1-4b", WOO_BUF, BUF_Z05);
    // ---------- DCA / ADW (MTV) ----------
    case "HORTO#": return C("170", "TBL 3-3-2 · 4-16-6b · 4-1-4b", TY_BUF(), BUF_Z05);
    case "LINCN#": return /OTTTO|RAMAY/.test(g)
      ? C("170", "TBL 4-16-6b · 4-14-4 · 6-4-11", TY_LUR, LUR_Z05)
      : C("170", "TBL 3-3-2 · 4-16-6b · 4-1-4b", TY_BUF(), BUF_Z05);
    case "REBLL#": case "WYNGS#": return C("170", "TBL 4-16-6b · 4-14-4 · 6-4-11", TY_LUR, LUR_Z05);
    case "CLTCH#": case "JDUBB#": case "SCRAM#": case "JEFSN#":
      return apt === "IAD" ? C("210", "TBL 3-4-2 · 4-17-5b · 4-16-6b", AS_TY, TY_Z32_MTV)
                           : C("210", "TBL 3-3-2 · 4-16-6b", TY_Z32_MTV);
    case "GABBE#": return C("210", "TBL 4-17-5a/b · 4-16-6b", BA_AS_GAB, AS_TY, TY_Z32_MTV);
    case "SOOKI#": return C("190", "TBL 3-3-2 · 4-13-5b", KR_Z17_SWN);
    case "DOCTR#": return C("170", "TBL 3-3-2 · 4-13-5b", KR_Z17_DCR);
    case "AMEEE#": return C("190", "TBL 3-3-2 · 4-13-5b", KR_Z12);
    // ---------- IAD / HEF / FDK / JYO (SHD) ----------
    case "JCOBY#":
      if (/AGARD/.test(g)) return C("190", "TBL 3-4-2 · 4-17-5b · 6-4-11", AS_KR, KR_Z17_AGA);
      if (/COLIN/.test(g)) return C("190", "TBL 3-4-2 · 4-17-5b · 4-13-5b", AS_KR, KR_Z12);
      return C("190", "TBL 3-4-2 · 4-17-5b · 4-13-5b", AS_KR, KR_Z17_SWN);
    case "RNLDI#": case "BUNZZ#": return C("170", "TBL 3-4-2 · 4-17-5b · 4-14-4b", AS_LUR, LUR_Z05);
    case "JERES#": case "MCRAY#": return C("170", "TBL 3-4-2 · 4-17-5b · 4-1-4b", AS_BUF, BUF_Z05);
    case "WOOLY#": return C("150", "TBL 3-4-2 · 4-17-5b · 3-1-2", AS_WOO, WOO_Z17);
    case "HIICH#":
      if (/OTTTO|RAMAY/.test(g)) return C("170", "TBL 4-17-5a/b · 4-14-4b", BA_AS_HII, AS_LUR_HII, LUR_Z05);
      if (/WOOLY/.test(g)) return C("150", "TBL 4-17-5a · 4-4-5a · 3-4-2 · 3-1-2", BA_AS_HII, AS_WOO_HII, WOO_Z17);
      return C("170", "TBL 4-17-5a/b · 4-1-4b", BA_AS_HII, AS_BUF_HII, BUF_Z05);
    case "ARSNL#":
      if (g === "MRB") return C("170", "TBL 3-4-10 · 4-17-5b · 4-1-4", BA_AS_ARS, AS_BUF_MRB, BUF_Z05);
      if (g === "WOOLY") return C("150", "TBL 3-4-10 · 4-4-5a · 3-1-2", BA_AS_ARS, AS_WOO_NR, WOO_Z17);
      if (g === "GVE") return C("", "TBL 3-4-10 · 4-17-5b", BA_AS_ARS, S("SHD - ASPER", "MTV - TYSON", "100", "Non-RNAV HAFNR..GVE on course. Control for turns leaving 80. TYSON exit altitude not in P-01G."));
      if (/MOL|WITTO/.test(g)) return C("", "TBL 3-4-10 · 4-17-5b", BA_AS_ARS, S("SHD - ASPER", "MTV - TYSON", "100", "Non-RNAV FLUKY..MOL on course. Control for turns leaving 80. TYSON exit altitude not in P-01G."));
      if (g === "CSN") return C("", "TBL 3-4-10 · 4-17-5b", S("SHD - BARIN", "ZDC", "", "ARSNL# CSN: exit handoff and altitude not in P-01G. ASPER→BARIN via CSN/FLUKY is AOB 100 (req AOB 120), TBL 4-17-5b."));
      break;
    case "PTOMC#": return C("", "TBL 3-4-10", S("JYO ATCT", "SHD - ASPER", "Climb via SID", "PTOMC#. Exit route and altitude not in P-01G. Verify route."));
    // ---------- RIC (JRV) ----------
    case "COLIN#": case "LUCYL#": return C("120", "TBL 3-2-2 · 6-4-11", S("JRV", "ZDC12", "120", "RIC deps assigned 120, 100 or lower requested (3-2-2a). Handing-off JRV sector not named in P-01G."));
    case "KALLI#": case "READE#": return C("120", "TBL 3-2-2 · 6-4-11", S("JRV", "ZDC32", "120", "RIC deps assigned 120, 100 or lower requested (3-2-2a). Handing-off JRV sector not named in P-01G."));
  }
  throw new Error(`no chain for ${area} ${sp} ${proc} ${gate} ${apt}`);
}

const fixes = [];
for (const a of Object.keys(V)) for (const r of V[a].rows) {
  // row-level corrections
  if (a === "CHP" && r[1] === "LINSE#" && r[3] === "BWI/FDK/MTN") { r[3] = "BWI/MTN"; fixes.push("CHP LINSE# BWI/FDK/MTN → BWI/MTN (FDK is the SHD transit row)"); }
  if (a === "MTV" && !r[7] && /OTTTO|RAMAY/.test(r[2])) { r[5] = "LURAY"; r[6] = "AOA 120 ↑170 to LURAY · LURAY → ZDC05 170"; fixes.push(`MTV ${r[0]} ${r[1]} handoff ZDC05 → LURAY`); }
  if (a === "MTV" && !r[7] && r[0] === "BFR") r[6] = "AOA 100 ↑170, control for turns NW of AML R-050";
  const from = r[7]?.from;
  const c = chain(a, r);
  const o = {}; if (from) o.from = from; if (c.top) o.top = c.top; o.ref = c.ref; o.steps = c.steps;
  r[7] = o;
}
// serialise
const ser = (r) => "      " + JSON.stringify(r).replace(/^\[/, "[").replace(/","/g, '", "').replace(/",\{/, '", {');
let out = "  vatsimDepartures: {\n";
for (const a of Object.keys(V)) {
  const d = V[a];
  const nat = d.rows.filter((r) => !r[7].from), tr = d.rows.filter((r) => r[7].from);
  out += `    ${a}: { ref: ${JSON.stringify(d.ref)}, note: ${JSON.stringify(d.note)}, rows: [\n`;
  out += nat.map(ser).join(",\n") + (nat.length ? ",\n" : "");
  if (tr.length) out += "      // ---- transiting departures (from other areas) ----\n" + tr.map(ser).join(",\n") + ",\n";
  out += "    ]},\n";
}
out += "  },\n";
const start = src.indexOf("  vatsimDepartures: {");
const end = src.indexOf("  /* PCT exit (top) altitudes");
const tail = src.slice(start, end); const close = tail.lastIndexOf("  },\n");
const res = src.slice(0, start) + out + tail.slice(close + 4) + src.slice(end);
fs.writeFileSync(FILE, res);
console.log(fixes.join("\n"));
