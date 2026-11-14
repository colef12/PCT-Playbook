/* CHP (Chesapeake) airspace — vZDC-PCT-P-01G (12/18/25)
   Overlays: SOP airspace figures (3-1-1, 4-1-3, 4-2-3/4, 4-3-3/4, 4-4-3/4) georeferenced to the
   vNAS ZDC "CHP Base" video map (similarity fit, mean residual <1 px) and warped to Web Mercator. */
window.CHP = {
  center: [39.2, -76.9], zoom: 9.5,
  overlays: {"buffr": [[39.07923, -78.17209], [39.70243, -76.85896]], "bwifs_e": [[38.7461, -77.13738], [39.50868, -76.22838]], "bwifs_w": [[38.75096, -76.97116], [39.50868, -75.97282]], "graco_e": [[38.51474, -76.71352], [39.57519, -75.65181]], "graco_w": [[38.51474, -76.67924], [39.5784, -75.65492]], "wooly_e": [[38.88617, -77.33684], [39.90441, -75.82218]], "wooly_w": [[38.93469, -77.34204], [39.90441, -75.81595]], "overview": [[38.51392, -78.17209], [39.90361, -75.65285]]},
  sectors: [
    { id:"BWIFS", stars:"1S", pos:"S", freq:"119.70", color:"#4fc3f7", flows:true, img:"bwifs", primary:true,
      combines:"Primary — all CHP sectors combine here",
      narrative:"Final for BWI. Receives RAVNN# arrivals from KRANT (MTV/1K) and arrivals from the other CHP sectors; hands BWI arrivals to BWI ATCT on final AOB 40.",
      towered:["BWI","MTN"], untowered:["3W3","ANP","FME","W29","W48"], ref:"4–2" },
    { id:"WOOLY", stars:"1W", pos:"W", freq:"128.70", color:"#ffb74d", flows:true, img:"wooly",
      combines:"→ BWIFS",
      narrative:"CLIPR#/SKILS# arrivals to DCA, TRISH# to BWI, ANTHM#/EMI# from BUFFR. Works BWI north and west departures.",
      towered:[], untowered:[], ref:"4–4",
      pacp:"KRANT (1K/MTV) may penetrate WOOLY 110–170 with IAD/sat departures via SWANN, PALEO, DOCTR, WHINO, BOOCK, COLIN." },
    { id:"GRACO", stars:"1G", pos:"G", freq:"124.55", color:"#ce93d8", flows:true, img:"graco",
      combines:"→ BWIFS",
      narrative:"Southern/southeastern CHP. DCA arrivals over BILIT (DEALE#), BWI arrivals over CHOPS (MIIDY#). Departures via SWANN, PALEO, COLIN.",
      towered:[], untowered:[], ref:"4–3" },
    { id:"BUFFR", stars:"1H", pos:"H", freq:"133.85", color:"#81c784", flows:false, img:"buffr",
      combines:"→ WOOLY",
      narrative:"ANTHM#/EMI# STARs from Linden (ZDC05), sequenced for WOOLY. Departures from ASPER, TYSON and WOOLY out MCRAY, JERES, BUFFR to ZDC05 at 170.",
      towered:[], untowered:[], ref:"4–1",
      pacp:"KRANT (1K/MTV) may penetrate BUFFR 110–170. BUFFR may penetrate MULRR (3M/SHD) at 110 on the EMI STAR." }
  ],
  sfra: { id:"SFRAE", stars:"1Z", pos:"Z", freq:"132.77", note:"Non-airspace position — tracks VFR in the east SFRA, issues codes, hands off with verbal coordination." },
  combine: [["BUFFR","WOOLY"],["WOOLY","BWIFS"],["GRACO","BWIFS"]],
  points: [
    ["BWI",39.1754,-76.6683,"apt"],["MTN",39.3257,-76.4138,"apt"],["APG",39.4662,-76.1688,"apt"],["ESN",38.8042,-76.0690,"apt"],
    ["FME",39.0854,-76.7594,"apt"],["ANP",38.9429,-76.5684,"apt"],["W29",38.9765,-76.3302,"apt"],["GAI",39.1683,-77.1660,"apt"],
    ["FDK",39.4176,-77.3743,"apt"],["DMW",39.6083,-77.0077,"apt"],["MRB",39.4019,-77.9845,"apt"],["HGR",39.7079,-77.7296,"apt"],
    ["DCA",38.8521,-77.0377,"apt"],["ADW",38.8108,-76.8670,"apt"],["IAD",38.9445,-77.4558,"apt"],
    ["EMI",39.4950,-76.9786,"nav"],["BAL",39.1709,-76.6614,"nav"]
  ]
};
