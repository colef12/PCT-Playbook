/* CHP page: georeferenced sector shelves on a Leaflet map */
(() => {
  const C = window.CHP; if (!C || !window.L) return;
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let map, flow = "e", areaLayer, ptsLayer;
  const on = Object.fromEntries(C.sectors.map((s) => [s.id, true]));
  const layers = {};      // key -> L.imageOverlay
  const pix = {};         // key -> {w,h,data}

  const key = (s) => (s.flows ? `${s.img}_${flow}` : s.img);
  function sampleLoad(k) {
    if (pix[k]) return;
    pix[k] = "loading";
    const im = new Image(); im.src = `assets/img/chp/chp_${k}.png`;
    im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0); pix[k] = { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
  }
  function overlay(k, z) {
    if (!layers[k]) {
      layers[k] = L.imageOverlay(`assets/img/chp/chp_${k}.png`, C.overlays[k], { opacity: 1, interactive: false, zIndex: z, className: "chp-ov" });
      sampleLoad(k);
    }
    return layers[k];
  }
  function render() {
    Object.values(layers).forEach((l) => map.hasLayer(l) && map.removeLayer(l));
    // draw biggest first so small/low shelves stay visible on top
    const order = ["GRACO", "BUFFR", "WOOLY", "BWIFS"];
    order.forEach((id, i) => { const s = C.sectors.find((x) => x.id === id); if (on[id]) overlay(key(s), 10 + i).addTo(map); });
    if ($("#chp-area").checked) overlay("overview", 5).addTo(map);
    $$cards();
  }
  function $$cards() {
    document.querySelectorAll(".chp-sec").forEach((el) => el.classList.toggle("off", !on[el.dataset.id]));
  }
  function inside(k, latlng) {
    const p = pix[k]; if (!p || p === "loading") return false;
    const b = C.overlays[k], a = map.options.crs.project(L.latLng(b[1][0], b[0][1])), z = map.options.crs.project(L.latLng(b[0][0], b[1][1]));
    const q = map.options.crs.project(latlng);
    const x = Math.floor((q.x - a.x) / (z.x - a.x) * p.w), y = Math.floor((q.y - a.y) / (z.y - a.y) * p.h);
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false;
    return p.d[(y * p.w + x) * 4 + 3] > 40;
  }
  function probe(e) {
    const hits = C.sectors.filter((s) => inside(key(s), e.latlng));
    const el = $("#chp-probe");
    el.innerHTML = `<div class="chp-sub">${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)} · ${flow === "e" ? "East" : "West"} flow</div>` +
      (hits.length ? hits.map((s) => `<div class="probe-row"><span class="sw" style="background:${s.color}"></span><b>${s.id}</b> <span class="mono">${s.stars}</span> <span class="mono freq">${s.freq}</span></div>`).join("")
        : `<div class="muted small">Outside CHP sector airspace</div>`) +
      `<div class="muted small">Read the shelf label on the map for floor/ceiling.</div>`;
    el.hidden = false;
  }
  function cards() {
    $("#chp-sectors").innerHTML = C.sectors.map((s) => `
      <div class="chp-card chp-sec" data-id="${s.id}" style="--sc:${s.color}">
        <div class="chp-sec-head">
          <label class="chp-tog"><input type="checkbox" checked data-tog="${s.id}"><span class="sw"></span></label>
          <span class="chp-name">${s.id}</span><span class="chp-id mono">${s.stars}</span>
          <span class="chp-freq mono">${s.freq}</span>
        </div>
        <div class="chp-meta small"><span class="muted">${esc(s.combines)}</span> · SOP ${s.ref}${s.flows ? " · E/W shapes" : ""}</div>
        <div class="chp-narr small">${esc(s.narrative)}</div>
        ${s.towered.length || s.untowered.length ? `<div class="small chp-apts">${s.towered.map((a) => `<b>${a}</b>`).join(" ")} ${s.untowered.join(" ")}</div>` : ""}
        ${s.pacp ? `<div class="small chp-pacp">P-ACP: ${esc(s.pacp)}</div>` : ""}
        <button class="chp-zoom small" data-zoom="${s.id}">Zoom ▸</button>
      </div>`).join("");
    const f = C.sfra;
    $("#chp-sfra").innerHTML = `<div class="chp-sec-head"><span class="chp-name">${f.id}</span><span class="chp-id mono">${f.stars}</span><span class="chp-freq mono">${f.freq}</span></div><div class="small muted">${esc(f.note)}</div>`;
    $("#chp-combine").innerHTML = `<span class="ctile" style="--sc:#81c784">BUFFR</span> → <span class="ctile" style="--sc:#ffb74d">WOOLY</span> → <span class="ctile" style="--sc:#4fc3f7">BWIFS</span><br><span class="ctile" style="--sc:#ce93d8">GRACO</span> → <span class="ctile" style="--sc:#4fc3f7">BWIFS</span>`;
    document.querySelectorAll("[data-tog]").forEach((cb) => cb.addEventListener("change", () => { on[cb.dataset.tog] = cb.checked; render(); }));
    document.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      const s = C.sectors.find((x) => x.id === b.dataset.zoom); map.fitBounds(C.overlays[key(s)], { padding: [20, 20] });
    }));
  }
  function points() {
    ptsLayer = L.layerGroup(C.points.map(([n, la, lo, t]) => L.marker([la, lo], { interactive: false,
      icon: L.divIcon({ className: "chp-pt " + t, html: `<i></i><span>${n}</span>`, iconSize: [0, 0] }) })));
    ptsLayer.addTo(map);
  }
  let built = false;
  function build() {
    if (built) { map.invalidateSize(); return; }
    built = true;
    map = L.map("chp-map", { zoomSnap: 0.25, preferCanvas: true }).setView(C.center, C.zoom);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16,
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ" }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, opacity: 0.6, pane: "shadowPane" }).addTo(map);
    cards(); points(); render();
    map.on("click", probe);
    document.querySelectorAll("#chp-flow .seg").forEach((b) => b.addEventListener("click", () => {
      flow = b.dataset.flow; document.querySelectorAll("#chp-flow .seg").forEach((x) => x.classList.toggle("on", x === b)); render();
    }));
    $("#chp-area").addEventListener("change", render);
    $("#chp-pts").addEventListener("change", (e) => e.target.checked ? ptsLayer.addTo(map) : map.removeLayer(ptsLayer));
  }
  const sec = document.querySelector('.view[data-view="chp"]');
  const check = () => { if (!sec.hidden) setTimeout(build, 0); };
  new MutationObserver(check).observe(sec, { attributes: true, attributeFilter: ["hidden"] });
  check();
})();
