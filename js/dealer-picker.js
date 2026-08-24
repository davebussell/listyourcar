/* ============================================================
   listyourcar.ca — dealer picker

   The seller-facing control: find my location, show the rooftops
   nearest to it, let me narrow by marque or type, and let me choose
   exactly who gets invited to bid.

   Renders into any host element. Used on the sell form, where it
   feeds the invitation list, and standalone on the dealer finder.
   ============================================================ */

function createDealerPicker(host, opts = {}) {
  if (!host) return null;

  const state = {
    origin: null,
    brands: [],           // marque filter
    type: "all",          // all | franchise | independent
    count: Number(opts.count) || 10,
    selected: new Set(),  // dealer ids the seller has chosen
    touched: false,       // has the seller hand-edited the selection?
    results: [],
    available: [],
    within100: null,
    error: "",
    busy: false,
  };

  const onChange = typeof opts.onChange === "function" ? opts.onChange : () => {};
  /* Embedded: the host form already collects a postal code, so the
     picker shows results only and never asks for a location twice. */
  const embedded = !!opts.embedded;
  const num = (n) => Number(n).toLocaleString("en-CA");

  /* ---------- Data flow ---------- */

  async function locate(fn) {
    state.busy = true;
    state.error = "";
    render();
    try {
      state.origin = await fn();
      state.touched = false;
      await refresh();
    } catch (e) {
      state.error = e.message || "Couldn't work out where that is.";
      state.busy = false;
      render();
    }
  }

  async function refresh() {
    if (!state.origin) return;
    state.busy = true;
    render();
    try {
      const [list, brands, within] = await Promise.all([
        DealerNet.nearest(state.origin, state.count, { brands: state.brands, type: state.type }),
        DealerNet.brandsNear(state.origin, 150),
        DealerNet.countWithin(state.origin, 100),
      ]);
      state.results = list;
      state.available = brands;
      state.within100 = within;
      // Until the seller edits it by hand, the selection tracks the matches.
      if (!state.touched) state.selected = new Set(list.map((d) => d.id));
    } catch (e) {
      state.error = "Couldn't load the dealer network.";
    }
    state.busy = false;
    render();
    onChange(selection());
  }

  function selection() {
    return state.results.filter((d) => state.selected.has(d.id));
  }

  /* ---------- Render ---------- */

  function render() {
    const o = state.origin;
    if (embedded) { renderEmbedded(o); return; }
    host.innerHTML =
      '<section class="dp">' +
        '<div class="dp-find">' +
          '<span class="eyebrow">Who should bid on this car</span>' +
          '<h3 class="dp-title">Find the dealerships near you</h3>' +
          '<div class="dp-controls">' +
            '<label class="dp-postal"><span>Postal code</span>' +
              '<input type="text" id="dp-code" placeholder="M4M 2B4" maxlength="7" autocomplete="postal-code" value="' +
                (o && o.source === "postal" ? o.label : "") + '" /></label>' +
            '<button type="button" class="btn btn-primary btn-sm" id="dp-go">Find dealers</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="dp-here">Use my location</button>' +
          '</div>' +
          (state.error ? '<p class="dp-error">' + state.error + '</p>' : "") +
          (o
            ? '<p class="dp-origin muted small">' +
                (o.source === "device"
                  ? "Using your device location"
                  : "Centred on " + (o.place || o.label) + (o.province ? ", " + o.province : "")) +
                (state.within100 != null
                  ? " · <strong>" + num(state.within100) + "</strong> dealerships within 100 km"
                  : "") +
              "</p>"
            : '<p class="muted small">Enter a postal code, or let the browser share your location, and we’ll rank the closest rooftops.</p>') +
        "</div>" +
        (o ? renderFilters() : "") +
        (o ? renderList() : "") +
      "</section>";
    wire();
  }

  function renderEmbedded(o) {
    if (!o) {
      host.innerHTML =
        '<section class="dp"><p class="muted small dp-await">' +
          'Enter the postal code above and the closest dealerships appear here.' +
        "</p></section>";
      return;
    }
    host.innerHTML =
      '<section class="dp">' +
        '<div class="dp-find dp-find-slim">' +
          '<p class="dp-origin muted small">' +
            "Nearest to <strong>" + (o.label || "") + "</strong>" +
            (o.place ? " · " + o.place : "") +
            (state.within100 != null
              ? " · <strong>" + num(state.within100) + "</strong> dealerships within 100 km"
              : "") +
          "</p>" +
          (state.error ? '<p class="dp-error">' + state.error + "</p>" : "") +
        "</div>" +
        renderFilters() +
        renderList() +
      "</section>";
    wire();
  }

  function renderFilters() {
    const brands = (state.available || []).slice(0, 18);
    const typeChips = [["all", "All dealers"], ["franchise", "Franchised"], ["independent", "Independent"]]
      .map((t) => '<button type="button" class="fchip ' + (state.type === t[0] ? "active" : "") +
        '" data-type="' + t[0] + '">' + t[1] + "</button>").join("");

    const brandChips = brands.map((b) =>
      '<button type="button" class="fchip ' + (state.brands.includes(b[0]) ? "active" : "") +
      '" data-brand="' + b[0] + '">' + b[0] + " <em>" + b[1] + "</em></button>").join("");

    const countChips = [10, 20, 40].map((n) =>
      '<button type="button" class="fchip ' + (state.count === n ? "active" : "") +
      '" data-count="' + n + '">' + n + "</button>").join("");

    return '<div class="dp-filters">' +
      '<div class="dp-row"><span class="dp-label">Show</span><div class="chipbar">' + typeChips + "</div></div>" +
      (brands.length
        ? '<div class="dp-row"><span class="dp-label">Marque</span><div class="chipbar dp-brands">' +
            (state.brands.length ? '<button type="button" class="fchip dp-clear" data-brand="">Clear</button>' : "") +
            brandChips + "</div></div>"
        : "") +
      '<div class="dp-row"><span class="dp-label">How many</span><div class="chipbar">' + countChips + "</div></div>" +
    "</div>";
  }

  function renderList() {
    if (state.busy) return '<p class="muted dp-busy">Ranking dealerships…</p>';
    if (!state.results.length) {
      return '<p class="muted empty-note">No dealerships match that filter near you. ' +
        '<button type="button" class="link-btn" id="dp-reset">Clear the filters</button></p>';
    }
    const rows = state.results.map((d, i) => {
      const picked = state.selected.has(d.id);
      const tags = d.brands.length ? d.brands.slice(0, 3).join(", ") : "independent";
      const contact = d.phone
        ? '<a href="tel:' + d.phone.replace(/[^0-9+]/g, "") + '" class="link-inline">' + d.phone + "</a>"
        : '<span class="muted small">no phone on file</span>';
      const web = d.website
        ? '<a href="https://' + d.website + '" target="_blank" rel="noopener" class="dealer-web">' + d.website + "</a>"
        : "";
      const dist = d.km < 1
        ? '<span class="dealer-here">&lt;1</span><em>km</em>'
        : Math.round(d.km) + "<em>km</em>";
      return '<li class="dealer ' + (picked ? "is-picked" : "") + '">' +
        '<label class="dealer-pick"><input type="checkbox" data-pick="' + d.id + '"' + (picked ? " checked" : "") + " />" +
          '<span class="dealer-rank">' + String(i + 1).padStart(2, "0") + "</span></label>" +
        '<span class="dealer-body"><strong>' + d.name + "</strong>" +
          '<span class="dealer-meta">' + d.city + ", " + d.province +
            (d.postal ? " · " + d.postal : "") + " · " + tags + "</span></span>" +
        '<span class="dealer-contact">' + contact + web + "</span>" +
        '<span class="dealer-km">' + dist + "</span>" +
      "</li>";
    }).join("");

    return '<div class="dp-head">' +
        '<span class="dp-chosen"><b>' + state.selected.size + "</b> of " + state.results.length + " selected</span>" +
        '<span class="dp-bulk">' +
          '<button type="button" class="link-btn" id="dp-all">Select all</button>' +
          '<button type="button" class="link-btn" id="dp-none">Clear</button>' +
        "</span>" +
      "</div>" +
      '<ol class="dealer-list dp-list">' + rows + "</ol>";
  }

  /* ---------- Events ---------- */

  function wire() {
    const code = host.querySelector("#dp-code");
    const go = () => {
      const v = code ? code.value : "";
      if (!v.trim()) { state.error = "Enter a postal code, or use your location."; render(); return; }
      locate(() => DealerNet.fromPostal(v));
    };
    const goBtn = host.querySelector("#dp-go");
    if (goBtn) goBtn.addEventListener("click", go);
    if (code) code.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    const hereBtn = host.querySelector("#dp-here");
    if (hereBtn) hereBtn.addEventListener("click", () => locate(() => DealerNet.fromDevice()));

    host.querySelectorAll("[data-type]").forEach((b) =>
      b.addEventListener("click", () => { state.type = b.dataset.type; state.touched = false; refresh(); }));

    host.querySelectorAll("[data-brand]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = b.dataset.brand;
        if (!v) state.brands = [];
        else if (state.brands.includes(v)) state.brands = state.brands.filter((x) => x !== v);
        else state.brands = state.brands.concat([v]);
        state.touched = false;
        refresh();
      }));

    host.querySelectorAll("[data-count]").forEach((b) =>
      b.addEventListener("click", () => { state.count = Number(b.dataset.count); state.touched = false; refresh(); }));

    host.querySelectorAll("[data-pick]").forEach((cb) =>
      cb.addEventListener("change", () => {
        state.touched = true;
        if (cb.checked) state.selected.add(cb.dataset.pick);
        else state.selected.delete(cb.dataset.pick);
        render();
        onChange(selection());
      }));

    const all = host.querySelector("#dp-all");
    if (all) all.addEventListener("click", () => {
      state.touched = true;
      state.selected = new Set(state.results.map((d) => d.id));
      render(); onChange(selection());
    });
    const none = host.querySelector("#dp-none");
    if (none) none.addEventListener("click", () => {
      state.touched = true; state.selected.clear(); render(); onChange(selection());
    });
    const reset = host.querySelector("#dp-reset");
    if (reset) reset.addEventListener("click", () => { state.brands = []; state.type = "all"; refresh(); });
  }

  render();

  return {
    selection,
    origin: () => state.origin,
    setOrigin: (o) => { state.origin = o; state.touched = false; return refresh(); },
  };
}

window.createDealerPicker = createDealerPicker;
