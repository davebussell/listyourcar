/* ============================================================
   listyourcar.ca — the buyer map

   Every dealership in the network, drawn on a vector map of Canada.
   No mapping library and no tile server: the coastline is one 39KB
   file we ship ourselves, so the map costs a single request, works
   offline, and cannot be rate-limited out from under us.

   The dealer data is positioned by postal FSA, which is neighbourhood
   level, not street level. Several rooftops in the same FSA therefore
   share one point — so the map draws one bubble per position, sized by
   how many dealers sit there, rather than pretending to 4,441 distinct
   pinpoints it does not have.
   ============================================================ */

const BuyerMap = (() => {
  const state = {
    map: null,          // projected province paths
    net: null,          // { positions, dealers, brands }
    groups: [],         // one entry per position: { i, x, y, city, prov, dealers[] }
    brand: "",          // marque filter
    type: "all",        // all | franchise | independent
    selected: null,     // the group whose dealers are listed
    origin: null,       // the visitor's pinned location
    view: null,         // current viewBox [x, y, w, h]
    home: null,         // the default view, for Reset
  };

  const $m = (s, r = document) => r.querySelector(s);
  const num = (n) => Number(n).toLocaleString("en-CA");
  const rad = Math.PI / 180;
  /* Postal lookups name every neighbourhood in the district in
     parentheses — "Calgary (City Centre / Calgary Tower)". Keep the
     municipality for headings. */
  const shortPlace = (p) => String(p || "").replace(/\s*\([^)]*\)/g, "").trim();

  /* ---------- Projection ----------
     The same Lambert Conformal Conic the coastline was drawn with, so a
     dealer lands exactly where the province boundary says it should. */
  function project(lat, lon) {
    const p = state.map.proj;
    const rho = p.f / Math.pow(Math.tan(Math.PI / 4 + lat * rad / 2), p.n);
    const dl = (lon - p.lon0) * rad * p.n;
    return [
      (rho * Math.sin(dl) - p.minX) * p.scale,
      (p.maxY - (p.rho0 - rho * Math.cos(dl))) * p.scale,
    ];
  }

  const haversine = (a, b, c, d) => {
    const dLat = (c - a) * rad, dLon = (d - b) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  };

  /* ---------- Data ---------- */

  async function load() {
    const [map, net] = await Promise.all([
      fetch("/data/canada-map.json").then((r) => {
        if (!r.ok) throw new Error("map data unavailable");
        return r.json();
      }),
      DealerNet.load(),
    ]);
    state.map = map;
    state.net = net;

    // Roll the 4,441 dealers up onto their shared positions once.
    const byPos = new Map();
    net.dealers.forEach((row) => {
      const [name, pi, postal, phone, website, , brands] = row;
      if (!byPos.has(pi)) byPos.set(pi, []);
      byPos.get(pi).push({ name, postal, phone, website, brands: brands || [] });
    });
    state.groups = [...byPos.entries()].map(([pi, dealers]) => {
      const [city, prov, lat, lon] = net.positions[pi];
      const [x, y] = project(lat, lon);
      return { i: pi, x, y, lat, lon, city, prov, dealers };
    // Draw the dense points last so they sit on top of the sparse ones.
    }).sort((a, b) => a.dealers.length - b.dealers.length);
  }

  /* A group's dealers under the current filters. */
  function visible(g) {
    return g.dealers.filter((d) => {
      if (state.brand && !d.brands.includes(state.brand)) return false;
      if (state.type === "franchise" && !d.brands.length) return false;
      if (state.type === "independent" && d.brands.length) return false;
      return true;
    });
  }

  function filtered() {
    return state.groups
      .map((g) => ({ g, list: visible(g) }))
      .filter((x) => x.list.length);
  }

  /* ---------- Drawing ---------- */

  const SVG = "http://www.w3.org/2000/svg";
  const el = (n, attrs) => {
    const e = document.createElementNS(SVG, n);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function drawProvinces(root) {
    const g = el("g", { class: "bm-land" });
    state.map.provinces.forEach((p) => {
      const path = el("path", { d: p.d, class: "bm-prov", "data-prov": p.code });
      path.appendChild(el("title", {})).textContent = p.name;
      g.appendChild(path);
    });
    root.appendChild(g);
  }

  /* Radius by square root of count, so a bubble's *area* tracks the
     number of dealers. Scaling the radius directly would make Toronto
     look ten times the dealer count it actually has. */
  const radiusFor = (n) => Math.min(2.2 + Math.sqrt(n) * 2.4, 22);

  function drawBubbles(root) {
    const old = $m(".bm-dots", root);
    if (old) old.remove();
    const g = el("g", { class: "bm-dots" });
    filtered().forEach(({ g: grp, list }) => {
      const c = el("circle", {
        cx: grp.x.toFixed(1), cy: grp.y.toFixed(1), r: radiusFor(list.length).toFixed(1),
        class: "bm-dot" + (state.selected === grp ? " is-on" : ""),
        "data-pos": grp.i,
      });
      c.appendChild(el("title", {})).textContent =
        grp.city + ", " + grp.prov + " — " + list.length + (list.length === 1 ? " dealer" : " dealers");
      g.appendChild(c);
    });
    root.appendChild(g);
    return g;
  }

  function drawOrigin(root) {
    const old = $m(".bm-you", root);
    if (old) old.remove();
    if (!state.origin) return;
    const [x, y] = project(state.origin.lat, state.origin.lon);
    const g = el("g", { class: "bm-you" });
    g.appendChild(el("circle", { cx: x, cy: y, r: 16, class: "bm-you-halo" }));
    g.appendChild(el("circle", { cx: x, cy: y, r: 4.5, class: "bm-you-dot" }));
    root.appendChild(g);
  }

  /* ---------- Pan and zoom ---------- */

  function setView(v, animate) {
    const svg = $m("#bm-svg");
    state.view = v;
    if (animate) svg.classList.add("is-gliding");
    svg.setAttribute("viewBox", v.map((n) => n.toFixed(1)).join(" "));
    if (animate) setTimeout(() => svg.classList.remove("is-gliding"), 420);
    // Keep strokes and dots a constant size on screen as we zoom in.
    const k = v[2] / state.home[2];
    svg.style.setProperty("--bm-k", k.toFixed(3));
  }

  function zoomBy(factor, cx, cy) {
    const [x, y, w, h] = state.view;
    const [vb] = [state.map.viewBox];
    const nw = Math.min(Math.max(w * factor, vb[2] * 0.04), vb[2] * 1.6);
    const nh = nw * (h / w);
    // keep the point under the cursor fixed
    const px = cx == null ? x + w / 2 : cx;
    const py = cy == null ? y + h / 2 : cy;
    setView([px - (px - x) * (nw / w), py - (py - y) * (nh / h), nw, nh], cx == null);
  }

  function fitTo(x, y, w, h, pad = 1.25) {
    const svg = $m("#bm-svg");
    const box = svg.getBoundingClientRect();
    const aspect = box.width / box.height;
    let nw = w * pad, nh = h * pad;
    if (nw / nh > aspect) nh = nw / aspect; else nw = nh * aspect;
    setView([x + w / 2 - nw / 2, y + h / 2 - nh / 2, nw, nh], true);
  }

  function fitProvince(code) {
    const pts = state.groups.filter((g) => g.prov === code);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    fitTo(x, y, Math.max(...xs) - x, Math.max(...ys) - y, 1.35);
  }

  function wire(svg) {
    let drag = null;

    svg.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, view: [...state.view], moved: false };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add("is-dragging");
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const box = svg.getBoundingClientRect();
      const dx = (e.clientX - drag.x) * (state.view[2] / box.width);
      const dy = (e.clientY - drag.y) * (state.view[3] / box.height);
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      setView([drag.view[0] - dx, drag.view[1] - dy, drag.view[2], drag.view[3]]);
    });
    const endDrag = (e) => {
      if (drag) { try { svg.releasePointerCapture(e.pointerId); } catch {} }
      svg.classList.remove("is-dragging");
      setTimeout(() => { drag = null; }, 0);
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const box = svg.getBoundingClientRect();
      const [x, y, w, h] = state.view;
      const cx = x + ((e.clientX - box.left) / box.width) * w;
      const cy = y + ((e.clientY - box.top) / box.height) * h;
      zoomBy(e.deltaY > 0 ? 1.16 : 0.86, cx, cy);
    }, { passive: false });

    svg.addEventListener("click", (e) => {
      if (drag && drag.moved) return;          // a pan is not a click
      const dot = e.target.closest(".bm-dot");
      if (dot) { select(state.groups.find((g) => g.i === +dot.dataset.pos)); return; }
      const prov = e.target.closest(".bm-prov");
      if (prov) { fitProvince(prov.dataset.prov); return; }
    });
  }

  /* ---------- Side panel ---------- */

  function dealerRow(d, km) {
    const tags = d.brands.length ? d.brands.slice(0, 3).join(", ") : "Independent";
    const tel = d.phone
      ? '<a class="link-inline" href="tel:' + d.phone.replace(/[^0-9+]/g, "") + '">' + d.phone + "</a>"
      : "";
    const web = d.website
      ? '<a class="dealer-web" href="https://' + d.website + '" target="_blank" rel="noopener">' + d.website + "</a>"
      : "";
    return '<li class="bm-dealer">' +
      "<strong>" + d.name + "</strong>" +
      '<span class="bm-tags">' + tags + "</span>" +
      '<span class="bm-contact">' + [tel, web].filter(Boolean).join(" · ") + "</span>" +
      (km != null ? '<span class="bm-km">' + (km < 1 ? "&lt;1" : Math.round(km)) + "<i>km</i></span>" : "") +
      "</li>";
  }

  function select(g) {
    state.selected = g;
    drawBubbles($m("#bm-svg"));
    drawOrigin($m("#bm-svg"));
    renderPanel();
    if (g) fitTo(g.x - 40, g.y - 40, 80, 80, 1);
  }

  function renderPanel() {
    const host = $m("#bm-panel");
    if (!host) return;

    if (state.selected) {
      const g = state.selected;
      const list = visible(g);
      const km = state.origin
        ? haversine(state.origin.lat, state.origin.lon, g.lat, g.lon) : null;
      host.innerHTML =
        '<div class="bm-panel-head">' +
          '<span class="eyebrow">Selected</span>' +
          "<h3>" + g.city + ", " + g.prov + "</h3>" +
          '<p class="muted small">' + num(list.length) +
            (list.length === 1 ? " buyer" : " buyers") +
            (km != null ? " · " + Math.round(km) + " km from you" : "") + "</p>" +
          '<button type="button" class="link-btn" id="bm-clear">Back to all of Canada</button>' +
        "</div>" +
        '<ul class="bm-list">' + list.map((d) => dealerRow(d)).join("") + "</ul>";
      $m("#bm-clear").addEventListener("click", () => { select(null); resetView(); });
      return;
    }

    if (state.origin) {
      const near = [];
      filtered().forEach(({ g, list }) => {
        const km = haversine(state.origin.lat, state.origin.lon, g.lat, g.lon);
        list.forEach((d) => near.push({ d, km, g }));
      });
      near.sort((a, b) => a.km - b.km);
      const top = near.slice(0, 12);
      host.innerHTML =
        '<div class="bm-panel-head">' +
          '<span class="eyebrow">Closest to you</span>' +
          "<h3>" + (shortPlace(state.origin.place) || state.origin.label || "Your location") + "</h3>" +
          '<p class="muted small">Showing the ' + Math.min(top.length, near.length) +
            " closest of " + num(near.length) + " matching buyers</p>" +
        "</div>" +
        '<ul class="bm-list">' + top.map((n) => dealerRow(n.d, n.km)).join("") + "</ul>" +
        '<a class="btn btn-primary btn-sm bm-cta" href="/sell.html">List a car for these buyers</a>';
      return;
    }

    // Nothing pinned or selected: the province breakdown doubles as the
    // text alternative to the map for anyone not using a pointer.
    const byProv = {};
    filtered().forEach(({ g, list }) => { byProv[g.prov] = (byProv[g.prov] || 0) + list.length; });
    const rows = Object.entries(byProv).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 1;
    host.innerHTML =
      '<div class="bm-panel-head">' +
        '<span class="eyebrow">The network</span>' +
        "<h3>Buyers by province</h3>" +
        '<p class="muted small">Pick a province to zoom, or a bubble for the dealers there.</p>' +
      "</div>" +
      '<ul class="bm-provs">' + rows.map(([p, n]) =>
        '<li><button type="button" data-prov="' + p + '">' +
          '<span class="bm-p-code">' + p + "</span>" +
          '<span class="bm-p-bar"><i style="width:' + (n / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="bm-p-n">' + num(n) + "</span>" +
        "</button></li>").join("") +
      "</ul>";
    host.querySelectorAll("[data-prov]").forEach((b) =>
      b.addEventListener("click", () => fitProvince(b.dataset.prov)));
  }

  /* ---------- Filters and chrome ---------- */

  function renderFilters() {
    const host = $m("#bm-filters");
    if (!host) return;
    // Only marques that actually appear, most common first.
    const counts = {};
    state.groups.forEach((g) => g.dealers.forEach((d) =>
      d.brands.forEach((b) => { counts[b] = (counts[b] || 0) + 1; })));
    const brands = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 16);

    host.innerHTML =
      '<div class="bm-row"><span class="dp-label">Show</span><div class="chipbar">' +
        [["all", "All buyers"], ["franchise", "Franchised"], ["independent", "Independent"]].map((t) =>
          '<button type="button" class="fchip' + (state.type === t[0] ? " active" : "") +
          '" data-type="' + t[0] + '">' + t[1] + "</button>").join("") +
      "</div></div>" +
      '<div class="bm-row"><span class="dp-label">Marque</span><div class="chipbar">' +
        (state.brand ? '<button type="button" class="fchip dp-clear" data-brand="">Clear</button>' : "") +
        brands.map(([b, n]) =>
          '<button type="button" class="fchip' + (state.brand === b ? " active" : "") +
          '" data-brand="' + b + '">' + b + " <em>" + num(n) + "</em></button>").join("") +
      "</div></div>";

    host.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
      state.type = b.dataset.type; state.selected = null; refresh();
    }));
    host.querySelectorAll("[data-brand]").forEach((b) => b.addEventListener("click", () => {
      state.brand = b.dataset.brand; state.selected = null; refresh();
    }));
  }

  function renderCounts() {
    const shown = filtered().reduce((n, x) => n + x.list.length, 0);
    const places = filtered().length;
    const host = $m("#bm-count");
    if (host) {
      host.innerHTML =
        "<strong>" + num(shown) + "</strong> " + (shown === 1 ? "buyer" : "buyers") +
        " in <strong>" + num(places) + "</strong> " + (places === 1 ? "location" : "locations") +
        (state.brand ? " · " + state.brand : "") +
        (state.type !== "all" ? " · " + state.type : "");
    }
  }

  function refresh() {
    const svg = $m("#bm-svg");
    drawBubbles(svg);
    drawOrigin(svg);
    renderFilters();
    renderCounts();
    renderPanel();
  }

  function resetView() {
    setView([...state.home], true);
  }

  /* ---------- Location ---------- */

  async function useOrigin(o) {
    state.origin = o;
    state.selected = null;
    refresh();
    if (o) {
      const [x, y] = project(o.lat, o.lon);
      fitTo(x - 90, y - 90, 180, 180, 1);
    }
  }

  function wireFinder() {
    const note = $m("#bm-note");
    const say = (msg, bad) => {
      if (!note) return;
      note.textContent = msg || "";
      note.classList.toggle("is-error", !!bad);
    };

    $m("#bm-find")?.addEventListener("click", async () => {
      const v = $m("#bm-code").value.trim();
      if (!v) return say("Enter a postal code.", true);
      say("Looking that up…");
      try {
        const o = await DealerNet.fromPostal(v);
        if (window.Locator) Locator.fromPostal(v).catch(() => {});
        say("");
        await useOrigin(o);
      } catch (e) { say(e.message || "We couldn't find that postal code.", true); }
    });

    $m("#bm-code")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $m("#bm-find").click(); }
    });

    $m("#bm-here")?.addEventListener("click", async () => {
      say("Finding you…");
      try {
        const o = window.Locator ? await Locator.detect() : await DealerNet.fromDevice();
        say("");
        await useOrigin(o);
        if (o.postal && $m("#bm-code")) $m("#bm-code").value = o.postal;
      } catch (e) { say(e.message || "Couldn't read your location.", true); }
    });

    $m("#bm-reset")?.addEventListener("click", () => {
      state.brand = ""; state.type = "all";
      state.selected = null; state.origin = null;
      if ($m("#bm-code")) $m("#bm-code").value = "";
      say("");
      refresh();
      resetView();
    });

    $m("#bm-zin")?.addEventListener("click", () => zoomBy(0.7));
    $m("#bm-zout")?.addEventListener("click", () => zoomBy(1.4));
    $m("#bm-zall")?.addEventListener("click", () => { select(null); resetView(); });
  }

  /* ---------- Boot ---------- */

  async function init() {
    const stage = $m("#bm-stage");
    if (!stage) return;
    try {
      await load();
    } catch (e) {
      stage.innerHTML = '<p class="muted bm-fail">The map data could not be loaded. ' +
        '<a class="link" href="/dealers.html">Browse the dealer network instead →</a></p>';
      return;
    }

    const vb = state.map.viewBox;
    const svg = el("svg", {
      id: "bm-svg", viewBox: vb.join(" "), role: "img",
      "aria-label": "Map of Canada showing " + num(state.net.dealers.length) +
        " dealerships. The list beside the map gives the same information.",
    });
    stage.innerHTML = "";
    stage.appendChild(svg);
    drawProvinces(svg);

    /* Open on the populated band rather than the whole country — 4,430
       of 4,441 buyers sit below 60°N, so the default view would
       otherwise be mostly empty Arctic. */
    const ys = state.groups.map((g) => g.y);
    const top = Math.min(...ys) - 30;
    state.home = [0, top, vb[2], vb[3] - top];
    state.view = [...state.home];
    setView(state.home);

    wire(svg);
    wireFinder();

    // Inherit whatever location the header chip already knows.
    const pinned = window.Locator ? Locator.get() : null;
    if (pinned) { await useOrigin(pinned); } else { refresh(); }

    document.addEventListener("lyc:location", (e) => {
      if (e.detail) useOrigin(e.detail);
    });
  }

  return { init, state };
})();

window.pageBuyerMap = () => BuyerMap.init();
