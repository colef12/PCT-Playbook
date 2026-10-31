/* PCT Playbook — renderer + ATIS feeds */
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
     FETCH LAYER
     GitHub Pages / local file: plain fetch().
     Inside Claude (window.claude.use exists): fetch is blocked, so open the
     URL in the desktop app's built-in browser and read the page text.
     ================================================================= */
  const NET = (() => {
    const HOST = "host:claude_browser";
    const DIRECT = !(window.claude && typeof window.claude.use === "function");
    let mcp = null, tabId = null, ready = null, queue = Promise.resolve();

    const resultText = (r) => !r ? "" : typeof r.payload === "string" ? r.payload
      : ((r.content || []).find((c) => c.type === "text") || {}).text || "";
    const bodyOf = (t) => {
      let s = t; const i = s.indexOf("\n---\n"); if (i >= 0) s = s.slice(i + 5);
      const j = s.lastIndexOf("\n\nTab Context:"); if (j >= 0) s = s.slice(0, j);
      return s.trim();
    };
    const jsonOf = (t) => {
      const s = bodyOf(t), a = s.search(/[\[{]/), z = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
      if (a < 0 || z < a) throw new Error("no JSON on page");
      return JSON.parse(s.slice(a, z + 1));
    };
    async function init() {
      if (DIRECT) return true;
      try { mcp = await window.claude.use("mcp"); } catch (_) { mcp = null; }
      return !!mcp;
    }
    async function openUrl(url) {
      if (tabId) { try { await mcp.callTool(HOST, "navigate", { tabId, url }, { cache: false }); return; } catch (_) { tabId = null; } }
      const r = await mcp.callTool(HOST, "preview_start", { url }, { cache: false });
      const m = resultText(r).match(/tabId[:\s]+([\w-]+)/); tabId = m ? m[1] : null;
    }
    async function viaBrowser(url, max) {
      await openUrl(url);
      const read = async () => resultText(await mcp.callTool(HOST, "get_page_text", tabId ? { tabId, max_chars: max } : { max_chars: max }, { cache: false }));
      let txt = await read();
      for (let i = 0; i < 2 && !bodyOf(txt); i++) { await new Promise((r) => setTimeout(r, 1200)); txt = await read(); }
      return jsonOf(txt);
    }
    async function getJson(url, max = 200000) {
      ready = ready || init();
      if (!(await ready)) throw new Error("open this page in the Claude desktop app for live data");
      if (DIRECT) {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }
      // one browser tab: serialize requests
      const job = queue.then(() => viaBrowser(url, max));
      queue = job.catch(() => {});
      return job;
    }
    return { DIRECT, getJson };
  })();

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
        const time = a.last_updated ? a.last_updated.slice(11, 13) + a.last_updated.slice(14, 16) + "Z" : p.time;
        return { type, code: (a.atis_code || p.code || "").toUpperCase(), text, time, label: `VATSIM ${type === "combined" ? "" : type.toUpperCase() + " "}· ${a.callsign} · ${a.frequency}` };
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
      const p = primary ? parse(list.map((x) => x.text).join(" ")) : null;  // arr + dep ATIS combined for chips

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

    /* ---------- Polling: VATSIM ATIS feed + real-world D-ATIS ---------- */
    const statusEl = $("#atis-status"), refreshBtn = $("#atis-refresh");
    const setStatus = (msg, err) => { statusEl.textContent = msg; statusEl.classList.toggle("err", !!err); statusEl.classList.toggle("muted", !err); };
    const errText = (e) => (e && e.message === "Failed to fetch") ? "blocked/offline" : (e && (e.message || e.code)) || "error";
    let busy = false;

    async function refresh() {
      if (busy) return;
      busy = true; refreshBtn.disabled = true;
      const errs = [];
      try {
        setStatus("Reading VATSIM ATIS…");
        try {
          const list = await NET.getJson(A.vatsimEndpoint, 400000);
          const arr = Array.isArray(list) ? list : [];
          A.airports.forEach((apt) => {
            state[apt].vatsim = arr.filter((a) => new RegExp(`^${apt}(_[A-Z])?_ATIS$`).test((a.callsign || "").toUpperCase()))
              .sort((a, b) => a.callsign.localeCompare(b.callsign));
          });
        } catch (e) { errs.push(`VATSIM: ${errText(e)}`); console.warn("[PCT] VATSIM ATIS:", e); }
        renderAll();

        for (const apt of A.airports) {
          setStatus(`Reading real-world D-ATIS for ${apt}…`);
          try {
            const d = await NET.getJson(A.realWorldEndpoint + apt, 20000);
            state[apt].real = (Array.isArray(d) ? d : [d]).filter((x) => x && x.datis);
            state[apt].realErr = state[apt].real.length ? null : "no D-ATIS";
          } catch (e) {
            state[apt].realErr = errText(e); errs.push(`${apt}: ${errText(e)}`);
            console.warn(`[PCT] D-ATIS ${apt}:`, e);
          }
          render(apt);
        }
        const summary = A.airports.map((apt) => {
          const s = state[apt];
          return `${apt.slice(1)} ${s.vatsim.length ? "VATSIM" : "—"}/${s.real.length ? "RW" : "—"}`;
        }).join(" · ");
        setStatus(`Read ${new Date().toISOString().slice(11, 16)}Z · ${summary}${errs.length ? " · " + errs.join("; ") : ""}`, errs.length === A.airports.length + 1);
      } finally {
        busy = false; refreshBtn.disabled = false;
      }
    }
    refreshBtn.addEventListener("click", refresh);
    refresh();
    setInterval(refresh, Math.max(60, A.refreshSec) * 1000);

    return { parse, refresh }; // window.PCT_ATIS.parse(text) for console testing
  })();
  window.PCT_ATIS = ATIS;

})();
