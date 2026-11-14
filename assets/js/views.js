/* Top page buttons: Dashboard | MTV | SHD | CHP | JRV | COMB */
(() => {
  const VIEWS = ["dashboard", "mtv", "shd", "chp", "jrv", "comb"];
  const btns = document.querySelectorAll("#views .view-btn");
  const pages = document.querySelectorAll(".view[data-view]");

  function show(v, push) {
    if (!VIEWS.includes(v)) v = "dashboard";
    pages.forEach((p) => { p.hidden = p.dataset.view !== v; });
    btns.forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    document.body.dataset.view = v;
    try { localStorage.setItem("pct-view", v); } catch (e) {}
    const url = new URL(location.href);
    if (v === "dashboard") url.searchParams.delete("view"); else url.searchParams.set("view", v);
    url.hash = "";
    history[push ? "pushState" : "replaceState"]({ view: v }, "", url);
    if (push) window.scrollTo(0, 0);
  }

  btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.view, true)));
  window.addEventListener("popstate", (e) => show(e.state?.view || new URL(location.href).searchParams.get("view") || "dashboard", false));

  const fromUrl = new URL(location.href).searchParams.get("view");
  let saved = null; try { saved = localStorage.getItem("pct-view"); } catch (e) {}
  const start = fromUrl || (location.hash ? "dashboard" : saved) || "dashboard";
  // keep any #section anchor when landing on the dashboard
  const hash = location.hash;
  show(start, false);
  if (start === "dashboard" && hash) history.replaceState({ view: start }, "", hash);
})();
