/* =====================================================================
   PCT PLAYBOOK — DATA FILE
   All reference content lives here. Edit tables in this file; the page
   renders whatever is in window.PCT. No build step required.
   Source tags: "65H J-x" = PCT 7110.65H Appendix J, "65H B-x" = Appendix B.
   ===================================================================== */
window.PCT = {
  meta: {
    title: "Potomac TRACON Playbook",
    facility: "PCT",
    artcc: "ZDC",
    version: "0.1.0",
    updated: "2026-10-31",
  },

  /* ---------------- My Position (CID tracking) ---------------- */
  me: {
    // vNAS controller feed: primary AND secondary positions for CRC users (regenerates every 15 s)
    vnasEndpoint: "https://live.env.vnas.vatsim.net/data-feed/controllers.json",
    // Fallback for non-vNAS clients (primary callsign/frequency only). GitHub Pages only — too large for in-Claude reads.
    vatsimEndpoint: "https://data.vatsim.net/v3/vatsim-data.json",
    refreshSec: 30,
    facility: "PCT",
  },

  /* ---------------- ATIS cards (top of page) ---------------- */
  atis: {
    airports: ["KIAD", "KDCA", "KBWI"],
    // VATSIM ATIS-only feed (small) — [{callsign,frequency,atis_code,text_atis,last_updated}]
    vatsimEndpoint: "https://data.vatsim.net/v3/afv-atis-data.json",
    // Real-world D-ATIS — [{airport,type,code,datis,time}]  (same source as the LGA Playbook)
    realWorldEndpoint: "https://atis.info/api/",
    refreshSec: 120,
  },

  /* ---------------- Areas of specialization ---------------- */
  areas: [
    {
      id: "chp", code: "CHP", name: "Chesapeake", primary: "BWI",
      primaryName: "Baltimore/Washington Intl Thurgood Marshall",
      color: "#4fc3f7",
      satellites: ["ANP","APG","DMW","EDG","ESN","FDK","FME","GAI","MD43","MD95","MTN","RJD","W29","W42","W48","W50","9W8","0W3","1W5","2W2","3W3","6W6"],
      notes: "DEALE (MTV) issues ATIS/Runway Transition for BWI arrivals. FDK is shared with SHD for ATIS/advance approach info.",
    },
    {
      id: "jrv", code: "JRV", name: "James River", primary: "RIC",
      primaryName: "Richmond International",
      color: "#ffb74d",
      satellites: ["APH","CHO","FCI","FYJ","GVE","LKU","OFP","OMH","PTB","SHD","VA39","VBW","W13","W96","XSA"],
      notes: "When PXT Approach is closed, JRV controls the Patuxent satellites (65H Table B-5-4).",
    },
    {
      id: "shd", code: "SHD", name: "Shenandoah", primary: "IAD",
      primaryName: "Washington Dulles International",
      color: "#81c784",
      satellites: ["CJR","EZF","FDK","FRR","HEF","HGR","HWY","JYO","MRB","NYG","OKV","RMN","W05","W35","2VA9"],
      notes: "30 OP arrival bank: SHD must open the Arrival Coordinator (65H 7-25-4).",
    },
    {
      id: "mtv", code: "MTV", name: "Mount Vernon", primary: "DCA",
      primaryName: "Ronald Reagan Washington National",
      color: "#e57373",
      satellites: ["ADW","CGS","DAA","NDY","NSF","VKX","W00","2W5"],
      notes: "First MTV position to work an aircraft enters scratchpad data. \"DCA\" scratchpad auto-clears when MTV takes the track (65H 8-2-2).",
    },
  ],

  /* ---------------- Radar sectors (65H Appendix J) ----------------
     role: ARR | DEP | FINAL | SAT | SFRA | MIX   (fill in / correct as you learn)
     ---------------------------------------------------------------- */
  sectors: [
    // Chesapeake — Table J-1-1
    { area: "CHP", name: "PALEO",  vhf: "133.75",  uhf: "254.35",  ia: "104", role: "" },
    { area: "CHP", name: "GRACO",  vhf: "124.55",  uhf: "317.425", ia: "106", role: "ARR", note: "Ensures ATIS/RWY transition for DCA & ADW arrivals (with WOOLY)" },
    { area: "CHP", name: "BWIFN",  vhf: "119.0",   uhf: "282.275", ia: "107", role: "FINAL" },
    { area: "CHP", name: "BELAY",  vhf: "125.525", uhf: "291.625", ia: "108", role: "" },
    { area: "CHP", name: "BWIFS",  vhf: "119.7",   uhf: "290.475", ia: "110", role: "FINAL" },
    { area: "CHP", name: "WOOLY",  vhf: "128.7",   uhf: "307.9",   ia: "111", role: "ARR", note: "Ensures ATIS/RWY transition for DCA & ADW arrivals (with GRACO)" },
    { area: "CHP", name: "BUFFR",  vhf: "133.85",  uhf: "254.25",  ia: "113", role: "" },
    { area: "CHP", name: "SFRA-E", vhf: "132.775", uhf: "350.325", ia: "114", role: "SFRA" },
    { area: "CHP", name: "CHP DD", vhf: "126.9 FDK/ESN · 121.8 MTN · 121.6 GAI", uhf: "", ia: "103", role: "SAT", note: "Clearance delivery" },

    // James River — Table J-2-1
    { area: "JRV", name: "CHOWE",  vhf: "132.85",  uhf: "323.125", ia: "206", role: "" },
    { area: "JRV", name: "CHOEA",  vhf: "120.525", uhf: "323.125", ia: "207", role: "" },
    { area: "JRV", name: "FLTRK",  vhf: "126.75",  uhf: "307.2",   ia: "209", role: "" },
    { area: "JRV", name: "RICFR",  vhf: "118.2",   uhf: "288.275", ia: "210", role: "FINAL" },
    { area: "JRV", name: "TAPPA",  vhf: "126.4",   uhf: "282.375", ia: "211", role: "" },
    { area: "JRV", name: "CSIDW",  vhf: "135.625", uhf: "269.625", ia: "212", role: "", note: "Ensures ATIS/RWY transition for ADW arrivals" },
    { area: "JRV", name: "CSIDE",  vhf: "127.2",   uhf: "281.475", ia: "326", role: "" },
    { area: "JRV", name: "JRV DATA", vhf: "124.6 FCI · 125.4 OFP · 127.25 OXB · 118.35 SHD", uhf: "", ia: "203", role: "SAT", note: "Clearance delivery" },

    // Shenandoah — Table J-3-1
    { area: "SHD", name: "BRSTO",  vhf: "120.825", uhf: "284.625", ia: "304", role: "" },
    { area: "SHD", name: "IADFW",  vhf: "135.775", uhf: "306.925", ia: "305", role: "FINAL" },
    { area: "SHD", name: "IADFC",  vhf: "134.2",   uhf: "306.925", ia: "306", role: "FINAL" },
    { area: "SHD", name: "IADFE",  vhf: "125.8",   uhf: "306.925", ia: "307", role: "FINAL" },
    { area: "SHD", name: "SFRA-W", vhf: "127.325", uhf: "236.775", ia: "308", role: "SFRA" },
    { area: "SHD", name: "BARIN",  vhf: "128.52",  uhf: "306.925", ia: "309", role: "ARR" },
    { area: "SHD", name: "MANNE",  vhf: "120.45",  uhf: "306.925", ia: "311", role: "ARR" },
    { area: "SHD", name: "TILLY",  vhf: "126.65",  uhf: "350.2",   ia: "312", role: "" },
    { area: "SHD", name: "ASPER",  vhf: "125.05",  uhf: "350.2",   ia: "313", role: "" },
    { area: "SHD", name: "LUCKE",  vhf: "126.825", uhf: "239.025", ia: "314", role: "ARR" },
    { area: "SHD", name: "MULRR",  vhf: "126.1",   uhf: "338.25",  ia: "315", role: "ARR" },
    { area: "SHD", name: "BINNS",  vhf: "133.0",   uhf: "288.35",  ia: "327", role: "ARR" },
    { area: "SHD", name: "SHD DATA", vhf: "118.55 JYO · 132.075 MRB · 120.2 HEF · 126.15 OKV", uhf: "", ia: "303", role: "SAT", note: "Clearance delivery" },

    // Mount Vernon — Table J-4-1
    { area: "MTV", name: "OJAAY",  vhf: "119.85",  uhf: "239.25",  ia: "408", role: "ARR" },
    { area: "MTV", name: "DCAFR",  vhf: "124.7",   uhf: "338.2",   ia: "410", role: "FINAL" },
    { area: "MTV", name: "ENSUE",  vhf: "124.2",   uhf: "360.8",   ia: "411", role: "ARR" },
    { area: "MTV", name: "DEALE",  vhf: "128.35",  uhf: "270.275", ia: "412", role: "", note: "Ensures ATIS/RWY transition for BWI arrivals" },
    { area: "MTV", name: "SFRAS",  vhf: "125.125", uhf: "291.775", ia: "413", role: "SFRA" },
    { area: "MTV", name: "TYSON",  vhf: "118.95",  uhf: "257.2",   ia: "416", role: "" },
    { area: "MTV", name: "FLUKY",  vhf: "121.05",  uhf: "343.7",   ia: "417", role: "" },
    { area: "MTV", name: "KRANT",  vhf: "125.65",  uhf: "348.725", ia: "418", role: "" },
    { area: "MTV", name: "ADWAR",  vhf: "128.0",   uhf: "335.5",   ia: "116", role: "" },
    { area: "MTV", name: "LURAY",  vhf: "118.67",  uhf: "323.175", ia: "414", role: "ARR", note: "Ch. 8 table; not listed in J-4-1" },
  ],

  /* Default MTV position combining (65H Fig. 8-1-1) — top-down: who absorbs whom */
  combines: {
    MTV: [
      ["KRANT", "TYSON", "FLUKY", "ADWAR", "DEALE"],
      ["OJAAY", "ENSUE", "LURAY"],
      ["DCAFR"],
    ],
  },

  /* ---------------- Tower frequencies (65H Table J-6-x) ---------------- */
  towers: [
    { area: "CHP", fac: "BWI Local 1",  freq: "119.4 / 257.8" },
    { area: "CHP", fac: "BWI Local 2",  freq: "123.75 / 257.8" },
    { area: "CHP", fac: "BWI ATIS",     freq: "127.8 / 115.1" },
    { area: "CHP", fac: "MTN Tower",    freq: "121.3 / 297.2" },
    { area: "CHP", fac: "MTN ATIS",     freq: "124.925" },
    { area: "CHP", fac: "APG Tower",    freq: "126.15 / 229.6" },
    { area: "CHP", fac: "APG ATIS",     freq: "108.4" },
    { area: "CHP", fac: "ESN Tower",    freq: "118.525" },
    { area: "CHP", fac: "FDK Tower",    freq: "132.4" },
    { area: "JRV", fac: "RIC Local",    freq: "121.1 / 257.8" },
    { area: "JRV", fac: "RIC ATIS",     freq: "119.15 / 263.025" },
    { area: "JRV", fac: "CHO Tower",    freq: "124.5 / 338.27" },
    { area: "JRV", fac: "CHO ATIS",     freq: "118.425" },
    { area: "JRV", fac: "NHK",          freq: "123.7 / 343.65" },
    { area: "JRV", fac: "SBY",          freq: "119.425" },
    { area: "JRV", fac: "WAL",          freq: "126.5 / 306.975" },
    { area: "SHD", fac: "IAD Local West (LC3)",   freq: "134.425 / 348.6" },
    { area: "SHD", fac: "IAD Local Center (LC2)", freq: "120.25 / 348.6" },
    { area: "SHD", fac: "IAD Local East (LC1)",   freq: "120.1 / 317.8" },
    { area: "SHD", fac: "IAD ATIS",     freq: "134.85" },
    { area: "SHD", fac: "HEF",          freq: "133.1 / 360.75" },
    { area: "SHD", fac: "MRB",          freq: "124.3 / 236.6" },
    { area: "SHD", fac: "HGR",          freq: "120.3" },
    { area: "MTV", fac: "DCA Local",    freq: "119.1 / 257.6" },
    { area: "MTV", fac: "DCA Helo",     freq: "134.35 / 257.6" },
    { area: "MTV", fac: "DCA ATIS",     freq: "132.65" },
    { area: "MTV", fac: "ADW Local",    freq: "118.4 / 349.0 / 285.475" },
    { area: "MTV", fac: "DAA Tower",    freq: "126.3 / 229.4" },
    { area: "MTV", fac: "DAA ATIS",     freq: "128.175 / 230.0" },
  ],

  /* ---------------- Adjacent facilities (65H Table J-7-1) ---------------- */
  adjacent: [
    { fac: "ZDC", sector: "AZALEA/31",      freq: "135.4 / 263.1" },
    { fac: "ZDC", sector: "BLUE RIDGE/15",  freq: "133.65 / 285.6" },
    { fac: "ZDC", sector: "CALVERT/11",     freq: "133.9 / 281.4" },
    { fac: "ZDC", sector: "CAPE CHARLES/23",freq: "132.55 / 236.82" },
    { fac: "ZDC", sector: "CASANOVA/02",    freq: "133.2 / 282.2" },
    { fac: "ZDC", sector: "DOMINION/21",    freq: "118.75 / 377.1" },
    { fac: "ZDC", sector: "DUPONT/18",      freq: "132.52 / 307.25" },
    { fac: "ZDC", sector: "FRANKLIN/33",    freq: "132.02 / 290.425" },
    { fac: "ZDC", sector: "HAGERSTOWN/06",  freq: "134.15 / 227.125" },
    { fac: "ZDC", sector: "HOT SPRINGS/29", freq: "134.4 / 353.9" },
    { fac: "ZDC", sector: "IRONS/14",       freq: "132.95 / 360.8" },
    { fac: "ZDC", sector: "KENTON/53",      freq: "132.05 / 354.15" },
    { fac: "ZDC", sector: "LINDEN/05",      freq: "133.55 / 322.55" },
    { fac: "ZDC", sector: "MONTEBELLO/60",  freq: "121.67 / 284.7" },
    { fac: "ZDC", sector: "SWANN/17",       freq: "134.5 / 360.7" },
    { fac: "ZNY", sector: "LANCASTER",      freq: "133.17 / 292.125" },
    { fac: "ZNY", sector: "MODENA",         freq: "135.45 / 335.6" },
    { fac: "ZNY", sector: "MIDDLETOWN",     freq: "132.2 / 322.4" },
    { fac: "PHL", sector: "South Arrival",  freq: "133.875 / 317.55" },
    { fac: "PHL", sector: "Dupont",         freq: "118.35 / 323.1" },
    { fac: "PHL", sector: "North Departure",freq: "124.35 / 323.1" },
    { fac: "PHL", sector: "North Arrival",  freq: "128.4 / 273.57" },
    { fac: "PHL", sector: "South High",     freq: "126.2 / 343.725" },
    { fac: "PXT", sector: "NHK West",       freq: "120.05 / 281.8" },
    { fac: "PXT", sector: "NHK East",       freq: "127.95 / 314.0" },
    { fac: "ORF", sector: "West Feeder",    freq: "119.45 / 360.6" },
    { fac: "ORF", sector: "East Feeder",    freq: "126.05 / 370.925" },
    { fac: "ORF", sector: "Midnight Config",freq: "118.9 / 353.7" },
    { fac: "ORF", sector: "Peninsula",      freq: "125.7 / 395.8" },
    { fac: "NYG", sector: "Approach",       freq: "127.05 / 290.375" },
    { fac: "NYG", sector: "Tower",          freq: "118.6 / 360.2" },
    { fac: "ROA", sector: "Approach",       freq: "135.0 / 254.32" },
    { fac: "MDT", sector: "Harrisburg",     freq: "124.1 / 273.52" },
    { fac: "MDT", sector: "Lancaster",      freq: "126.45 / 281.52" },
    { fac: "DOV", sector: "Approach",       freq: "132.425 / 257.875" },
    { fac: "JST", sector: "RAPCON",         freq: "135.975 / 244.875" },
  ],

  /* ---------------- Quick-reference procedures ----------------
     Short "rule cards". Add more as you work through the SOP chapters.
     ------------------------------------------------------------ */
  procedures: [
    {
      title: "ATIS broadcast responsibility",
      ref: "65H 3-2-11",
      tags: ["ATIS", "All Areas"],
      body: [
        "MTV: OJAAY, ENSUE, LURAY, DCAFR broadcast DCA ATIS changes.",
        "CHP: BWIFN, BWIFS, BELAY, BUFFR, GRACO, PALEO broadcast BWI ATIS changes.",
        "JRV: all radar positions.",
        "SHD: MANNE, BARIN, MULRR, BINNS, IADFW, IADFE, IADFC, LUCKE.",
        "WOOLY/GRACO ensure ATIS + RWY transition for DCA/ADW arrivals; DEALE for BWI; CSIDW for ADW.",
        "FDK: both SHD and CHP count as the landing area.",
      ],
    },
    {
      title: "Reduced separation on final — 2.5 NM",
      ref: "65H 3-2-12",
      tags: ["Separation", "MTV", "SHD"],
      body: [
        "Authorized between aircraft established on final within 10 NM of the landing runway.",
        "DCA: RWY 1.",
        "IAD: RWYs 1L, 1C/19C, 1R/19L, 12.",
      ],
    },
    {
      title: "Approaches to multiple runways",
      ref: "65H 3-2-13",
      tags: ["Arrivals"],
      body: ["Inform arrivals when approaches are in use to parallel/intersecting/converging runways. ATIS may satisfy this."],
    },
    {
      title: "Combining positions",
      ref: "65H 3-2-14 / 3-2-15",
      tags: ["Staffing"],
      body: [
        "Call-forward all combined RDVS positions to the active control position.",
        "Active position monitors every frequency normally monitored by the closed position.",
      ],
    },
    {
      title: "IAD 30 OP arrival coordinator",
      ref: "65H 7-25-4",
      tags: ["SHD", "IAD"],
      body: [
        "During a 30 OP arrival bank SHD opens the Arrival Coordinator unless extenuating circumstances prevent it.",
        "Coordinator manages workload and flow to RWY 30 with the approach sectors.",
        "IADFW hands off to IADFE no faster than 210 KT.",
      ],
    },
    {
      title: "vCCS landlines (vZDC)",
      ref: "vZDC-B-20260710B",
      tags: ["VATSIM", "Coordination"],
      body: [
        "vCCS replaces v-VSCS; simulates RDVS (terminal) and VSCS (enroute).",
        "TeamSpeak remains the official coordination method and presence is required even when using vCCS.",
        "Set the \"vCCS\" server group on your TeamSpeak name when using it.",
        "Bulletin effective 23 Aug 2026, expires 31 Dec 2026.",
      ],
    },
  ],

  /* ---------------- Reference documents ---------------- */
  references: [
    { name: "PCT 7110.65H CHG 1 (redacted)", kind: "Real-world SOP", note: "Study reference only" },
    { name: "vZDC-DCA-P-01D — DCA ATCT SOP", kind: "vZDC SOP" },
    { name: "vZDC-BWI-P-01H — BWI ATCT SOP", kind: "vZDC SOP" },
    { name: "IAD ATCT SOP Version I", kind: "vZDC SOP" },
    { name: "RIC ATCT SOP Version B", kind: "vZDC SOP" },
    { name: "VATSIM DC SFRA Procedures", kind: "vZDC Procedure" },
    { name: "ZNY / PCT-ZNY LOA", kind: "LOA" },
    { name: "ZNY / PHL-PCT LOA", kind: "LOA" },
    { name: "vZDC-B-20260710B — vCCS Implementation", kind: "Bulletin", note: "Expires 31 Dec 2026" },
  ],
};
