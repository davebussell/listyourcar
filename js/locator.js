/* ============================================================
   listyourcar.ca — location context

   A persistent "your location" chip in the header, the way a big
   retailer pins you to a store. Once set, it follows you across the
   site: the auction book opens on your market, the sell form knows
   your postal code, and the panel shows the dealerships nearest you.

   Deliberately not auto-prompting for geolocation on page load —
   browsers increasingly ignore ungestured requests, and an unasked
   permission dialog on arrival is hostile. The chip invites it; the
   click supplies the gesture.

   The dealer dataset is ~400KB, so it is pulled in only when the
   panel is actually opened.
   ============================================================ */

const Locator = (() => {
  const KEY = "lyc_location";
  let panel = null;
  let chip = null;
  let dealersReady = null;

  /* ---------- State ---------- */

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; }
    catch { return null; }
  }

  function set(loc) {
    if (!loc) { localStorage.removeItem(KEY); }
    else { localStorage.setItem(KEY, JSON.stringify(loc)); }
    paintChip();
    document.dispatchEvent(new CustomEvent("lyc:location", { detail: loc }));
    return loc;
  }

  function clear() { return set(null); }

  /* Nearest of the auction markets, by real distance. */
  function nearestMarket(lat, lon) {
    const cities = (window.LYC_DATA && window.LYC_DATA.CITIES) || [];
    let best = null, bestKm = Infinity;
    for (const c of cities) {
      const km = haversine(lat, lon, c.lat, c.lon);
      if (km < bestKm) { bestKm = km; best = c; }
    }
    return best ? { slug: best.slug, name: best.name, km: Math.round(bestKm) } : null;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ---------- Resolving a location ---------- */

  /* Device position, then reverse-geocoded so we can show a place
     name and recover a postal code for the listing form. */
  async function detect() {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("This browser can't share a location."));
      navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(
        err.code === 1 ? "Location permission was declined. Enter a postal code instead."
        : err.code === 3 ? "That took too long. Enter a postal code instead."
        : "Couldn't read your location. Enter a postal code instead."
      )), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });

    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    let place = "your location", province = "", postal = "";
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/reverse?" +
        new URLSearchParams({ lat, lon, format: "json", zoom: "18", addressdetails: "1" }));
      if (r.ok) {
        const a = (await r.json()).address || {};
        place = a.city || a.town || a.village || a.suburb || a.neighbourhood || place;
        province = a["ISO3166-2-lvl4"] ? a["ISO3166-2-lvl4"].replace("CA-", "") : (a.state || "");
        postal = (a.postcode || "").toUpperCase();
      }
    } catch { /* a missing place name must not lose a good fix */ }

    const market = nearestMarket(lat, lon);
    return set({ lat, lon, place, province, postal, market, source: "device", at: Date.now() });
  }

  async function fromPostal(code) {
    // Postal lookup lives in the dealer bundle, which is lazy on every
    // page but the sell form, so make sure it is here before asking.
    await ensureDealers();
    const loc = await DealerNet.fromPostal(code);   // throws with a readable message
    const market = nearestMarket(loc.lat, loc.lon);
    return set({
      lat: loc.lat, lon: loc.lon, place: loc.place, province: loc.province,
      postal: loc.label, market, source: "postal", at: Date.now(),
      // How exact the fix is: "postal" is the street, "district" the FSA.
      precision: loc.precision, rural: !!loc.rural,
    });
  }

  function fromMarket(slug) {
    const c = ((window.LYC_DATA && window.LYC_DATA.CITIES) || []).find((x) => x.slug === slug);
    if (!c) return null;
    return set({
      lat: c.lat, lon: c.lon, place: c.name, province: c.province, postal: "",
      market: { slug: c.slug, name: c.name, km: 0 }, source: "market", at: Date.now(),
    });
  }

  /* Postal lookups name every neighbourhood in the FSA in
     parentheses. Good detail for a field note, far too long for a
     chip, so the display name keeps only the municipality. */
  const shortPlace = (p) => String(p || "").replace(/\s*\([^)]*\)/g, "").trim();

  /* ---------- Header chip ---------- */

  function label() {
    const l = get();
    if (!l) return "Set your location";
    /* The place reads as a location; the postal reads as an address.
       Show the place and keep the postal for the panel. */
    if (l.place) return shortPlace(l.place) + (l.province ? ", " + l.province : "");
    return l.postal || "Set your location";
  }

  function paintChip() {
    if (!chip) return;
    const l = get();
    chip.classList.toggle("is-set", !!l);
    chip.innerHTML =
      '<span class="loc-pin" aria-hidden="true"></span>' +
      '<span class="loc-text">' + label() + "</span>" +
      '<span class="loc-caret" aria-hidden="true">▾</span>';
    chip.setAttribute("aria-label",
      (get() ? "Your location: " + label() + ". " : "") + "Change location");
  }

  function mount() {
    const nav = document.querySelector(".container.nav");
    if (!nav || document.getElementById("loc-chip")) return;
    chip = document.createElement("button");
    chip.type = "button";
    chip.id = "loc-chip";
    chip.className = "loc-chip";
    chip.setAttribute("aria-haspopup", "dialog");
    chip.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    // Sits with the brand, before the nav links, like a store selector.
    const brand = nav.querySelector(".nav-brand");
    if (brand && brand.parentNode === nav) brand.insertAdjacentElement("afterend", chip);
    else nav.appendChild(chip);
    paintChip();
  }

  /* ---------- Panel ---------- */

  function ensureDealers() {
    if (dealersReady) return dealersReady;
    if (window.DealerNet) { dealersReady = Promise.resolve(); return dealersReady; }
    dealersReady = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/js/dealers.js?v=24";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load the dealer network."));
      document.head.appendChild(s);
    });
    return dealersReady;
  }

  function toggle() { panel && panel.classList.contains("open") ? close() : open(); }

  function open() {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "loc-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Set your location");
      panel.addEventListener("click", (e) => e.stopPropagation());
      document.querySelector(".site-header").appendChild(panel);
      document.addEventListener("click", close);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    panel.classList.add("open");
    chip.setAttribute("aria-expanded", "true");
    render();
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("open");
    chip && chip.setAttribute("aria-expanded", "false");
  }

  let busy = false, error = "";

  function render() {
    const l = get();
    const markets = ((window.LYC_DATA && window.LYC_DATA.CITIES) || [])
      .map((c) => '<button type="button" class="fchip" data-market="' + c.slug + '">' + c.name + "</button>")
      .join("");

    panel.innerHTML =
      '<div class="loc-body">' +
        '<span class="eyebrow">Your location</span>' +
        (l
          ? '<p class="loc-current"><strong>' + (shortPlace(l.place) || l.postal) + "</strong>" +
              (l.province ? ", " + l.province : "") +
              (l.postal && l.place ? " · " + l.postal : "") +
              (l.rural && l.precision === "district"
                ? '<span class="loc-market">Placed to the postal district only — enter the full code for an exact match</span>'
                : "") +
              (l.market ? '<span class="loc-market">Auctions filed under ' + l.market.name + "</span>" : "") +
            "</p>"
          : '<p class="muted small">Set it once and the whole site follows — the auction book opens on your market, and listing a car knows where it is.</p>') +

        '<div class="loc-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" id="loc-detect">' +
            (busy ? "Locating…" : "Use my location") + "</button>" +
          '<span class="loc-or">or</span>' +
          '<label class="loc-postal"><span class="sr-only">Postal code</span>' +
            '<input type="text" id="loc-code" placeholder="Postal code" maxlength="7" autocomplete="postal-code" value="' +
              (l && l.postal ? l.postal : "") + '" /></label>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="loc-set">Set</button>' +
        "</div>" +
        (error ? '<p class="dp-error">' + error + "</p>" : "") +

        '<div class="loc-markets"><span class="dp-label">Or pick a market</span>' +
          '<div class="chipbar">' + markets + "</div></div>" +

        '<div class="loc-dealers" id="loc-dealers">' +
          (l ? '<p class="muted small">Loading the dealerships near you…</p>' : "") +
        "</div>" +

        (l ? '<button type="button" class="link-btn loc-clear" id="loc-clear">Clear location</button>' : "") +
      "</div>";

    wire();
    if (l) showDealers(l);
  }

  /* The nearest rooftops, shown under the location — the point of
     setting one in the first place. */
  async function showDealers(l) {
    const host = panel.querySelector("#loc-dealers");
    if (!host) return;
    try {
      await ensureDealers();
      const [near, within] = await Promise.all([
        DealerNet.nearest(l, 10),
        DealerNet.countWithin(l, 100),
      ]);
      if (!near.length) { host.innerHTML = '<p class="muted small">No dealerships found near there.</p>'; return; }
      host.innerHTML =
        '<div class="loc-dealers-head">' +
          '<span class="dp-label">Closest dealerships</span>' +
          '<span class="muted small">' + Number(within).toLocaleString("en-CA") + " within 100 km</span>" +
        "</div>" +
        '<ol class="loc-dealer-list">' +
          near.map((d, i) =>
            '<li><span class="loc-rank">' + String(i + 1).padStart(2, "0") + "</span>" +
            '<span class="loc-name"><strong>' + d.name + "</strong>" +
              '<em>' + d.city + ", " + d.province + (d.brands.length ? " · " + d.brands.slice(0, 2).join(", ") : "") + "</em></span>" +
            '<span class="loc-km">' + (d.km < 1 ? "&lt;1" : Math.round(d.km)) + "<i>km</i></span></li>").join("") +
        "</ol>" +
        '<a class="link" href="/sell.html">List a car here →</a>';
    } catch (e) {
      host.innerHTML = '<p class="muted small">' + (e.message || "Couldn't load dealerships.") + "</p>";
    }
  }

  function wire() {
    const run = async (fn) => {
      busy = true; error = ""; render();
      try { await fn(); error = ""; }
      catch (e) { error = e.message || "That didn't work."; }
      busy = false; render();
    };

    panel.querySelector("#loc-detect")?.addEventListener("click", () => run(detect));
    panel.querySelector("#loc-set")?.addEventListener("click", () => {
      const v = panel.querySelector("#loc-code").value;
      if (!v.trim()) { error = "Enter a postal code."; render(); return; }
      run(() => fromPostal(v));
    });
    panel.querySelector("#loc-code")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); panel.querySelector("#loc-set").click(); }
    });
    panel.querySelectorAll("[data-market]").forEach((b) =>
      b.addEventListener("click", () => run(async () => fromMarket(b.dataset.market))));
    panel.querySelector("#loc-clear")?.addEventListener("click", () => { clear(); render(); });
  }

  document.addEventListener("DOMContentLoaded", mount);

  return { get, set, clear, detect, fromPostal, fromMarket, nearestMarket, open, close, label };
})();

window.Locator = Locator;
