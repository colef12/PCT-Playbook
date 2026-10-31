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

  /* ---------------- Areas ---------------- */
  $("#area-cards").innerHTML = D.areas.map((a) => `
    <article class="card area-card" ${areaStyle(a.code)}>
      <div><span class="area-code">${esc(a.code)}</span><span class="area-name">${esc(a.name)}</span></div>
      <div class="area-primary">Primary: <b>${esc(a.primary)}</b> — ${esc(a.primaryName)}</div>
      <h3>Satellites (${a.satellites.length})</h3>
      <div class="sat-list">${a.satellites.map((s) => `<span class="sat">${esc(s)}</span>`).join("")}</div>
      ${a.notes ? `<p class="area-notes">${esc(a.notes)}</p>` : ""}
    </article>`).join("");

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
    $$(".proc-card, .area-card").forEach((el) => {
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

    const atisPct = atisList.filter((a) => V.airports.some((apt) => a.callsign.startsWith(apt + "_")));
    $("#live-atis").innerHTML = atisPct.length
      ? atisPct.map((a) => `<div class="atis-item"><b>${esc(a.callsign)} ${esc(a.atis_code || "")}</b> · ${esc(a.frequency)}<br>${esc((a.text_atis || []).join(" "))}</div>`).join("")
      : '<span class="muted">No ATIS online.</span>';

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
