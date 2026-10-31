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

  /* ---------------- PCT Departures (scratchpad → top altitude) ----------------
     Toggle: VATSIM (vZDC-PCT-P-01G QRG 6-2 + area departure tables) | Real world (65H App. E)
     -------------------------------------------------------------------------- */
  (() => {
    const allAreas = ["MTV", "SHD", "CHP", "JRV"];
    let order = allAreas;
    let mode = "vatsim", hideJrv = false;
    try { mode = localStorage.getItem("pct.dep.mode") || "vatsim"; hideJrv = localStorage.getItem("pct.dep.hideJrv") === "1"; } catch (_) {}
    $("#dep-hide-jrv").checked = hideJrv;
    const altHtml = (v, to) => {
      const s = String(v ?? "").trim();
      if (!s) return '<span class="dep-alt none">—</span>';
      return `<span class="dep-alt">${esc(s)}${to ? `<small>${esc(to)}</small>` : ""}</span>`;
    };
    const head = (a, count, sub) => {
      const name = D.areas.find((x) => x.code === a)?.name || a;
      return `<div class="dep-head"><span class="area-tag" ${areaStyle(a)}>${a}</span>
        <span class="dep-name">${esc(name)}</span><span class="dep-meta mono">${count}</span></div>
        <div class="dep-sub muted small">${sub}</div>`;
    };

    function renderReal() {
      return order.filter((a) => D.departures[a]).map((a) => {
        const dep = D.departures[a], alts = D.depAlt?.[a] || {};
        const groups = new Map();
        dep.routes.forEach(([r, sp]) => { if (!groups.has(sp)) groups.set(sp, []); groups.get(sp).push(r); });
        const sps = [...groups.keys()].sort((x, y) => x.localeCompare(y));
        const filled = sps.filter((sp) => String(alts[sp] ?? "").trim()).length;
        return `<div class="dep-col" data-area="${a}" ${areaStyle(a)}>
          ${head(a, `${sps.length} SP · ${filled}/${sps.length} alt`, `65H Table ${esc(dep.table)}${dep.note ? " · " + esc(dep.note) : ""}`)}
          <div class="dep-list">
            <div class="dep-row dep-th"><span>SP</span><span>Route / Fix</span><span>ALT</span></div>
            ${sps.map((sp) => `<div class="dep-row" data-q="${esc((sp + " " + groups.get(sp).join(" ")).toUpperCase())}">
                <span class="dep-sp">${esc(sp)}</span>
                <span class="dep-routes">${groups.get(sp).map(esc).join("<br>")}</span>
                ${altHtml(alts[sp])}</div>`).join("")}
          </div></div>`;
      }).join("");
    }

    function renderVatsim() {
      return order.filter((a) => D.vatsimDepartures?.[a]).map((a) => {
        const dep = D.vatsimDepartures[a];
        const groups = new Map();
        dep.rows.forEach((r) => { if (!groups.has(r[0])) groups.set(r[0], []); groups.get(r[0]).push(r); });
        const sps = [...groups.keys()].sort((x, y) => x.localeCompare(y));
        return `<div class="dep-col" data-area="${a}" ${areaStyle(a)}>
          ${head(a, `${sps.length} SP · ${dep.rows.length} routes`, `vZDC ${esc(dep.ref)}`)}
          <div class="dep-list">
            <div class="dep-row dep-th"><span>SP</span><span>SID · Gate · Apt</span><span>ALT</span></div>
            ${sps.map((sp) => {
              const rows = groups.get(sp);
              const q = (sp + " " + rows.map((r) => r.slice(1).join(" ")).join(" ")).toUpperCase();
              return `<div class="dep-row v" data-q="${esc(q)}">
                <span class="dep-sp">${esc(sp)}</span>
                <div class="dep-lines">${rows.map(([, proc, gate, apt, alt, to, note]) => `
                  <div class="dep-line">
                    <div class="dep-routes"><b>${esc(proc)}</b> ${esc(gate)} <span class="dep-apt">${esc(apt)}</span>
                      ${note ? `<div class="dep-rnote">${esc(note)}</div>` : ""}</div>
                    ${altHtml(alt, to)}
                  </div>`).join("")}</div>
              </div>`;
            }).join("")}
          </div></div>`;
      }).join("");
    }

    function render() {
      order = hideJrv ? allAreas.filter((a) => a !== "JRV") : allAreas;
      $("#dep-cols").classList.toggle("three", hideJrv);
      $$("#dep-mode .seg").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
      $("#dep-src").textContent = mode === "vatsim" ? "vZDC-PCT-P-01G · QRG 6–2 + area dep tables" : "PCT 7110.65H · App. E";
      $("#dep-cols").innerHTML = mode === "vatsim" ? renderVatsim() : renderReal();
      filter();
      if (window.PCT_ME?.lastAreas) $$("#dep-cols .dep-col").forEach((c) => c.classList.toggle("mine", window.PCT_ME.lastAreas.has(c.dataset.area)));
    }
    function filter() {
      const q = $("#dep-search").value.trim().toUpperCase();
      $$("#dep-cols .dep-row:not(.dep-th)").forEach((r) => { r.hidden = !!q && !r.dataset.q.includes(q); });
    }
    $("#dep-search").addEventListener("input", filter);
    $("#dep-hide-jrv").addEventListener("change", (e) => {
      hideJrv = e.target.checked;
      try { localStorage.setItem("pct.dep.hideJrv", hideJrv ? "1" : "0"); } catch (_) {}
      render();
    });
    $("#dep-mode").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]"); if (!b) return;
      mode = b.dataset.mode;
      try { localStorage.setItem("pct.dep.mode", mode); } catch (_) {}
      render();
    });
    render();
  })();

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

  /* =================================================================
     MY POSITION — find the user's CID on the network, list every
     position they hold (vNAS primary + secondaries), map to PCT sectors/areas.
     ================================================================= */
  const ME = (() => {
    const M = D.me;
    const cidEl = $("#me-cid"), statusEl = $("#me-status"), detailEl = $("#me-detail"), focusEl = $("#me-focus");
    let cid = "", focus = false, last = null, busy = false;
    try { cid = localStorage.getItem("pct.me.cid") || ""; focus = localStorage.getItem("pct.me.focus") === "1"; } catch (_) {}
    cidEl.value = cid; focusEl.checked = focus;

    const letters = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
    const firstFreq = (s) => { const m = String(s || "").match(/\d{3}\.\d{1,3}/); return m ? (+m[0]).toFixed(3) : ""; };
    // vNAS frequencies may arrive in Hz (120450000), kHz, or MHz strings — normalise to "120.450"
    const mhz = (f) => {
      const n = +String(f ?? "").replace(/[^\d.]/g, "");
      if (!n) return "";
      return (n > 1e6 ? n / 1e6 : n > 1e3 ? n / 1e3 : n).toFixed(3);
    };
    const pick = (o, ...keys) => { for (const k of keys) { const v = k.split(".").reduce((a, p) => a?.[p], o); if (v !== undefined && v !== null && v !== "") return v; } return undefined; };

    const sectorIndex = D.sectors.map((s) => ({ s, key: letters(s.name), freq: firstFreq(s.vhf) }));
    const towerIndex = D.towers.map((t) => ({ t, freq: firstFreq(t.freq) }));

    function matchSector(name, freq, callsign) {
      const n = letters(name);
      let hit = n && sectorIndex.find((x) => x.key === n || (n.length >= 5 && (n.startsWith(x.key) || x.key.startsWith(n))));
      if (!hit && callsign) { const parts = String(callsign).toUpperCase().split("_").map(letters); hit = sectorIndex.find((x) => parts.includes(x.key)); }
      if (!hit && freq) hit = sectorIndex.find((x) => x.freq === freq);
      return hit ? hit.s : null;
    }

    /* ---- Normalise a vNAS controller entry ---- */
    function fromVnas(c) {
      const vd = c.vatsimData || {};
      const positions = (c.positions || []).map((p) => ({
        name: pick(p, "positionName", "name") || "",
        facility: pick(p, "facilityId", "facility.id") || "",
        callsign: pick(p, "defaultCallsign", "callsign") || "",
        radio: pick(p, "radioName") || "",
        freq: mhz(pick(p, "frequency")),
        primary: !!pick(p, "isPrimary"),
        active: pick(p, "isActive") !== false,
        stars: pick(p, "starsData.sectorId", "starsConfiguration.sectorId") || "",
      }));
      return {
        src: "vNAS",
        cid: String(pick(vd, "cid") ?? pick(c, "cid") ?? ""),
        callsign: pick(vd, "callsign") || pick(c, "callsign") || positions.find((p) => p.primary)?.callsign || "",
        freq: mhz(pick(vd, "primaryFrequency", "frequency")) || positions.find((p) => p.primary)?.freq || "",
        rating: pick(vd, "userRating", "rating") || "",
        facilityType: pick(vd, "facilityType") || "",
        logon: pick(c, "loginTime", "logonTime") || pick(vd, "loginTime") || "",
        artcc: pick(c, "artccId") || "",
        primaryFacility: pick(c, "primaryFacilityId") || "",
        observer: !!pick(c, "isObserver") || /OBS/i.test(pick(vd, "facilityType") || ""),
        positions,
      };
    }
    const RATINGS = { 1: "OBS", 2: "S1", 3: "S2", 4: "S3", 5: "C1", 7: "C3", 8: "I1", 10: "I3", 11: "SUP", 12: "ADM" };
    function fromVatsim(c) {
      return {
        src: "VATSIM", cid: String(c.cid), callsign: c.callsign, freq: mhz(c.frequency),
        rating: RATINGS[c.rating] || c.rating, facilityType: "", logon: c.logon_time, artcc: "", primaryFacility: "",
        observer: c.facility === 0,
        positions: [{ name: "", facility: "", callsign: c.callsign, radio: "", freq: mhz(c.frequency), primary: true, active: true, stars: "" }],
      };
    }

    /* ---- Resolve positions → PCT sectors / areas ---- */
    function resolve(me) {
      const rows = me.positions.filter((p) => p.active).map((p) => {
        const sec = matchSector(p.name, p.freq, p.callsign);
        const twr = !sec && p.freq ? towerIndex.find((x) => x.freq === p.freq)?.t : null;
        return { ...p, sector: sec, tower: twr, area: sec?.area || twr?.area || "" };
      });
      const areas = [...new Set(rows.map((r) => r.area).filter(Boolean))];
      return { rows, areas };
    }

    /* ---- Render ---- */
    const since = (iso) => {
      if (!iso) return "";
      const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
      return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
    };
    function setStatus(html, cls = "") { statusEl.innerHTML = html; statusEl.className = `me-status small ${cls}`; }

    function applyMine(res) {
      const mine = new Set((res?.rows || []).map((r) => r.sector?.name).filter(Boolean));
      $$("#sector-table tbody tr").forEach((tr) => tr.classList.toggle("mine", mine.has(tr.dataset.sector)));
      const myAreas = new Set(res?.areas || []);
      if (window.PCT_ME) window.PCT_ME.lastAreas = myAreas;
      $$("#dep-cols .dep-col").forEach((c) => c.classList.toggle("mine", myAreas.has(c.dataset.area)));
      // area focus → drive the existing area chips
      const want = focus && res?.areas.length ? new Set(res.areas) : null;
      $$("#area-filter .chip").forEach((btn) => {
        const on = want ? want.has(btn.dataset.area) : activeAreas.has(btn.dataset.area) && !btn.dataset.auto;
        if (want) btn.dataset.auto = "1"; else delete btn.dataset.auto;
        btn.classList.toggle("on", on);
        on ? activeAreas.add(btn.dataset.area) : activeAreas.delete(btn.dataset.area);
      });
      applyFilters();
      // pin procedure cards tagged with my areas
      const grid = $("#proc-cards");
      const cards = $$(".proc-card", grid);
      cards.forEach((c, i) => { c.dataset.order ??= i; });
      const areaNames = new Set((res?.areas || []).flatMap((a) => [a, D.areas.find((x) => x.code === a)?.name?.toUpperCase()]));
      cards.sort((a, b) => {
        const ma = $$(".tag", a).some((t) => areaNames.has(t.textContent.toUpperCase())) ? 0 : 1;
        const mb = $$(".tag", b).some((t) => areaNames.has(t.textContent.toUpperCase())) ? 0 : 1;
        return ma - mb || a.dataset.order - b.dataset.order;
      }).forEach((c) => { c.classList.toggle("mine", !!res && $$(".tag", c).some((t) => areaNames.has(t.textContent.toUpperCase()))); grid.appendChild(c); });
    }

    function render(me) {
      if (!me) { detailEl.hidden = true; applyMine(null); return; }
      const res = resolve(me);
      last = res;
      const areaChips = res.areas.map((a) => `<span class="area-tag big" ${areaStyle(a)}>${a} · ${esc(D.areas.find((x) => x.code === a)?.name || "")}</span>`).join("")
        || '<span class="muted small">No PCT area matched</span>';
      const posRows = res.rows.map((r) => `
        <tr class="${r.primary ? "prim" : "sec"}">
          <td>${r.primary ? '<span class="role role-FINAL">PRIMARY</span>' : '<span class="role">SECONDARY</span>'}</td>
          <td class="mono">${esc(r.name || r.callsign)}</td>
          <td class="freq">${esc(r.freq)}</td>
          <td class="mono">${r.sector ? `<b>${esc(r.sector.name)}</b>` : r.tower ? esc(r.tower.fac) : '<span class="muted">no match</span>'}</td>
          <td>${r.area ? `<span class="area-tag" ${areaStyle(r.area)}>${esc(r.area)}</span>` : ""}</td>
          <td class="mono muted">${esc(r.facility)}${r.stars ? " · " + esc(r.stars) : ""}</td>
        </tr>`).join("");
      detailEl.innerHTML = `
        <div class="me-head">
          <div><div class="me-cs">${esc(me.callsign)}</div>
            <div class="muted small mono">${esc(me.freq)} · ${esc(me.rating)}${me.logon ? " · on " + since(me.logon) : ""}${me.primaryFacility ? " · " + esc(me.primaryFacility) : ""} · via ${me.src}</div></div>
          <div class="me-areas">${areaChips}</div>
        </div>
        ${me.observer ? '<div class="me-warn small">Connected as observer — positions not staffed.</div>' : ""}
        ${me.src === "VATSIM" ? '<div class="me-warn small">Not found in vNAS feed — showing primary position only (secondary positions need CRC/vNAS).</div>' : ""}
        <div class="table-wrap"><table class="tbl tbl-compact">
          <thead><tr><th></th><th>Position</th><th>Freq</th><th>PCT Sector</th><th>Area</th><th>Fac · STARS</th></tr></thead>
          <tbody>${posRows || '<tr><td colspan="6" class="muted">No active positions.</td></tr>'}</tbody></table></div>`;
      detailEl.hidden = false;
      applyMine(res);
    }

    async function refresh() {
      if (!cid || busy) return;
      busy = true;
      try {
        let me = null, errs = [];
        try {
          const list = await NET.getJson(M.vnasEndpoint, 3000000);
          const arr = Array.isArray(list) ? list : (list?.controllers || list?.data || []);
          const hit = arr.find((c) => String(pick(c, "vatsimData.cid", "cid") ?? "") === cid);
          if (hit) me = fromVnas(hit);
        } catch (e) { errs.push(`vNAS: ${e.message || e}`); console.warn("[PCT] vNAS:", e); }

        if (!me && NET.DIRECT) {
          try {
            const d = await NET.getJson(M.vatsimEndpoint);
            const hit = (d.controllers || []).find((c) => String(c.cid) === cid);
            if (hit) me = fromVatsim(hit);
          } catch (e) { errs.push(`VATSIM: ${e.message || e}`); }
        }
        const t = new Date().toISOString().slice(11, 16) + "Z";
        if (me) setStatus(`<span class="dot on"></span> <b>${esc(cid)}</b> online · checked ${t}`, "ok-txt");
        else if (errs.length && errs.length >= (NET.DIRECT ? 2 : 1)) setStatus(`<span class="dot err"></span> ${esc(cid)} · feed error: ${esc(errs.join("; "))}`, "bad-txt");
        else setStatus(`<span class="dot"></span> <b>${esc(cid)}</b> not connected as ATC · checked ${t}`, "muted");
        render(me);
      } finally { busy = false; }
    }

    $("#me-form").addEventListener("submit", (e) => {
      e.preventDefault();
      cid = cidEl.value.replace(/\D/g, "");
      try { cid ? localStorage.setItem("pct.me.cid", cid) : localStorage.removeItem("pct.me.cid"); } catch (_) {}
      if (!cid) { setStatus("Enter your CID to track what you're signed in as.", "muted"); render(null); return; }
      setStatus(`Looking up ${esc(cid)}…`, "muted");
      refresh();
    });
    focusEl.addEventListener("change", () => {
      focus = focusEl.checked;
      try { localStorage.setItem("pct.me.focus", focus ? "1" : "0"); } catch (_) {}
      applyMine(last && !detailEl.hidden ? last : null);
    });

    if (cid) { setStatus(`Looking up ${esc(cid)}…`, "muted"); refresh(); }
    setInterval(refresh, Math.max(15, M.refreshSec) * (NET.DIRECT ? 1000 : 2000));
    return { refresh, fromVnas, resolve };
  })();
  window.PCT_ME = ME;

})();
