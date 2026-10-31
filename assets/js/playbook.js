/* PCT Playbook — renderer + VATSIM live feed */
(() => {
  "use strict";
  const D = window.PCT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const areaColor = Object.fromEntries(D.areas.map((a) => [a.code, a.color]));
  const areaStyle = (code) => `style="--area:${areaColor[code] || "var(--muted)"}"`;

  /* ---------------- Header / clock ---------------- */
  $("#version").textContent = `v${D.meta.version} · ${D.meta.updated}`;
  $("#footer-meta").textContent = `${D.meta.title} v${D.meta.version} — updated ${D.meta.updated}. Flight simulation use only.`;
  const tick = () => { $("#utc-clock").textContent = new Date().toISOString().slice(11, 19); };
  tick(); setInterval(tick, 1000);

  /* ---------------- Sectors ---------------- */
  $("#sector-table tbody").innerHTML = D.sectors.map((s) => `
    <tr data-area="${esc(s.area)}" data-sector="${esc(s.name)}">
      <td><span class="area-tag" ${areaStyle(s.area)}>${esc(s.area)}</span></td>
      <td class="mono"><b>${esc(s.name)}</b></td>
      <td class="freq">${esc(s.vhf)}</td>
      <td class="mono muted">${esc(s.uhf)}</td>
      <td class="mono muted">${esc(s.ia)}</td>
      <td>${s.role ? `<span class="role role-${esc(s.role)}">${esc(s.role)}</span>` : ""}</td>
      <td class="small">${esc(s.note || "")}</td>
    </tr>`).join("");

  // Area filter chips
  const activeAreas = new Set();
  $("#area-filter").innerHTML = D.areas.map((a) =>
    `<button class="chip" data-area="${a.code}" style="--chip:${a.color}">${a.code}</button>`).join("");
  $$("#area-filter .chip").forEach((btn) => btn.addEventListener("click", () => {
    const c = btn.dataset.area;
    activeAreas.has(c) ? activeAreas.delete(c) : activeAreas.add(c);
    btn.classList.toggle("on");
    applyFilters();
  }));

  /* ---------------- Combines ---------------- */
  $("#combine-wrap").innerHTML = Object.entries(D.combines).map(([area, rows]) => `
    <div class="card combine-area" ${areaStyle(area)}>
      <h3><span class="area-tag" ${areaStyle(area)}>${esc(area)}</span> default combine — first position absorbs the rest</h3>
      ${rows.map((r) => `<div class="combine-row">${r.map((p, i) =>
        `${i ? '<span class="arrow">◂</span>' : ""}<span class="pos">${esc(p)}</span>`).join("")}</div>`).join("")}
    </div>`).join("") || '<p class="muted">No combine data yet.</p>';

  /* ---------------- Towers / Adjacent / Refs ---------------- */
  $("#tower-table tbody").innerHTML = D.towers.map((t) => `
    <tr><td><span class="area-tag" ${areaStyle(t.area)}>${esc(t.area)}</span></td>
    <td>${esc(t.fac)}</td><td class="freq">${esc(t.freq)}</td></tr>`).join("");

  $("#adjacent-table tbody").innerHTML = D.adjacent.map((a) => `
    <tr><td class="mono"><b>${esc(a.fac)}</b></td><td>${esc(a.sector)}</td><td class="freq">${esc(a.freq)}</td></tr>`).join("");

  $("#ref-table tbody").innerHTML = D.references.map((r) => `
    <tr><td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</td>
    <td class="muted">${esc(r.kind)}</td><td class="small muted">${esc(r.note || "")}</td></tr>`).join("");

  /* ---------------- Procedures ---------------- */
  $("#proc-cards").innerHTML = D.procedures.map((p) => `
    <article class="card proc-card">
      <div class="proc-head"><span class="proc-title">${esc(p.title)}</span><span class="proc-ref">${esc(p.ref)}</span></div>
      <div class="proc-tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <ul class="proc-body">${p.body.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </article>`).join("");

  /* ---------------- Search + filters ---------------- */
  const search = $("#global-search");
  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    $$("table.filterable tbody tr").forEach((tr) => {
      const textOk = !q || tr.textContent.toLowerCase().includes(q);
      const areaOk = !tr.dataset.area || activeAreas.size === 0 || activeAreas.has(tr.dataset.area);
      tr.classList.toggle("hidden", !(textOk && areaOk));
    });
    $$(".proc-card").forEach((el) => {
      el.style.display = !q || el.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  }
  search.addEventListener("input", applyFilters);
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    if (e.key === "Escape" && document.activeElement === search) { search.value = ""; applyFilters(); search.blur(); }
  });

  // Active nav link on scroll
  const navLinks = $$(".nav a");
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${en.target.id}`));
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  $$("main .section").forEach((s) => obs.observe(s));

  /* =================================================================
     ATIS CARDS — VATSIM vs real-world D-ATIS
     Mode per airport: auto (VATSIM if online, else real world) | vatsim | real
     ================================================================= */
  const ATIS = (() => {
    const A = D.atis;
    const state = {};   // apt -> { mode, vatsim:[], real:[], pasted:null, pasteOpen, draft, realErr }
    A.airports.forEach((apt) => {
      let mode = "auto";
      try { mode = localStorage.getItem(`pct.atis.${apt}`) || "auto"; } catch (_) {}
      state[apt] = { mode, vatsim: [], real: [], pasted: null, pasteOpen: false, draft: "", realErr: null, scroll: 0 };
    });

    /* ---------- Parsing ---------- */
    const RWY = "[0-3]?\\d[LCR]?";
    const LIST = `${RWY}(?:(?:\\s*(?:,|\\bAND\\b|&|/)\\s*|\\s+(?=${RWY}\\b))${RWY})*`;
    const RW_WORD = "(?:RWYS?|RYS?|RUNWAYS?)";
    const normRwys = (s) => [...new Set((s.match(new RegExp(`\\b${RWY}\\b`, "g")) || []).map((r) => r.replace(/^0/, "")))];
    const apchRe = new RegExp(`\\b(ILS|RNAV|RNP|VISUAL|VIS|LOC|GPS|LDA)(?:\\s+[XYZW])?(?:\\s+(?:OR|AND)\\s+(?:ILS|RNAV|RNP|VISUAL|VIS)(?:\\s+[XYZW])?)?\\s+(?:APCHS?\\s+|APPROACH(?:ES)?\\s+)?(?:TO\\s+)?${RW_WORD}\\s+(${LIST})`, "g");
    const ldgRe = new RegExp(`\\b(?:LDG|LNDG|LANDING|LAND|LND|ARRIVALS?|ARR)\\s+${RW_WORD}\\s+(${LIST})`);
    const depRe = new RegExp(`\\b(?:DEPG|DEPTG|DEPARTING|DEPARTURES?|DEPART|DEPS?)\\s+${RW_WORD}\\s+(${LIST})`);

    function parse(raw) {
      const t = ` ${String(raw || "").toUpperCase().replace(/\s+/g, " ")} `;
      const out = { ldg: "", dep: "", wind: "", wx: "", code: "", time: "" };

      const PHON = "ALPHA|ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|INDIA|JULIET|JULIETT|KILO|LIMA|MIKE|NOVEMBER|OSCAR|PAPA|QUEBEC|ROMEO|SIERRA|TANGO|UNIFORM|VICTOR|WHISKEY|XRAY|X-RAY|YANKEE|ZULU";
      const c = t.match(/\b(?:INFO(?:RMATION)?|ATIS)\s+([A-Z])\b/) || t.match(new RegExp(`\\b(?:INFO(?:RMATION)?|ATIS)\\s+(${PHON})\\b`));
      if (c) out.code = c[1][0];
      const tm = t.match(/\b(\d{4})Z\b/) || t.match(/\b\d{2}(\d{4})Z\b/);
      if (tm) out.time = tm[1] + "Z";

      // Approaches / landing
      const ap = [];
      for (const m of t.matchAll(apchRe)) {
        const type = m[1] === "VISUAL" ? "VIS" : m[1];
        normRwys(m[2]).forEach((r) => ap.push(`${type} ${r}`));
      }
      if (ap.length) out.ldg = [...new Set(ap)].join(", ");
      else { const l = t.match(ldgRe); if (l) out.ldg = normRwys(l[1]).join(", "); }
      const d = t.match(depRe);
      if (d) out.dep = normRwys(d[1]).join(", ");

      // Wind (METAR group, then spelled-out)
      let w = t.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
      if (w) out.wind = `${w[1] === "VRB" ? "VRB" : w[1]}@${+w[2]}${w[3] ? "G" + +w[3] : ""} kt`;
      else if ((w = t.match(/\bWIND\s+(\d{3}|VARIABLE|CALM)(?:\s+AT\s+(\d+)(?:\s+GUSTS?(?:ING)?\s+(\d+))?)?/))) {
        out.wind = w[1] === "CALM" ? "calm" : `${w[1] === "VARIABLE" ? "VRB" : w[1]}@${+w[2] || 0}${w[3] ? "G" + +w[3] : ""} kt`;
      }
      if (/\b00000KT\b/.test(t)) out.wind = "calm";

      // Ceiling / visibility
      const ceil = t.match(/\b(BKN|OVC|VV)(\d{3})\b/);
      const vis = t.match(/\b((?:\d{1,2}\s)?\d\/\d|M1\/4|\d{1,2})SM\b/) || t.match(/\bVISIBILITY\s+(\d{1,2}(?:\s\d\/\d)?|\d\/\d)\b/);
      const ceilTxt = ceil ? `${ceil[1]} ${(+ceil[2] * 100).toLocaleString()}` : "no ceiling";
      out.wx = `${ceilTxt} / ${vis ? vis[1] + " SM" : "— SM"}`;
      return out;
    }

    /* ---------- Source selection ---------- */
    const pick = (list) => list.find((x) => x.type === "combined") || list.find((x) => x.type === "arr") || list[0] || null;

    function vatsimEntries(apt) {
      return state[apt].vatsim.map((a) => {
        const text = (a.text_atis || []).join(" ");
        const cs = a.callsign.toUpperCase();
        const type = /_D_ATIS$/.test(cs) ? "dep" : /_A_ATIS$/.test(cs) ? "arr" : "combined";
        const p = parse(text);
        return { type, code: (a.atis_code || p.code || "").toUpperCase(), text, time: p.time, label: `VATSIM ${type === "combined" ? "" : type.toUpperCase() + " "}· ${a.callsign} · ${a.frequency}` };
      });
    }
    function realEntries(apt) {
      const s = state[apt];
      if (s.pasted) {
        const p = parse(s.pasted);
        return [{ type: "combined", code: p.code, text: s.pasted, time: p.time, label: "Pasted ATIS", pasted: true }];
      }
      return s.real.map((r) => ({
        type: r.type, code: (r.code || "").toUpperCase(), text: r.datis || "",
        time: r.time ? `${String(r.time).padStart(4, "0")}Z` : parse(r.datis).time,
        label: `D-ATIS ${r.type}`,
      }));
    }

    function cardHtml(apt) {
      const s = state[apt];
      const vat = vatsimEntries(apt), rw = realEntries(apt);
      const vP = pick(vat), rP = pick(rw);
      const showing = s.mode === "vatsim" ? "vatsim" : s.mode === "real" ? "real" : (vP ? "vatsim" : "real");
      const list = showing === "vatsim" ? vat : rw;
      const primary = pick(list);
      const p = primary ? parse(primary.text) : null;

      // Letter colour: compare VATSIM vs real world when both exist
      let match = "none";
      if (vP && rP && vP.code && rP.code) match = vP.code === rP.code ? "match" : "mismatch";
      const letters = list.map((x) => x.code).filter(Boolean);
      const letter = letters.length ? [...new Set(letters)].join("/") : "—";
      const matchTitle = match === "none" ? "Only one source available"
        : `VATSIM ${vP.code} vs real world ${rP.code}`;

      const badge = showing === "vatsim"
        ? '<span class="src-badge src-vatsim">VATSIM</span>'
        : `<span class="src-badge src-real">${primary?.pasted ? "PASTED" : "REAL WORLD"}</span>`;
      const sub = primary
        ? `${esc(primary.label)}${primary.time ? " · " + esc(primary.time) : ""}`
        : showing === "vatsim" ? "No VATSIM ATIS online" : (s.realErr ? `Real-world D-ATIS unavailable (${esc(s.realErr)})` : "Loading real-world D-ATIS…");

      const btn = (m, lbl) => `<button class="seg ${s.mode === m ? "on" : ""}" data-apt="${apt}" data-mode="${m}">${lbl}</button>`;
      const chip = (v) => v ? `<span class="wx-chip">${esc(v)}</span>` : "";
      const text = list.length
        ? list.map((x) => (list.length > 1 ? `[${x.type.toUpperCase()} ${x.code}] ` : "") + x.text).join("\n\n")
        : "";

      return `
        <article class="atis-card2 ${showing === "vatsim" ? "is-vatsim" : "is-real"}" data-apt="${apt}">
          <div class="atis-top">
            <div>
              <div class="atis-id"><span class="atis-icao">${apt}</span>${badge}</div>
              <div class="atis-sub">${sub}</div>
            </div>
            <div class="atis-code ${match}" title="${esc(matchTitle)}">${esc(letter)}</div>
          </div>
          <div class="seg-group">${btn("auto", "Auto")}${btn("vatsim", "VATSIM")}${btn("real", "Real world")}</div>
          ${p ? `<div class="wx-row">${chip(p.ldg && "LDG " + p.ldg)}${chip(p.dep && "DEP " + p.dep)}${chip(p.wind)}</div>
                 <div class="wx-row">${chip(p.wx)}</div>` : ""}
          ${text ? `<pre class="atis-text">${esc(text)}</pre>` : `<div class="atis-empty">No ${showing === "vatsim" ? "VATSIM" : "real-world"} ATIS available.</div>`}
          ${s.pasteOpen ? `
            <div class="paste-box">
              <textarea data-apt="${apt}" placeholder="Paste real-world ATIS text…">${esc(s.draft)}</textarea>
              <div class="paste-actions">
                <button class="seg on" data-act="apply" data-apt="${apt}">Use</button>
                <button class="seg" data-act="cancel" data-apt="${apt}">Cancel</button>
              </div>
            </div>` : `
            <div class="atis-foot">
              <button class="link-btn" data-act="paste" data-apt="${apt}">Paste ATIS</button>
              ${s.pasted ? `<button class="link-btn muted" data-act="clear" data-apt="${apt}">Clear pasted</button>` : ""}
            </div>`}
        </article>`;
    }

    const wrap = $("#atis-cards");
    function render(apt) {
      const el = wrap.querySelector(`[data-apt="${apt}"].atis-card2`);
      const pre = el?.querySelector(".atis-text");
      if (pre) state[apt].scroll = pre.scrollTop;
      const html = cardHtml(apt);
      if (el) el.outerHTML = html; else wrap.insertAdjacentHTML("beforeend", html);
      const pre2 = wrap.querySelector(`[data-apt="${apt}"].atis-card2 .atis-text`);
      if (pre2) pre2.scrollTop = state[apt].scroll;
    }
    // Skip re-render of a card while its paste box is open (keeps focus + draft)
    const renderAll = () => A.airports.forEach((apt) => { if (!state[apt].pasteOpen) render(apt); });
    A.airports.forEach(render);

    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-apt]"); if (!b) return;
      const apt = b.dataset.apt, s = state[apt];
      if (b.dataset.mode) {
        s.mode = b.dataset.mode;
        try { localStorage.setItem(`pct.atis.${apt}`, s.mode); } catch (_) {}
      } else if (b.dataset.act === "paste") { s.pasteOpen = true; s.draft = s.pasted || ""; }
      else if (b.dataset.act === "cancel") { s.pasteOpen = false; }
      else if (b.dataset.act === "clear") { s.pasted = null; }
      else if (b.dataset.act === "apply") {
        s.pasted = s.draft.trim() || null; s.pasteOpen = false;
        if (s.pasted && s.mode === "vatsim") s.mode = "real";
      }
      render(apt);
      if (s.pasteOpen) wrap.querySelector(`textarea[data-apt="${apt}"]`)?.focus();
    });
    wrap.addEventListener("input", (e) => {
      if (e.target.matches("textarea[data-apt]")) state[e.target.dataset.apt].draft = e.target.value;
    });

    /* ---------- Real-world D-ATIS polling ---------- */
    async function pollReal() {
      await Promise.all(A.airports.map(async (apt) => {
        try {
          const res = await fetch(A.realWorldEndpoint + apt, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          if (!Array.isArray(j)) throw new Error(j?.error || "no data");
          state[apt].real = j; state[apt].realErr = null;
        } catch (err) {
          state[apt].realErr = err.message === "Failed to fetch" ? "blocked/offline" : err.message;
          console.warn(`[PCT] D-ATIS ${apt}:`, err);
        }
      }));
      renderAll();
    }
    pollReal();
    setInterval(pollReal, Math.max(60, A.realWorldRefreshSec) * 1000);

    return {
      setVatsim(atisList) {
        A.airports.forEach((apt) => { state[apt].vatsim = atisList.filter((a) => a.callsign.toUpperCase().startsWith(apt + "_")); });
        renderAll();
      },
      parse, // exposed for console testing: ATIS parse via window.PCT_ATIS.parse(text)
    };
  })();
  window.PCT_ATIS = ATIS;

  /* ---------------- VATSIM live feed ---------------- */
  const V = D.vatsim;
  const FAC = { 0: "OBS", 1: "FSS", 2: "DEL", 3: "GND", 4: "TWR", 5: "APP", 6: "CTR" };
  const matchesAny = (cs, prefixes) => prefixes.some((p) => cs.startsWith(p));
  const since = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}m`;
  };
  const ctrlRow = (c) => `
    <li><span><span class="fac-badge">${FAC[c.facility] || "—"}</span><span class="cs">${esc(c.callsign)}</span></span>
    <span class="cs-meta">${esc(c.frequency)} · ${since(c.logon_time)}</span></li>`;
  const byFacThenCs = (a, b) => (b.facility - a.facility) || a.callsign.localeCompare(b.callsign);

  function setStatus(ok, text) {
    const el = $("#net-status");
    el.className = `pill ${ok ? "pill-ok" : "pill-err"}`;
    el.textContent = text;
  }

  function renderLive(data) {
    const ctrls = (data.controllers || []).filter((c) => c.facility > 0);
    const pct = ctrls.filter((c) => matchesAny(c.callsign, V.controllerPrefixes)).sort(byFacThenCs);
    const nbr = ctrls.filter((c) => matchesAny(c.callsign, V.neighborPrefixes)).sort(byFacThenCs);
    $("#live-pct").innerHTML = pct.length ? pct.map(ctrlRow).join("") : '<li class="muted">No PCT positions online.</li>';
    $("#live-neighbors").innerHTML = nbr.length ? nbr.map(ctrlRow).join("") : '<li class="muted">No neighbors online.</li>';

    // Light up online sectors in the sector table (matches sector name inside callsign, e.g. PCT_MANNE_APP)
    const onlineCs = pct.map((c) => c.callsign.toUpperCase());
    $$("#sector-table tbody tr").forEach((tr) => {
      const name = tr.dataset.sector.replace(/[^A-Z]/g, "");
      tr.style.boxShadow = onlineCs.some((cs) => cs.replace(/[^A-Z_]/g, "").split("_").includes(name)) ? "inset 3px 0 0 var(--accent)" : "";
    });

    const atisList = data.atis || [];
    const pilots = data.pilots || [];
    $("#live-airports").innerHTML = V.airports.map((apt) => {
      const atis = atisList.filter((a) => a.callsign.startsWith(apt + "_"));
      const letters = atis.map((a) => a.atis_code).filter(Boolean).join("/") || "—";
      const dep = pilots.filter((p) => p.flight_plan?.departure === apt && p.groundspeed < 50).length;
      const arr = pilots.filter((p) => p.flight_plan?.arrival === apt && p.groundspeed >= 50).length;
      return `<tr><td class="mono"><b>${apt}</b></td><td><span class="atis-letter">${esc(letters)}</span></td>
        <td class="mono">${dep}</td><td class="mono">${arr}</td></tr>`;
    }).join("");

    ATIS.setVatsim(atisList);

    const upd = data.general?.update_timestamp;
    $("#live-updated").textContent = `Feed ${upd ? upd.slice(11, 19) + "Z" : "—"} · ${pct.length} PCT · ${nbr.length} nbr · ${(data.pilots || []).length} pilots network-wide`;
    setStatus(true, `VATSIM ● ${pct.length} PCT`);
  }

  async function poll() {
    try {
      const res = await fetch(V.feed, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderLive(await res.json());
    } catch (err) {
      console.warn("[PCT] VATSIM feed error:", err);
      setStatus(false, "VATSIM offline");
      $("#live-updated").textContent = `Feed error: ${err.message}`;
    }
  }
  poll();
  setInterval(poll, Math.max(15, V.refreshSec) * 1000);
})();
