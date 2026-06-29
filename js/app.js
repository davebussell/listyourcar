/* ============================================================
   listyourcar.ca — front-end app logic
   Dispatches per-page behaviour via <body data-page="...">.
   Depends on data.js (window.LYC_DATA) and store.js (window.Store).
   ============================================================ */

const D = window.LYC_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Formatting helpers ---------- */
const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtPrice = (n) => "$" + Number(n).toLocaleString("en-CA");
const fmtKm = (n) => Number(n).toLocaleString("en-CA") + " km";
const cityName = (slug) => (D.CITIES.find((c) => c.slug === slug)?.name) || slug || "Canada";
const titleOf = (l) => `${l.year} ${l.make} ${l.model}`;
const qs = () => new URLSearchParams(location.search);

/* Set/refresh SEO + Open Graph tags for JS-rendered pages */
function setSeo({ title, desc, canonical, image }) {
  if (title) document.title = title;
  const meta = (sel, attr, key, val) => {
    if (!val) return;
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", val);
  };
  if (desc) meta('meta[name="description"]', "name", "description", desc);
  meta('meta[property="og:title"]', "property", "og:title", title);
  meta('meta[property="og:description"]', "property", "og:description", desc);
  meta('meta[property="og:type"]', "property", "og:type", "website");
  meta('meta[property="og:image"]', "property", "og:image", image);
  meta('meta[name="twitter:card"]', "name", "twitter:card", image ? "summary_large_image" : "summary");
  if (canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
  }
}

/* ---------- Photographers ---------- */
function phInitials(name) { return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function phAvatar(p) {
  const hue = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<span class="ph-avatar" style="--h:${hue}">${phInitials(p.name)}</span>`;
}
function photographersIn(citySlug) { return (D.PHOTOGRAPHERS || []).filter((p) => p.city === citySlug); }
function phPortfolio(p) {
  const pool = (phPortfolio._pool || (phPortfolio._pool =
    [].concat(...(D.CATEGORIES || []).map((c) => c.images), Object.values(D.EDITORIAL || {}))));
  const start = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return [0, 1, 2].map((k) => pool[(start + k * 7) % pool.length]);
}
function photographerCard(p) {
  return `
    <div class="ph-card">
      ${phAvatar(p)}
      <div class="ph-body">
        <h3>${p.name} <span class="ph-verified" title="Verified pro">✓ Verified</span></h3>
        <p class="ph-meta">${p.specialty} &middot; ${cityName(p.city)}</p>
        <p class="ph-bio">${p.bio}</p>
        <div class="ph-shots" aria-hidden="true">${phPortfolio(p).map((u) => `<span class="ph-shot" style="background-image:url('${u}')"></span>`).join("")}</div>
        <div class="ph-foot"><span class="ph-rate">${fmtPrice(p.rate)}<span class="per">/day</span></span>
          <a class="link" href="index.html?city=${p.city}&ph=${p.id}">Build a package →</a></div>
      </div>
    </div>`;
}

/* Resolve a real photo for a listing, or null to fall back to emoji */
function carImage(l) {
  if (l.image) return l.image; // explicit override
  const key = `${(l.make || "").toLowerCase()}|${(l.model || "").toLowerCase()}`;
  return (D.CAR_IMAGES && D.CAR_IMAGES[key]) || null;
}

/* OpenStreetMap embed (no API key) centred on a city */
function cityMapEmbed(slug, label) {
  const c = D.CITIES.find((x) => x.slug === slug);
  if (!c) return "";
  const d = 0.06; // bounding-box half-size in degrees (~city view)
  const bbox = `${c.lon - d},${c.lat - d},${c.lon + d},${c.lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${c.lat},${c.lon}`;
  return `
    <div class="map-embed">
      <iframe title="Map of ${label}" loading="lazy" src="${src}"></iframe>
    </div>
    <p class="muted small">Approximate area — ${label}. <a href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=12/${c.lat}/${c.lon}" target="_blank" rel="noopener">View larger map</a></p>`;
}

function intentBadge(intent) {
  const map = {
    sale:   '<span class="badge badge-sale">For sale</span>',
    rental: '<span class="badge badge-rent">For rent</span>',
    both:   '<span class="badge badge-sale">For sale</span><span class="badge badge-rent">For rent</span>',
  };
  return map[intent] || "";
}

/* ---------- Price comparables (Pro Pack feature) ----------
   Compares a sale listing's price against similar cars in the
   marketplace. Prefers same-make comps, falls back to all sale
   listings. Returns null if there isn't enough data. */
function priceComparables(listing) {
  if (!listing.price) return null;
  const pool = Store.allListings().filter(
    (l) => l.id !== listing.id && (l.intent === "sale" || l.intent === "both") && l.price
  );
  let comps = pool.filter((l) => l.make.toLowerCase() === listing.make.toLowerCase());
  let basis = `${listing.make} listings`;
  if (comps.length < 2) { comps = pool; basis = "comparable sale listings"; }
  if (comps.length < 2) return null;

  const prices = comps.map((l) => l.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
  const ratio = listing.price / median;
  let verdict, cls;
  if (ratio <= 0.95) { verdict = "Below market — priced to move"; cls = "good"; }
  else if (ratio >= 1.05) { verdict = "Above market — expect negotiation"; cls = "high"; }
  else { verdict = "Right around market value"; cls = "ok"; }
  // position 0–100% across the min..max range for the bar marker
  const lo = prices[0], hi = prices[prices.length - 1];
  const pos = hi === lo ? 50 : Math.max(2, Math.min(98, ((listing.price - lo) / (hi - lo)) * 100));
  return { count: comps.length, median, lo, hi, verdict, cls, pos, basis };
}

function comparablesCard(listing) {
  const c = priceComparables(listing);
  if (!c) return "";
  return `
    <div class="comp-card">
      <h3>Price check <span class="pro-tag">Pro</span></h3>
      <p class="comp-verdict comp-${c.cls}">${c.verdict}</p>
      <div class="comp-bar">
        <span class="comp-marker" style="left:${c.pos}%"></span>
      </div>
      <div class="comp-scale"><span>${fmtPrice(c.lo)}</span><span>${fmtPrice(c.hi)}</span></div>
      <p class="muted small">Based on ${c.count} ${c.basis} — median ${fmtPrice(c.median)}.</p>
    </div>`;
}

/* ---------- Listing card ---------- */
function listingCard(l) {
  const priceLine =
    l.intent === "rental"
      ? `<div class="price">${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>`
      : l.intent === "both"
      ? `<div class="price">${fmtPrice(l.price)} <span class="or">or</span> ${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>`
      : `<div class="price">${fmtPrice(l.price)}</div>`;
  const img = carImage(l);
  const thumb = img
    ? `<div class="thumb has-img"><img src="${img}" alt="${titleOf(l)}" loading="lazy"
         onerror="this.parentNode.classList.remove('has-img');this.replaceWith(document.createTextNode('${l.emoji || "🚗"}'))" />`
    : `<div class="thumb">${l.emoji || "🚗"}`;
  const badge = l.shootReady ? '<span class="badge badge-rent">For shoots</span>' : intentBadge(l.intent);
  return `
    <a class="car-card" href="listing.html?id=${encodeURIComponent(l.id)}">
      ${thumb}<div class="badges">${badge}</div></div>
      <div class="body">
        <h3>${titleOf(l)}</h3>
        ${priceLine}
        <p class="meta">${l.mileage ? fmtKm(l.mileage) + " &middot; " : ""}${cityName(l.city)}</p>
      </div>
    </a>`;
}
function renderInto(id, items, empty) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.length ? items.map(listingCard).join("") : `<p class="muted">${empty}</p>`;
}

/* ============================================================
   Shared chrome: nav toggle + footer year
   ============================================================ */
function initChrome() {
  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();

  const toggle = $(".nav-toggle");
  const links = $(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  // Inbox badge in nav
  const badge = $("#inbox-count");
  if (badge) {
    const n = Store.inquiries().filter((i) => !i.read).length + Store.bookings().length;
    if (n > 0) { badge.textContent = n; badge.hidden = false; }
  }

  initMotion();
}

/* ============================================================
   Motion system (adapted from the Campaign Automation build)
   Nav scroll state · hero word reveal · scroll reveal ·
   count-ups · stagger · parallax orbs · reduced-motion safe.
   ============================================================ */
function initMotion() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nav scroll blur/condense
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Word-by-word hero reveal
  const words = $$(".hero-word");
  if (words.length) {
    if (reduce) words.forEach((w) => w.classList.add("revealed"));
    else words.forEach((w, i) => setTimeout(() => w.classList.add("revealed"), 120 + i * 65));
  }

  // Stagger: auto-tag direct children of [data-stagger] with reveal + delay
  $$("[data-stagger]").forEach((grid) => {
    [...grid.children].forEach((child, i) => {
      child.classList.add("reveal", `reveal-delay-${Math.min(i + 1, 5)}`);
    });
  });

  // Scroll reveal observer
  const revealEls = $$(".reveal, .reveal-left");
  if (reduce) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => obs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // Count-up metrics
  if (!reduce && "IntersectionObserver" in window) {
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animateCount(e.target); countObs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    $$(".count").forEach((el) => countObs.observe(el));
  }

  // Hero parallax orbs (desktop only)
  const hero = $(".hero");
  if (hero && !reduce) {
    const orbs = $$(".orb", hero);
    if (orbs.length) {
      window.addEventListener("scroll", () => {
        if (window.innerWidth < 900) return;
        const y = window.scrollY;
        if (y > window.innerHeight) return;
        orbs.forEach((o, i) => { o.style.transform = `translateY(${y * (i ? 0.04 : 0.07)}px)`; });
      }, { passive: true });
    }
  }

  // Page-enter flash
  if (!reduce) {
    document.body.classList.add("page-entering");
    requestAnimationFrame(() => document.body.classList.remove("page-entering"));
  }
}

function animateCount(el) {
  const raw = el.dataset.value || el.textContent.trim();
  el.dataset.value = raw;
  const prefix = (raw.match(/^[^\d]*/) || [""])[0];
  const suffix = (raw.match(/[^\d.]*$/) || [""])[0];
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return;
  const dur = 1100, start = performance.now(), dec = String(num).includes(".");
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const cur = num * ease;
    el.textContent = prefix + (dec ? cur.toFixed(1) : Math.floor(cur)) + suffix;
    if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

/* ============================================================
   PAGE: Home
   ============================================================ */
function pageHome() {
  const gallery = $("#gallery");
  if (!gallery) return;

  const CITY_SLUGS = D.FILM_CITIES;
  const CATS = D.CATEGORIES;
  const all = Store.allListings().filter((l) => l.shootReady);

  // Photographer-first packaging: if ?ph= is present, we're building a
  // package — banner the gallery and carry the photographer into car links.
  const pkgPh = (D.PHOTOGRAPHERS || []).find((p) => p.id === qs().get("ph")) || null;
  if (pkgPh) {
    const host = document.querySelector(".home-hero .container");
    if (host) {
      const b = document.createElement("div");
      b.className = "pkg-banner";
      b.innerHTML = `<span class="live-dot"></span> Building a package with <strong>${pkgPh.name}</strong> — pick a car in ${cityName(pkgPh.city)}, then add ${pkgPh.name.split(" ")[0]} on the car's page. <a href="index.html">Clear</a>`;
      host.appendChild(b);
    }
  }

  // Every word that actually appears in the catalogue — so we only
  // require text tokens that exist (descriptor words like "convertible"
  // or "classic" steer the category via parse() instead of forcing 0).
  const CORPUS = (() => {
    const s = new Set();
    all.forEach((l) => `${l.year} ${l.make} ${l.model} ${l.category} ${cityName(l.city)} ${l.description}`
      .toLowerCase().split(/[^a-z0-9]+/).forEach((w) => w && s.add(w)));
    return s;
  })();
  const scrollToResults = () => { const g = document.querySelector(".gallery-wrap"); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // Front-of-house ordering for the "Featured" sort
  const featuredIds = [
    "car-exotic-1", "car-vintage-1", "car-luxury-2",
    "car-muscle-1", "car-military-1", "car-exotic-2",
  ];
  const featuredRank = (l) => { const i = featuredIds.indexOf(l.id); return i === -1 ? 999 : i; };

  const COSTS = [
    ["u250", "Under $250/day", (r) => r < 250],
    ["mid", "$250–$400", (r) => r >= 250 && r <= 400],
    ["hi", "$400+", (r) => r > 400],
  ];
  const state = { q: "", type: "", occasion: "", city: "", cost: "", sort: "featured" };
  // Pre-fill from URL (deep links from photographer cards, collections, etc.)
  ["type", "occasion", "city", "q"].forEach((k) => { const v = qs().get(k); if (v) state[k] = v; });
  let shown = 24;

  // ---- Consolidated filter dropdowns ----
  const drops = [];
  function closeAll() { drops.forEach((d) => d.removeAttribute("aria-expanded")); }
  function dropdown({ label, options, get, set, noAny, activeWhen, resetsPage }) {
    const wrap = document.createElement("div"); wrap.className = "fdrop";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "fdrop-btn";
    const menu = document.createElement("div"); menu.className = "fdrop-menu";
    const opts = noAny ? options.slice() : [{ v: "", l: "Any " + label.toLowerCase() }].concat(options);
    function paint() {
      const cur = options.find((o) => o.v === get());
      btn.innerHTML = `${cur ? cur.l : label} <span class="caret">▾</span>`;
      wrap.classList.toggle("active", activeWhen ? activeWhen() : !!get());
      [...menu.children].forEach((b, i) => b.classList.toggle("sel", opts[i].v === get()));
    }
    opts.forEach((o) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = o.l;
      b.addEventListener("click", (e) => {
        e.stopPropagation(); set(o.v); if (resetsPage !== false) shown = 24;
        closeAll(); paint(); render();
      });
      menu.appendChild(b);
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = wrap.getAttribute("aria-expanded") === "true";
      closeAll(); if (!open) wrap.setAttribute("aria-expanded", "true");
    });
    wrap.append(btn, menu); wrap._paint = paint; paint(); drops.push(wrap);
    return wrap;
  }
  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  const OCCS = D.OCCASIONS || [];
  $("#filters").append(
    dropdown({ label: "Type", options: CATS.map((c) => ({ v: c.id, l: c.name.replace(/ &.*/, "") })), get: () => state.type, set: (v) => state.type = v }),
    dropdown({ label: "Occasion", options: OCCS.map((o) => ({ v: o.id, l: `${o.emoji} ${o.name}` })), get: () => state.occasion, set: (v) => state.occasion = v }),
    dropdown({ label: "City", options: CITY_SLUGS.map((cs) => ({ v: cs, l: cityName(cs) })), get: () => state.city, set: (v) => state.city = v }),
    dropdown({ label: "Budget", options: COSTS.map(([v, l]) => ({ v, l })), get: () => state.cost, set: (v) => state.cost = v }),
  );
  const SORTS = [["featured", "Featured"], ["rate-asc", "Day rate ↑"], ["rate-desc", "Day rate ↓"], ["az", "A–Z"]];
  $("#sort-mount").appendChild(dropdown({
    label: "Sort", noAny: true, resetsPage: false,
    options: SORTS.map(([v, l]) => ({ v, l })),
    get: () => state.sort, set: (v) => state.sort = v || "featured",
    activeWhen: () => state.sort !== "featured",
  }));

  $("#clear-all").addEventListener("click", () => {
    state.type = state.occasion = state.city = state.cost = state.q = ""; state.sort = "featured"; shown = 24;
    input.value = ""; drops.forEach((d) => d._paint()); render();
  });

  // ---- Example "autofill" chips ----
  const EXAMPLES = [
    "vintage convertible in Toronto", "muscle car under $300", "Ferrari for a music video",
    "military jeep in Vancouver", "luxury car for a wedding", "exotic supercar in Montreal",
  ];
  const input = $("#ss-input"), ghost = $("#ss-ghost");
  if (state.q) input.value = state.q;
  EXAMPLES.slice(0, 4).forEach((ex) => {
    const b = document.createElement("button");
    b.textContent = ex;
    b.addEventListener("click", () => { input.value = ex; state.q = ex; shown = 24; render(); scrollToResults(); });
    $("#ss-eg").appendChild(b);
  });

  // ---- Search input ----
  const runSearch = (scroll) => { state.q = input.value; shown = 24; render(); if (scroll) scrollToResults(); };
  $("#ss-go").addEventListener("click", () => runSearch(true));
  input.addEventListener("input", () => runSearch(false));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { runSearch(true); input.blur(); } });

  // Typewriter ghost placeholder ending in a blinking red period
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let exIdx = 0, chIdx = 0, deleting = false;
  function tw() {
    if (input.value || document.activeElement === input) { ghost.innerHTML = ""; setTimeout(tw, 450); return; }
    const word = EXAMPLES[exIdx % EXAMPLES.length];
    chIdx = Math.max(0, Math.min(word.length, chIdx + (deleting ? -1 : 1)));
    ghost.innerHTML = word.slice(0, chIdx) + '<span class="blink-dot">.</span>';
    let delay = deleting ? 35 : 65;
    if (!deleting && chIdx === word.length) { deleting = true; delay = 1500; }
    else if (deleting && chIdx === 0) { deleting = false; exIdx++; delay = 300; }
    setTimeout(tw, delay);
  }
  input.addEventListener("focus", () => { ghost.innerHTML = ""; });
  if (reduce) ghost.innerHTML = EXAMPLES[0] + '<span class="blink-dot">.</span>'; else tw();

  // ---- Parse free text into structured filters ----
  function parse(q) {
    q = (q || "").toLowerCase();
    const out = { city: "", cat: "", maxRate: null };
    CITY_SLUGS.forEach((cs) => { if (q.includes(cs) || q.includes(cityName(cs).toLowerCase())) out.city = cs; });
    const catWords = {
      vintage: ["vintage", "classic", "retro", "convertible", "cadillac"],
      luxury: ["luxury", "rolls", "bentley", "mercedes", "jaguar", "aston"],
      muscle: ["muscle", "mustang", "camaro", "charger", "v8", "gto"],
      exotic: ["exotic", "supercar", "ferrari", "lamborghini", "porsche", "mclaren"],
      military: ["military", "jeep", "army", "willys", "humvee", "tank"],
    };
    Object.entries(catWords).forEach(([id, words]) => { if (words.some((w) => q.includes(w))) out.cat = id; });
    const occWords = { weddings: ["wedding", "bride", "groom", "getaway"], engagement: ["engagement", "couple", "anniversary"], prom: ["prom", "grad", "graduation"], events: ["event", "party", "gala"], musicvideo: ["music", "video", "fashion"] };
    out.occ = "";
    Object.entries(occWords).forEach(([id, words]) => { if (words.some((w) => q.includes(w))) out.occ = id; });
    const m = q.match(/under\s*\$?\s*(\d+)/) || q.match(/\$\s*(\d+)/);
    if (m) out.maxRate = Number(m[1]);
    return out;
  }
  const STOP = /^(in|for|a|an|the|under|video|wedding|shoot|music|car|cars|with|my|to|party|event|prom|grad)$/;

  // ---- Filter + sort + render ----
  function render() {
    const p = parse(state.q);
    const costFn = (COSTS.find(([id]) => id === state.cost) || [])[2];
    let items = all.filter((l) => {
      if (state.type && l.category !== state.type) return false;
      if (state.occasion && !(l.occasions || []).includes(state.occasion)) return false;
      if (state.city && l.city !== state.city) return false;
      if (state.cost && costFn && !costFn(l.dailyRate)) return false;
      if (p.cat && l.category !== p.cat) return false;
      if (p.occ && !(l.occasions || []).includes(p.occ)) return false;
      if (p.city && l.city !== p.city) return false;
      if (p.maxRate && l.dailyRate > p.maxRate) return false;
      if (state.q) {
        const hay = `${l.year} ${l.make} ${l.model} ${l.category} ${cityName(l.city)} ${l.description}`.toLowerCase();
        const tokens = state.q.toLowerCase().split(/\s+/).filter((t) => t && !STOP.test(t) && !/^\$?\d+$/.test(t));
        // Only enforce tokens that exist in the catalogue; descriptor words
        // (convertible, classic, supercar…) are already applied via parse().
        for (const t of tokens) { if (CORPUS.has(t) && !hay.includes(t)) return false; }
      }
      return true;
    });

    items.sort((a, b) => {
      switch (state.sort) {
        case "rate-asc": return a.dailyRate - b.dailyRate;
        case "rate-desc": return b.dailyRate - a.dailyRate;
        case "az": return titleOf(a).localeCompare(titleOf(b));
        default: return featuredRank(a) - featuredRank(b) || a.dailyRate - b.dailyRate;
      }
    });

    const total = items.length;
    renderInto("gallery", items.slice(0, shown), "No cars match — try clearing a filter.");
    if (pkgPh) $$("#gallery .car-card").forEach((a) => { if (!a.href.includes("ph=")) a.href += "&ph=" + pkgPh.id; });
    const cnt = $("#gallery-count");
    if (cnt) cnt.innerHTML = `<b>${total}</b> car${total === 1 ? "" : "s"} available`;
    const more = $("#gallery-more");
    if (more) more.hidden = total <= shown;
    const ca = $("#clear-all");
    if (ca) ca.hidden = !(state.type || state.occasion || state.city || state.cost || state.q);
  }
  $("#gallery-more").addEventListener("click", () => { shown += 24; render(); });

  render();
}

/* ============================================================
   PAGE: Browse
   ============================================================ */
function pageBrowse() {
  const form = $("#filter-form");
  const params = qs();

  // Pre-fill from URL (home search bar / local / collection pages)
  if (form) {
    ["intent", "make", "model", "city", "price", "category"].forEach((k) => {
      if (params.get(k) && form[k]) form[k].value = params.get(k);
    });
  }

  const CAP = 48;
  function apply() {
    const f = form ? Object.fromEntries(new FormData(form)) : {};
    const intent = f.intent || params.get("intent") || "";
    const category = f.category || params.get("category") || "";
    const make = (f.make || "").toLowerCase().trim();
    const model = (f.model || "").toLowerCase().trim();
    const city = (f.city || "").toLowerCase().trim();
    const maxPrice = f.price ? Number(f.price) : null;

    let items = Store.allListings().filter((l) => {
      if (intent === "sale" && !(l.intent === "sale" || l.intent === "both")) return false;
      if (intent === "rental" && !(l.intent === "rental" || l.intent === "both")) return false;
      if (category && l.category !== category) return false;
      if (make && !l.make.toLowerCase().includes(make)) return false;
      if (model && !l.model.toLowerCase().includes(model)) return false;
      if (city && l.city !== city) return false;
      if (maxPrice != null) {
        const p = (l.intent === "rental" || !l.price) ? l.dailyRate : l.price;
        if (p > maxPrice) return false;
      }
      return true;
    });

    const total = items.length;
    const shown = items.slice(0, CAP);
    renderInto("listings", shown, "No cars match your search. Try widening your filters.");
    const count = $("#results-count");
    if (count) count.textContent = total > CAP
      ? `Showing ${CAP} of ${total} listings — refine your filters to narrow it down`
      : `${total} ${total === 1 ? "listing" : "listings"} found`;
  }

  if (form) {
    form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
    form.addEventListener("reset", () => setTimeout(apply, 0));
    // Re-filter immediately on dropdown changes
    form.intent?.addEventListener("change", apply);
    form.category?.addEventListener("change", apply);
    form.city?.addEventListener("change", apply);
  }
  apply();
}

/* ============================================================
   PAGE: List your car (intent selector + dynamic flow)
   ============================================================ */
function pageList() {
  const form = $("#list-form");
  if (!form) return;

  // VIN decode via NHTSA vPIC (free, no key, CORS-enabled)
  let decodedVehicle = null;
  const vinBtn = $("#vin-decode");
  const vinStatus = $("#vin-status");
  const setVinStatus = (msg, kind) => {
    vinStatus.hidden = false;
    vinStatus.textContent = msg;
    vinStatus.className = "vin-status small " + (kind === "err" ? "vin-err" : kind === "ok" ? "vin-ok" : "muted");
  };
  vinBtn?.addEventListener("click", async () => {
    const vin = ($("#vin").value || "").trim();
    if (vin.length !== 17) { setVinStatus("Enter a full 17-character VIN to decode.", "err"); return; }
    vinBtn.disabled = true; setVinStatus("Decoding…");
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
      const data = await res.json();
      const r = (data.Results && data.Results[0]) || {};
      if (r.ErrorCode && r.ErrorCode !== "0" && !r.Make) {
        setVinStatus("Couldn't decode that VIN. Enter details manually.", "err");
      } else {
        if (r.Make) form.make.value = titleCase(r.Make);
        if (r.Model) form.model.value = r.Model;
        if (r.ModelYear) form.year.value = r.ModelYear;
        decodedVehicle = { vin, make: r.Make, model: r.Model, year: r.ModelYear, trim: r.Trim, bodyClass: r.BodyClass, fuel: r.FuelTypePrimary };
        setVinStatus(`Decoded: ${[r.ModelYear, titleCase(r.Make || ""), r.Model, r.Trim].filter(Boolean).join(" ")}`, "ok");
      }
    } catch {
      setVinStatus("Decode service unavailable. Enter details manually.", "err");
    } finally {
      vinBtn.disabled = false;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const listing = Store.addListing({
      intent: "rental",
      shootReady: true,
      occasions: f.occasions ? [].concat(f.occasions) : [],
      vin: f.vin || null,
      decodedVehicle: decodedVehicle || null,
      make: f.make, model: f.model, year: Number(f.year),
      mileage: f.mileage ? Number(f.mileage) : null,
      city: f.city, condition: f.condition,
      description: f.description,
      name: f.name, email: f.email, phone: f.phone,
      dailyRate: f.dailyRate ? Number(f.dailyRate) : null,
      weeklyRate: f.weeklyRate ? Number(f.weeklyRate) : null,
      deposit: f.deposit ? Number(f.deposit) : null,
      minAge: f.minAge ? Number(f.minAge) : null,
      availFrom: f.availFrom || null,
      availTo: f.availTo || null,
    });
    // Success screen
    $("#list-wrap").innerHTML = `
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h1>Your car is listed!</h1>
        <p class="lead">${titleOf(listing)} — <span class="badge badge-rent">For shoots</span></p>
        <p>Creators can now find and book it. Manage every booking request from your dashboard.</p>
        <div class="hero-actions center">
          <a class="btn btn-primary" href="listing.html?id=${listing.id}">View your listing</a>
          <a class="btn btn-outline" href="dashboard.html">Go to dashboard</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   PAGE: Listing detail (sale / rental templates)
   ============================================================ */
function pageListing() {
  const id = qs().get("id");
  const l = id && Store.getListing(id);
  const wrap = $("#listing-wrap");
  if (!wrap) return;
  if (!l) { wrap.innerHTML = `<p class="muted">Listing not found. <a href="browse.html">Browse all cars →</a></p>`; return; }

  const city = D.CITIES.find((c) => c.slug === l.city);
  const showSale = l.intent === "sale" || l.intent === "both";
  const showRent = l.intent === "rental" || l.intent === "both";

  const salePane = showSale ? `
    <div class="price-card">
      <div class="price-big">${fmtPrice(l.price)}</div>
      <p class="muted">Private sale price</p>
      <button class="btn btn-primary btn-block" data-contact="buy">Contact seller</button>
      <ul class="mini-checklist">
        <li>Run a CARFAX Canada history report</li>
        <li>${city ? city.note : "Check provincial lien/transfer rules"}</li>
      </ul>
    </div>
    ${comparablesCard(l)}` : "";

  // Shoot rate tiers, derived from the day rate
  const round5 = (n) => Math.round(n / 5) * 5;
  const tiers = {
    hourly: round5(l.dailyRate / 6),
    half: round5(l.dailyRate * 0.6),
    full: l.dailyRate,
  };

  const shootPane = (showRent && l.shootReady) ? `
    <div class="price-card">
      <span class="kicker">Shoot rates</span>
      <div class="rate-tiers">
        <button type="button" class="rate-tier" data-tier="hourly" data-amt="${tiers.hourly}"><span class="rate-amt">${fmtPrice(tiers.hourly)}</span><span class="rate-unit">/ hour</span></button>
        <button type="button" class="rate-tier active" data-tier="half" data-amt="${tiers.half}"><span class="rate-amt">${fmtPrice(tiers.half)}</span><span class="rate-unit">/ half-day</span></button>
        <button type="button" class="rate-tier" data-tier="full" data-amt="${tiers.full}"><span class="rate-amt">${fmtPrice(tiers.full)}</span><span class="rate-unit">/ full day</span></button>
      </div>
      <form id="shoot-form" class="booking-form">
        <label>Shoot date<input type="date" name="date" required></label>
        <label>Shoot type
          <select name="shoot">
            <option>Photoshoot</option><option>Film / commercial</option>
            <option>Music video</option><option>Wedding</option>
            <option>Event / brand</option><option>Student / indie</option>
          </select>
        </label>
        <div class="shoot-total">Estimated: <strong id="shoot-est">${fmtPrice(tiers.half)}</strong> <span class="muted small">+ ${fmtPrice(l.deposit || 0)} deposit</span></div>
        <button class="btn btn-primary btn-block" type="submit">Request this car</button>
        <p class="form-note muted">Inquiry-based — the owner confirms the slot and on-set details with you.</p>
      </form>
      ${l.minAge ? `<p class="muted small">Owner present on set. Driver (if needed): ${l.minAge}+, valid licence, insurance confirmation.</p>` : ""}
    </div>` : "";

  const rentPane = (showRent && !l.shootReady) ? `
    <div class="price-card">
      <div class="price-big">${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>
      <p class="muted">
        ${l.weeklyRate ? fmtPrice(l.weeklyRate) + "/wk &middot; " : ""}
        ${l.monthlyRate ? fmtPrice(l.monthlyRate) + "/mo &middot; " : ""}
        ${l.deposit ? fmtPrice(l.deposit) + " deposit" : ""}
      </p>
      <form id="booking-form" class="booking-form">
        <div class="form-row">
          <label>From<input type="date" name="start" required></label>
          <label>To<input type="date" name="end" required></label>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Request to book</button>
        <p class="form-note muted">Phase 1 is inquiry-based — the owner confirms availability with you directly.</p>
      </form>
      ${l.minAge ? `<p class="muted small">Renter requirements: ${l.minAge}+, valid licence, insurance confirmation.</p>` : ""}
    </div>` : "";

  wrap.innerHTML = `
    <a href="browse.html" class="link back">&larr; Back to browse</a>
    <div class="listing-grid">
      <div>
        <div class="listing-hero ${carImage(l) ? "has-img" : ""}">${
          carImage(l)
            ? `<img src="${carImage(l)}" alt="${titleOf(l)}" loading="lazy" onerror="this.parentNode.classList.remove('has-img');this.replaceWith(document.createTextNode('${l.emoji || "🚗"}'))" />`
            : (l.emoji || "🚗")
        }<div class="badges">${l.shootReady ? '<span class="badge badge-rent">For shoots</span>' + (l.price ? '<span class="badge badge-sale">For sale</span>' : "") : intentBadge(l.intent)}</div></div>
        <h1>${titleOf(l)}</h1>
        <p class="meta-row">${l.mileage ? fmtKm(l.mileage) + " &middot; " : ""}${cityName(l.city)}${l.condition ? " &middot; " + l.condition + " condition" : ""}</p>
        <h2>Description</h2>
        <p>${l.description || "No description provided."}</p>
        <h2>Details</h2>
        <table class="spec-table">
          <tr><th>Make</th><td>${l.make}</td><th>Model</th><td>${l.model}</td></tr>
          <tr><th>Year</th><td>${l.year}</td><th>Mileage</th><td>${l.mileage ? fmtKm(l.mileage) : "—"}</td></tr>
          <tr><th>City</th><td>${cityName(l.city)}</td><th>Listed by</th><td>${l.seller || "Private"}</td></tr>
        </table>
        <h2>Location</h2>
        ${cityMapEmbed(l.city, cityName(l.city))}
        ${carImage(l) ? `<p class="muted small">Photo: Wikimedia Commons</p>` : ""}
      </div>
      <aside class="listing-side">
        ${shootPane}
        ${salePane}
        ${rentPane}
      </aside>
    </div>
    ${packagerHTML(l)}
    <dialog id="contact-dialog">
      <form method="dialog" id="contact-form">
        <h3>Contact about ${titleOf(l)}</h3>
        <label>Your name<input name="name" required></label>
        <label>Email<input type="email" name="email" required></label>
        <label>Message<textarea name="message" rows="4" required>Hi, is this ${titleOf(l)} still available?</textarea></label>
        <div class="hero-actions">
          <button class="btn btn-primary" value="send">Send</button>
          <button class="btn btn-outline" value="cancel" formnovalidate>Cancel</button>
        </div>
      </form>
    </dialog>`;

  // Sale inquiry
  const dialog = $("#contact-dialog");
  $$("[data-contact]").forEach((b) => b.addEventListener("click", () => dialog.showModal()));
  $("#contact-form")?.addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = Object.fromEntries(new FormData(e.target));
    Store.addInquiry({
      listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca",
      kind: "buyer", name: f.name, email: f.email, message: f.message,
    });
    window.submitForm({ _subject: `Inquiry: ${titleOf(l)}`, kind: "buyer", listing: titleOf(l), ...f });
    setTimeout(() => alert("Message sent! The seller will see it in their dashboard inbox."), 50);
  });

  // Rental booking request
  $("#booking-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const days = Math.max(1, Math.round((new Date(f.end) - new Date(f.start)) / 86400000) || 1);
    const total = days * l.dailyRate;
    Store.addBooking({
      listingId: l.id, listingTitle: titleOf(l),
      start: f.start, end: f.end, days, dailyRate: l.dailyRate,
      total, deposit: l.deposit || 0,
    });
    Store.addInquiry({
      listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca",
      kind: "renter", name: "Renter", email: "", message: `Booking request: ${f.start} → ${f.end} (${days} days, est. ${fmtPrice(total)})`,
    });
    window.submitForm({ _subject: `Booking request: ${titleOf(l)}`, kind: "renter", listing: titleOf(l), start: f.start, end: f.end, days, estTotal: total });
    e.target.innerHTML = `<div class="notice ok">Booking request sent for ${days} day(s) — est. <strong>${fmtPrice(total)}</strong>. The owner will confirm availability. <a href="dashboard.html">View in dashboard →</a></div>`;
  });

  // Shoot booking — tier selector + request
  let shootTier = { label: "half-day", amt: tiers.half };
  $$(".rate-tier").forEach((b) => b.addEventListener("click", () => {
    $$(".rate-tier").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    shootTier = { label: b.dataset.tier === "hourly" ? "hour" : b.dataset.tier === "full" ? "full day" : "half-day", amt: Number(b.dataset.amt) };
    const est = $("#shoot-est");
    if (est) est.textContent = fmtPrice(shootTier.amt);
  }));
  $("#shoot-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    Store.addBooking({
      listingId: l.id, listingTitle: titleOf(l),
      start: f.date, end: f.date, days: 1, dailyRate: shootTier.amt,
      total: shootTier.amt, deposit: l.deposit || 0, shoot: f.shoot, tier: shootTier.label,
    });
    Store.addInquiry({
      listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca",
      kind: "renter", name: "Creator", email: "",
      message: `Shoot request: ${f.shoot} on ${f.date}, ${shootTier.label} (est. ${fmtPrice(shootTier.amt)})`,
    });
    window.submitForm({ _subject: `Shoot request: ${titleOf(l)}`, kind: "shoot", listing: titleOf(l), date: f.date, shootType: f.shoot, tier: shootTier.label, est: shootTier.amt });
    e.target.innerHTML = `<div class="notice ok">Shoot request sent — <strong>${f.shoot}</strong> on ${f.date} (${shootTier.label}, est. ${fmtPrice(shootTier.amt)}). The owner will confirm. <a href="dashboard.html">View in dashboard →</a></div>`;
  });

  // Car + photographer package builder
  wirePackager(l);
  // Arriving from a "build a package" link — pre-select that photographer
  const wantPh = qs().get("ph");
  if (wantPh) {
    const btn = $(`.ph-card.selectable[data-ph="${wantPh}"]`);
    if (btn) { btn.click(); setTimeout(() => $(".packager")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200); }
  }
}

/* ============================================================
   PAGE: Dashboard (unified inbox + listings + rental history)
   ============================================================ */
function pageDashboard() {
  const listings = Store.userListings();
  const inquiries = Store.inquiries();
  const bookings = Store.bookings();

  // Stats
  const stats = $("#stats");
  if (stats) {
    const earnings = bookings.reduce((s, b) => s + (b.total || 0), 0);
    stats.innerHTML = `
      ${statCard(listings.length, "Active listings")}
      ${statCard(inquiries.filter((i) => !i.read).length, "Unread inquiries")}
      ${statCard(bookings.length, "Booking requests")}
      ${statCard(fmtPrice(earnings), "Est. booking value")}`;
  }

  // My listings
  const ml = $("#my-listings");
  if (ml) {
    ml.innerHTML = listings.length
      ? listings.map((l) => `
        <div class="row-card">
          <div class="thumb-sm">${l.emoji}</div>
          <div class="grow">
            <strong>${titleOf(l)}</strong> ${intentBadge(l.intent)}
            <div class="muted small">${cityName(l.city)} &middot; listed ${l.created}</div>
          </div>
          <a class="btn btn-sm btn-outline" href="listing.html?id=${l.id}">View</a>
        </div>`).join("")
      : `<p class="muted">No listings yet. <a href="list.html">List your car →</a></p>`;
  }

  // Unified inbox
  const inbox = $("#inbox");
  if (inbox) {
    inbox.innerHTML = inquiries.length
      ? inquiries.map((i) => `
        <div class="row-card ${i.read ? "" : "unread"}">
          <div class="grow">
            <strong>${i.name}</strong>
            <span class="chip chip-${i.kind}">${i.kind}</span>
            <span class="chip">${i.channel}</span>
            <div class="muted small">re: ${i.listingTitle} &middot; ${new Date(i.created).toLocaleDateString("en-CA")}</div>
            <p class="msg">${i.message}</p>
          </div>
        </div>`).join("")
      : `<p class="muted">No inquiries yet. Inquiries from every channel land here.</p>`;
    inquiries.forEach((i) => Store.markInquiryRead(i.id));
  }

  // Rental bookings / agreements
  const bk = $("#bookings");
  if (bk) {
    bk.innerHTML = bookings.length
      ? bookings.map((b) => `
        <div class="row-card">
          <div class="grow">
            <strong>${b.listingTitle}</strong> <span class="chip chip-renter">${b.status}</span>
            <div class="muted small">${b.start} → ${b.end} &middot; ${b.days} day(s) &middot; est. ${fmtPrice(b.total)}</div>
          </div>
          <a class="btn btn-sm btn-outline" href="agreement.html?booking=${b.id}">Generate agreement</a>
        </div>`).join("")
      : `<p class="muted">No booking requests yet.</p>`;
  }

  $("#reset-demo")?.addEventListener("click", () => {
    if (confirm("Clear all demo listings, inquiries, and bookings?")) {
      Store.resetAll(); location.reload();
    }
  });
}
function statCard(n, label) {
  return `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${label}</div></div>`;
}

/* ============================================================
   PAGE: Guides hub (content pillars)
   ============================================================ */
function pageGuides() {
  const wrap = $("#pillars");
  if (!wrap) return;
  wrap.innerHTML = D.PILLARS.map((p) => {
    const arts = D.ARTICLES.filter((a) => a.pillar === p.id);
    return `
      <section class="pillar">
        <div class="pillar-head">
          <span class="phase">${p.phase}</span>
          <h2>${p.title}</h2>
          <p class="muted">${p.blurb}</p>
        </div>
        <ul class="article-list">
          ${arts.map((a) => `<li><a href="article.html?slug=${a.slug}">${a.title}</a> <span class="muted small">${a.readMins} min</span></li>`).join("")}
        </ul>
      </section>`;
  }).join("");
}

/* ============================================================
   PAGE: Article (renders by ?slug=)
   ============================================================ */
function pageArticle() {
  const slug = qs().get("slug");
  const a = D.ARTICLES.find((x) => x.slug === slug);
  const wrap = $("#article-wrap");
  if (!wrap) return;
  if (!a) { wrap.innerHTML = `<p class="muted">Article not found. <a href="guides.html">All guides →</a></p>`; return; }

  document.title = a.title + " | listyourcar.ca";
  const metaEl = $('meta[name="description"]');
  if (metaEl) metaEl.setAttribute("content", a.meta);
  const pillar = D.PILLARS.find((p) => p.id === a.pillar);

  wrap.innerHTML = `
    <a href="guides.html" class="link back">&larr; All guides</a>
    <article class="article">
      <span class="phase">${pillar ? pillar.phase : ""}</span>
      <h1>${a.title}</h1>
      <p class="muted">${a.readMins} min read</p>
      ${a.sections.map((s) => `${s.h ? `<h2>${s.h}</h2>` : ""}<p>${s.p}</p>`).join("")}
      <div class="article-cta">
        <h3>Ready to list your car?</h3>
        <p>Sell it, rent it, or both — one listing, every channel.</p>
        <a class="btn btn-primary" href="list.html">List your car</a>
      </div>
    </article>
    <aside class="related">
      <h3>More in “${pillar ? pillar.title : "Guides"}”</h3>
      <ul class="article-list">
        ${D.ARTICLES.filter((x) => x.pillar === a.pillar && x.slug !== a.slug)
          .map((x) => `<li><a href="article.html?slug=${x.slug}">${x.title}</a></li>`).join("")}
      </ul>
    </aside>`;
}

/* ============================================================
   PAGE: Local landing pages (geo)
   ============================================================ */
function pageLocal() {
  const cs = qs().get("city");
  const intent = qs().get("intent") || "sale";
  const city = D.CITIES.find((c) => c.slug === cs) || D.CITIES[0];
  const wrap = $("#local-wrap");
  if (!wrap) return;

  const isRent = intent === "rental";
  const verb = isRent ? "rent out your car" : "sell your car";
  const Verb = isRent ? "Rent out your car" : "Sell your car";
  document.title = `${Verb} in ${city.name} | listyourcar.ca`;

  const related = D.ARTICLES.filter((a) => (isRent ? a.pillar === "rental" : ["channel", "price", "craft", "trust"].includes(a.pillar))).slice(0, 5);

  wrap.innerHTML = `
    <nav class="crumbs"><a href="index.html">Home</a> / <a href="guides.html">Guides</a> / ${Verb} in ${city.name}</nav>
    <h1>${Verb} in ${city.name}</h1>
    <p class="lead">List your car ${isRent ? "for rent" : "for sale"} in ${city.region}, ${city.province} — free to start, every inquiry in one inbox.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="list.html?intent=${intent}">List your car</a>
      <a class="btn btn-outline" href="browse.html?intent=${intent}&city=${city.slug}">Browse ${city.name} cars</a>
    </div>
    <div class="local-note"><strong>${city.name} note:</strong> ${city.note}</div>
    <h2>${isRent ? "Rental" : "Selling"} listings in ${city.name}</h2>
    <div class="card-grid" id="local-listings"></div>
    <h2>Helpful guides</h2>
    <ul class="article-list">
      ${related.map((a) => `<li><a href="article.html?slug=${a.slug}">${a.title}</a></li>`).join("")}
    </ul>`;

  const items = Store.allListings().filter((l) => {
    if (l.city !== city.slug) return false;
    if (isRent) return l.intent === "rental" || l.intent === "both";
    return l.intent === "sale" || l.intent === "both";
  });
  renderInto("local-listings", items, `No ${isRent ? "rental" : "sale"} listings in ${city.name} yet — be the first!`);
}

/* ============================================================
   PAGE: Photographers directory
   ============================================================ */
function pagePhotographers() {
  const wrap = $("#photographers-wrap");
  if (!wrap) return;
  const phs = D.PHOTOGRAPHERS || [];
  const cities = [...new Set(phs.map((p) => p.city))];
  wrap.innerHTML = `
    <span class="eyebrow">The shoot crew</span>
    <h1>Featured photographers</h1>
    <p class="lead narrow">Book a car and a pro from the same city as one package. Hand-picked shooters across Canada's biggest creative metros — automotive, weddings, fashion and music video.</p>
    <div class="chipbar" id="ph-chips"><span class="chip-label">City</span></div>
    <p class="results-count" id="ph-count"></p>
    <div class="ph-grid" id="ph-grid"></div>`;
  function render(sel) {
    const list = sel ? phs.filter((p) => p.city === sel) : phs;
    $("#ph-grid").innerHTML = list.map(photographerCard).join("");
    $("#ph-count").textContent = `${list.length} photographer${list.length === 1 ? "" : "s"}`;
    $$(".ph-chip").forEach((c) => c.classList.toggle("active", c.dataset.city === sel));
  }
  const chips = $("#ph-chips");
  cities.forEach((cs) => {
    const b = document.createElement("button");
    b.className = "fchip ph-chip"; b.dataset.city = cs; b.textContent = cityName(cs);
    b.addEventListener("click", () => render(b.classList.contains("active") ? "" : cs));
    chips.appendChild(b);
  });
  render(qs().get("city") || "");
}

/* Package builder rendered on a listing detail page */
function packagerHTML(l) {
  const phs = photographersIn(l.city);
  if (!phs.length) return "";
  return `
    <section class="packager">
      <div class="section-head"><div><span class="eyebrow">Complete your shoot</span><h2>Add a photographer</h2></div></div>
      <p class="muted">Book ${titleOf(l)} with a pro from ${cityName(l.city)} as one package — and save 10% on the photographer.</p>
      <div class="ph-grid select">
        ${phs.map((p) => `
          <button type="button" class="ph-card selectable" data-ph="${p.id}" data-rate="${p.rate}" data-name="${p.name}">
            ${phAvatar(p)}
            <div class="ph-body"><h3>${p.name}</h3><p class="ph-meta">${p.specialty}</p><p class="ph-bio">${p.bio}</p>
            <div class="ph-foot"><span class="ph-rate">${fmtPrice(p.rate)}<span class="per">/day</span></span></div></div>
          </button>`).join("")}
      </div>
      <div class="package-summary" id="package-summary" hidden></div>
    </section>`;
}
function wirePackager(l) {
  const dayRate = l.dailyRate;
  $$(".ph-card.selectable").forEach((b) => b.addEventListener("click", () => {
    $$(".ph-card.selectable").forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    const phRate = Number(b.dataset.rate);
    const phNet = Math.round(phRate * 0.9 / 5) * 5;
    const total = dayRate + phNet;
    const sum = $("#package-summary");
    sum.hidden = false;
    sum.innerHTML = `
      <div class="pkg-line"><span>${titleOf(l)} — full day</span><span>${fmtPrice(dayRate)}</span></div>
      <div class="pkg-line"><span>${b.dataset.name} <span class="muted small">· 10% bundle saving</span></span><span>${fmtPrice(phNet)}</span></div>
      <div class="pkg-total"><span>Package total</span><span>${fmtPrice(total)}</span></div>
      <form id="pkg-form"><label>Shoot date<input type="date" name="date" required></label>
        <button class="btn btn-primary btn-block" type="submit">Request this package</button>
        <p class="form-note muted">Inquiry-based — we coordinate the car owner and photographer for your date.</p></form>`;
    $("#pkg-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const date = new FormData(e.target).get("date");
      Store.addBooking({ listingId: l.id, listingTitle: titleOf(l), start: date, end: date, days: 1, dailyRate: dayRate, total, deposit: l.deposit || 0, photographer: b.dataset.name, package: true });
      Store.addInquiry({ listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca", kind: "renter", name: "Creator", email: "", message: `Package request: ${titleOf(l)} + ${b.dataset.name} on ${date} (est. ${fmtPrice(total)})` });
      window.submitForm({ _subject: `Package request: ${titleOf(l)} + ${b.dataset.name}`, kind: "package", car: titleOf(l), photographer: b.dataset.name, date, est: total });
      e.target.parentNode.innerHTML = `<div class="notice ok">Package request sent — <strong>${titleOf(l)} + ${b.dataset.name}</strong> on ${date} (est. ${fmtPrice(total)}). We'll confirm the car and the photographer. <a href="dashboard.html">View in dashboard →</a></div>`;
    });
  }));
}

/* ============================================================
   PAGE: Collections — category & category+city landing pages
   category.html            → all collections (index)
   category.html?cat=vintage         → collection across Canada
   category.html?cat=vintage&city=toronto → collection in a city
   ============================================================ */
function pageCategory() {
  const wrap = $("#category-wrap");
  if (!wrap) return;
  const cats = D.CATEGORIES || [];
  const catId = qs().get("cat");
  const citySlug = qs().get("city");
  const cat = cats.find((c) => c.id === catId);

  const ORIGIN = "https://listyourcar.ca";

  // ---- Collections index (no category selected) ----
  if (!cat) {
    setSeo({
      title: "Collections — cars for photo & film shoots | listyourcar.ca",
      desc: "Browse cars for photo and film shoots by collection and city — vintage, luxury, military, muscle and exotic, across Canada's film metros.",
      canonical: `${ORIGIN}/collections/`,
      image: (cats[0] && cats[0].images[0]) || "",
    });
    wrap.innerHTML = `
      <span class="eyebrow">Browse by look</span>
      <h1>Collections</h1>
      <p class="lead narrow">Find the exact car your shoot needs — by style and by city. Every collection is stocked across Canada's film metros.</p>
      <div class="card-grid collection-grid" data-stagger>
        ${cats.map((c) => `
          <a class="collection-card" href="category.html?cat=${c.id}">
            <div class="collection-thumb"><img src="${c.images[0]}" alt="${c.name}" loading="lazy" /><span class="collection-emoji">${c.emoji}</span></div>
            <div class="collection-body">
              <h3>${c.name}</h3>
              <p>${c.tagline}</p>
              <span class="link">View collection →</span>
            </div>
          </a>`).join("")}
      </div>

      <div class="local-strip">
        <h2>Every collection, every city</h2>
        <p class="muted">Jump straight to a look in your metro.</p>
        ${cats.map((c) => `
          <div class="dir-row">
            <span class="dir-cat">${c.emoji} ${c.name}</span>
            <span class="dir-links">${D.FILM_CITIES.map((cs) => `<a href="category.html?cat=${c.id}&city=${cs}">${cityName(cs)}</a>`).join("")}</span>
          </div>`).join("")}
      </div>`;
    return;
  }

  // ---- A specific collection (optionally in a city) ----
  const city = citySlug && D.CITIES.find((c) => c.slug === citySlug);
  const where = city ? `in ${city.name}` : "across Canada";
  const titleLook = cat.name.toLowerCase();
  setSeo({
    title: `${cat.name} cars for photo & film shoots ${where} | listyourcar.ca`,
    desc: `Rent ${titleLook} cars as backdrops for photo and film shoots ${where}. ${cat.tagline} Browse ${cat.use}.`,
    canonical: `${ORIGIN}/collections/${cat.id}/${city ? city.slug + "/" : ""}`,
    image: cat.images[0],
  });

  const items = Store.allListings().filter((l) =>
    l.category === cat.id &&
    (l.intent === "rental" || l.intent === "both") &&
    (city ? l.city === city.slug : true)
  );

  const otherCities = D.FILM_CITIES.filter((cs) => cs !== citySlug);
  const otherCats = D.CATEGORIES.filter((c) => c.id !== cat.id);

  wrap.innerHTML = `
    <nav class="crumbs"><a href="index.html">Home</a> / <a href="category.html">Collections</a> / <a href="category.html?cat=${cat.id}">${cat.name}</a>${city ? " / " + city.name : ""}</nav>
    <span class="eyebrow">${cat.emoji} ${cat.name} collection</span>
    <h1>${cat.name} cars for photo &amp; film shoots ${where}</h1>
    <p class="lead narrow">${cat.tagline} Perfect for ${cat.use}. ${city ? `Available now in ${city.name} — book by the hour or the day.` : "Stocked in every Canadian film metro."}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="list.html?intent=rental">List your ${titleLook.split(" ")[0]} car</a>
      ${city ? `<a class="btn btn-ghost" href="category.html?cat=${cat.id}">See all cities</a>` : ""}
    </div>
    ${city ? `<div class="local-note"><strong>${city.name}:</strong> ${city.note}</div>` : ""}

    <div class="section-head" style="margin-top:2.5rem"><h2>${items.length} ${items.length === 1 ? "car" : "cars"} ${where}</h2></div>
    <div class="card-grid" id="cat-listings"></div>

    <div class="local-strip">
      <h2>${cat.name} in other cities</h2>
      <div class="local-links">
        ${otherCities.map((cs) => `<a href="category.html?cat=${cat.id}&city=${cs}">${cat.name} in ${cityName(cs)}</a>`).join("")}
      </div>
    </div>

    <div class="local-strip">
      <h2>Other collections${city ? " in " + city.name : ""}</h2>
      <div class="local-links">
        ${otherCats.map((c) => `<a href="category.html?cat=${c.id}${city ? "&city=" + city.slug : ""}">${c.emoji} ${c.name}</a>`).join("")}
      </div>
    </div>`;

  renderInto("cat-listings", items, "No cars here yet — be the first to list one.");
}

/* ============================================================
   PAGE: Rental agreement generator
   ============================================================ */
function pageAgreement() {
  const wrap = $("#agreement-wrap");
  if (!wrap) return;
  const bookingId = qs().get("booking");
  const booking = Store.bookings().find((b) => b.id === bookingId);
  const listing = booking && Store.getListing(booking.listingId);
  const today = new Date().toLocaleDateString("en-CA");

  if (!booking || !listing) {
    wrap.innerHTML = `<p class="muted">No booking selected. Generate an agreement from a booking in your <a href="dashboard.html">dashboard</a>.</p>`;
    return;
  }
  const city = D.CITIES.find((c) => c.slug === listing.city);
  const province = city ? city.province : "your province";

  wrap.innerHTML = `
    <div class="no-print hero-actions">
      <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
      <a class="btn btn-outline" href="dashboard.html">Back to dashboard</a>
    </div>
    <article class="agreement">
      <h1>Vehicle Rental Agreement</h1>
      <p class="muted">Generated by listyourcar.ca on ${today} &middot; Province: ${province}</p>
      <p>This agreement is made between the <strong>Owner</strong> (${listing.seller || "Owner"}) and the <strong>Renter</strong>, for the rental of the vehicle described below.</p>

      <h2>1. Vehicle</h2>
      <table class="spec-table">
        <tr><th>Vehicle</th><td>${titleOf(listing)}</td></tr>
        <tr><th>Location</th><td>${cityName(listing.city)}, ${province}</td></tr>
        <tr><th>Odometer at pickup</th><td>${listing.mileage ? fmtKm(listing.mileage) : "_____________"}</td></tr>
      </table>

      <h2>2. Rental period</h2>
      <table class="spec-table">
        <tr><th>Start date</th><td>${booking.start}</td><th>End date</th><td>${booking.end}</td></tr>
        <tr><th>Total days</th><td>${booking.days}</td><th>Daily rate</th><td>${fmtPrice(booking.dailyRate)}</td></tr>
      </table>

      <h2>3. Charges</h2>
      <table class="spec-table">
        <tr><th>Rental subtotal</th><td>${fmtPrice(booking.total)}</td></tr>
        <tr><th>Security deposit</th><td>${fmtPrice(booking.deposit || 0)} (refundable)</td></tr>
      </table>

      <h2>4. Renter requirements</h2>
      <ul>
        <li>Minimum age: ${listing.minAge || 21} years</li>
        <li>Valid driver's licence required (photographed at pickup)</li>
        <li>Renter confirms valid insurance / accepts owner's coverage terms</li>
      </ul>

      <h2>5. Insurance &amp; liability</h2>
      <p>The Owner confirms appropriate coverage is in place for this rental (e.g., OPCF 27 endorsement in Ontario or provincial equivalent). The Renter is responsible for damage, tolls, and fines incurred during the rental period, up to the terms agreed here.</p>

      <h2>6. Condition &amp; return</h2>
      <p>The vehicle is rented in its current condition. The Renter agrees to return it on the end date, at the agreed fuel level, in the same condition aside from normal wear.</p>

      <h2>7. Signatures</h2>
      <div class="sign-grid">
        <div><div class="sign-line"></div>Owner signature &middot; Date</div>
        <div><div class="sign-line"></div>Renter signature &middot; Date</div>
      </div>
      <p class="muted small">This is a prototype document template, not legal advice. Have province-specific agreements reviewed by a qualified professional before use.</p>
    </article>`;
}

/* ============================================================
   Demo form handler (contact / generic)
   ============================================================ */
function initDemoForms() {
  const f = document.getElementById("contact-page-form");
  if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    const payload = { _subject: "listyourcar.ca contact form", ...Object.fromEntries(new FormData(f)) };
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    const r = await window.submitForm(payload);
    if (btn) { btn.disabled = false; btn.textContent = "Send message"; }
    if (r.demo) {
      alert("Thanks! Demo mode — set FORM_ENDPOINT in js/config.js to receive submissions for real.");
    } else if (r.ok) {
      alert("Thanks! Your message has been sent.");
    } else {
      alert("Sorry, something went wrong sending your message. Please email hello@listyourcar.ca.");
      return;
    }
    f.reset();
  });
}

/* ============================================================
   Dispatch
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initDemoForms();
  const page = document.body.dataset.page;
  ({
    home: pageHome,
    browse: pageBrowse,
    list: pageList,
    listing: pageListing,
    dashboard: pageDashboard,
    guides: pageGuides,
    article: pageArticle,
    local: pageLocal,
    category: pageCategory,
    photographers: pagePhotographers,
    agreement: pageAgreement,
  }[page] || (() => {}))();
});
