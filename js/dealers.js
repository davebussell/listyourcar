/* ============================================================
   listyourcar.ca — dealer proximity network

   Finds the dealerships closest to a car and lets the seller shape
   the invitation list: narrow it to the marques that actually retail
   their vehicle, or pick rooftops by hand.

   Positions come from postal areas (FSA), geocoded once at build
   time, so a Toronto seller gets rooftops ranked across the GTA
   rather than a coin-toss between 122 dealers sharing one centroid.
   Runtime matching is pure arithmetic — no API, no key, no cost.

   The dataset is ~400KB, so it loads lazily and only where needed.

   NOTE ON SENDING: matching a dealer is not the same as lawfully
   messaging one. Invitations are recorded as "matched"; delivery is
   a separate, deliberate step.
   ============================================================ */

const DealerNet = (() => {
  /* The release version this script was loaded with (?v=33 and so on),
     carried onto the data it fetches so a new release never pairs new
     code with a cached old bundle. Empty when run by the Node build. */
  const ASSET_V = (() => {
    try { return new URL(document.currentScript.src, location.href).searchParams.get("v") || ""; }
    catch { return ""; }
  })();
  const withV = (u) => (ASSET_V ? u + "?v=" + ASSET_V : u);
  let _data = null;          // { positions:[[city,prov,lat,lon]], dealers:[[name,posIdx,postal,phone,web,staff,brands]], brands:[] }
  let _loading = null;
  const _postalCache = {};   // FSA -> [lat,lon], so a retyped code costs nothing

  function load() {
    if (_data) return Promise.resolve(_data);
    if (_loading) return _loading;
    _loading = fetch(withV("/data/dealers.json"))
      .then((r) => { if (!r.ok) throw new Error("dealer data " + r.status); return r.json(); })
      .then((d) => { _data = d; return d; })
      .catch((e) => { _loading = null; throw e; });
    return _loading;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ---------- Locating the seller ---------- */

  const FSA_RE = /^[A-Za-z]\d[A-Za-z]/;
  const FULL_RE = /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/;
  const normPostal = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
  const pretty = (c) => c.length === 6 ? c.slice(0, 3) + " " + c.slice(3) : c;
  const inCanada = (la, lo) => la >= 41 && la <= 83.5 && lo >= -141.5 && lo <= -52;
  /* A "0" in the second position marks a rural code. Its first three
     characters cover a region, not a neighbourhood — J0X spans the
     whole Outaouais, over 100 km wide — so for these the district
     centroid is a last resort, not an answer. */
  const isRural = (c) => c[1] === "0";

  /* The full six-character code, resolved to the street or village.
     Only trusted when the service echoes the same code back and the
     point lands in Canada: a fuzzy near-miss is worse than a miss. */
  async function fromFullCode(clean) {
    const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
      postalcode: pretty(clean), country: "Canada", format: "json", limit: "1", addressdetails: "1",
    });
    const res = await fetch(url);
    if (!res.ok) return null;
    const hit = (await res.json())[0];
    if (!hit) return null;
    const a = hit.address || {};
    if (normPostal(a.postcode) !== clean) return null;
    const lat = +hit.lat, lon = +hit.lon;
    if (!inCanada(lat, lon)) return null;
    const prov = a["ISO3166-2-lvl4"] ? a["ISO3166-2-lvl4"].replace("CA-", "") : (a.state || "");
    return {
      lat, lon, province: prov,
      place: a.village || a.town || a.city || a.municipality || a.hamlet || a.county || "",
      precision: "postal",
    };
  }

  /* The three-character district, from the postal centroid service. */
  async function fromDistrict(fsa) {
    const res = await fetch("https://api.zippopotam.us/ca/" + fsa);
    if (!res.ok) return null;
    const j = await res.json();
    const p = j.places && j.places[0];
    if (!p) return null;
    return {
      lat: +p.latitude, lon: +p.longitude,
      place: p["place name"], province: p["state abbreviation"] || p.state,
      precision: "district",
    };
  }

  /* Resolves a postal code to a point, as precisely as the code allows.
     A full code is tried first; the district is the fallback. The
     result carries `precision` so callers can say how sure to be —
     an urban district is a neighbourhood, a rural one is a region. */
  async function fromPostal(code) {
    const clean = normPostal(code);
    if (!FSA_RE.test(clean)) throw new Error("That doesn't look like a Canadian postal code.");
    const fsa = clean.slice(0, 3);
    const full = FULL_RE.test(clean);
    const key = full ? clean : fsa;
    if (_postalCache[key]) return { ..._postalCache[key] };

    let loc = null;
    if (full) {
      try { loc = await fromFullCode(clean); } catch { loc = null; }
    }
    if (!loc) {
      try { loc = await fromDistrict(fsa); } catch { loc = null; }
    }
    if (!loc) throw new Error("We couldn't find that postal code.");

    const out = {
      ...loc, source: "postal",
      label: loc.precision === "postal" ? pretty(clean) : fsa,
      rural: isRural(clean),
    };
    _postalCache[key] = out;
    return { ...out };
  }

  /* Device location, when the visitor would rather not type. */
  function fromDevice() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("This browser can't share a location."));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude, lon: pos.coords.longitude,
          place: "your location", source: "device",
        }),
        (err) => reject(new Error(
          err.code === 1 ? "Location permission was declined — enter a postal code instead."
                         : "Couldn't read your location. Try a postal code."
        )),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });
  }

  /* An auction city slug, for callers that already know the market. */
  function fromCity(slug) {
    const c = (window.LYC_DATA?.CITIES || []).find((x) => x.slug === slug);
    return c ? { lat: c.lat, lon: c.lon, place: c.name, province: c.province, source: "city" } : null;
  }

  /* ---------- Who buys what ---------- */

  /* Marque tiers. A dealer's tier is the highest tier it carries, so
     an Audi–Volkswagen store counts as luxury. Anything not listed is
     mainstream. Tesla sells direct and is not in the network. */
  const TIER = {
    exotic: ["Ferrari", "Lamborghini", "McLaren", "Rolls-Royce", "Bentley", "Aston Martin", "Maserati"],
    luxury: ["Audi", "BMW", "Mercedes-Benz", "Lexus", "Porsche", "Jaguar", "Land Rover", "Genesis",
             "Acura", "Infiniti", "Cadillac", "Lincoln", "Volvo", "Alfa Romeo"],
  };
  const tierOfBrands = (bs) =>
    bs.some((b) => TIER.exotic.includes(b)) ? "exotic"
    : bs.some((b) => TIER.luxury.includes(b)) ? "luxury"
    : bs.length ? "mainstream" : "";

  /* Match a typed make to a network marque: "merc" -> Mercedes-Benz,
     "vw" -> Volkswagen, "chevy" -> Chevrolet. */
  const ALIAS = { vw: "Volkswagen", chevy: "Chevrolet", merc: "Mercedes-Benz", mercedes: "Mercedes-Benz",
                  benz: "Mercedes-Benz", landrover: "Land Rover", rangerover: "Land Rover",
                  "alfa": "Alfa Romeo", "aston": "Aston Martin", "rolls": "Rolls-Royce", "mb": "Mercedes-Benz" };
  function canonMake(make) {
    const q = String(make || "").trim().toLowerCase();
    if (!q) return "";
    const key = q.replace(/[^a-z]/g, "");
    if (ALIAS[key]) return ALIAS[key];
    const all = [...TIER.exotic, ...TIER.luxury, ...(_data ? _data.brands : [])];
    return all.find((b) => b.toLowerCase().replace(/[^a-z]/g, "") === key)
        || all.find((b) => b.toLowerCase().startsWith(q))
        || String(make).trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /* The kinds of car a seller can say they have. */
  const KINDS = ["everyday", "luxury", "exotic", "classic", "truck", "performance"];
  const KIND_LABEL = { everyday: "Everyday car", luxury: "Luxury", exotic: "Exotic",
                       classic: "Classic or vintage", truck: "Truck or commercial", performance: "Performance" };

  /* Best guess at the kind from the make and year; the seller can
     override. Twenty-five years is the usual collector threshold. */
  function guessKind(car) {
    const make = canonMake(car && car.make);
    const year = Number(car && car.year) || 0;
    if (year && year <= new Date().getFullYear() - 25) return "classic";
    const t = tierOfBrands([make]);
    if (t === "exotic" || t === "luxury") return t;
    if (car && car.body === "truck") return "truck";
    return "everyday";
  }

  /* The audiences a car can be offered to, each a predicate over a
     dealer. Which ones a seller starts with depends on the kind. */
  function audiencesFor(car) {
    const make = canonMake(car && car.make);
    const kind = (car && KINDS.includes(car.kind)) ? car.kind : guessKind(car);
    const defaults = {
      everyday:    ["make", "indep"],
      luxury:      ["make", "luxury", "indep"],
      exotic:      ["make", "exotic", "luxury"],
      classic:     ["classic", "make", "indep"],
      truck:       ["truck", "make", "indep"],
      performance: ["performance", "make", "indep"],
    }[kind];
    const all = [
      { key: "make",        label: make ? make + " dealers" : "Your marque",
        test: (x) => !!make && x.brands.includes(make) },
      { key: "luxury",      label: "Luxury marques",    test: (x) => x.tier === "luxury" || x.tier === "exotic" },
      { key: "exotic",      label: "Exotic marques",    test: (x) => x.tier === "exotic" },
      { key: "classic",     label: "Classic specialists",     test: (x) => x.spec === "classic" },
      { key: "truck",       label: "Truck specialists",       test: (x) => x.spec === "truck" },
      { key: "performance", label: "Performance specialists", test: (x) => x.spec === "performance" },
      { key: "import",      label: "Import specialists",      test: (x) => x.spec === "import" },
      { key: "ev",          label: "EV specialists",          test: (x) => (x.focus || []).includes("ev") },
      { key: "premium",     label: "Premium independents",    test: (x) => !x.brands.length && (x.focus || []).includes("premium") },
      { key: "budget",      label: "Budget lots",             test: (x) => !x.brands.length && (x.focus || []).includes("budget") },
      { key: "indep",       label: "Independent used-car dealers",
        test: (x) => !x.brands.length && (x.spec === "" || x.spec === "import") },
      { key: "groups",      label: "Dealer groups",           test: (x) => x.sites >= 2 || !!x.group },
      { key: "franchise",   label: "Any franchised dealer",  test: (x) => x.brands.length > 0 },
    ].filter((a) => a.key !== "make" || make);
    return { make, kind, defaults, all };
  }

  /* ---------- Ranking ---------- */

  /* The profile codes written by build-dealers.js, read back into
     plain fields. Anything absent is the default: a single-site,
     English-speaking car dealer of medium marque confidence. */
  const SIZE_LABEL = { 1: "1–5 staff", 2: "6–20 staff", 3: "21–60 staff", 4: "61–150 staff", 5: "150+ staff" };
  const SITES_LABEL = { 1: "Single location", 2: "2–5 locations", 3: "6+ locations" };
  function profileOf(codes) {
    const p = { role: "dealer", size: 2, sites: 1, group: "", french: false, focus: [],
                multi: false, tollfree: false, confidence: "medium",
                // What the dealer's own website says; read=false means unknown.
                web: { read: false, buys: false, page: false, trade: false, tool: false, used: false, cpo: false } };
    (codes || []).forEach((c) => {
      if (/^W\d+$/.test(c)) {          // what the dealer website says, as bits
        const b = +c.slice(1);
        p.web = { read: !!(b & 1), buys: !!(b & 2), page: !!(b & 4), trade: !!(b & 8), tool: !!(b & 16), used: !!(b & 32), cpo: !!(b & 64) };
      }
      else if (c === "z") p.siteLost = true;   // its listed website now belongs to someone else
      else if (c.startsWith("r:")) p.role = c.slice(2);
      else if (/^s[1-5]$/.test(c)) p.size = +c[1];
      else if (/^l[1-3]$/.test(c)) p.sites = +c[1];
      else if (c.startsWith("g:")) p.group = c.slice(2);
      else if (c === "fr") p.french = true;
      else if (c.startsWith("x:")) p.focus.push(c.slice(2));
      else if (c === "multi") p.multi = true;
      else if (c === "tf") p.tollfree = true;
      else if (c.startsWith("c:")) p.confidence = c.slice(2);
    });
    return p;
  }

  function hydrate(d, dist) {
    return d.dealers.map((row, i) => ({
      id: "d" + i,
      pos: row[1],               // index into positions; the map groups on it
      name: row[0],
      city: d.positions[row[1]][0],
      province: d.positions[row[1]][1],
      lat: d.positions[row[1]][2],
      lon: d.positions[row[1]][3],
      postal: row[2] || "",
      phone: row[3] || "",
      website: row[4] || "",
      staff: row[5] || 0,
      brands: row[6] || [],
      spec: row[7] || "",
      tier: tierOfBrands(row[6] || []),
      km: dist ? dist[row[1]] : null,
      email: row[9] || "",       // only dealers who have given an address — see build-dealers.js
      ...profileOf(row[8]),
    }));
  }

  /* One dealer by the id the lists link with. */
  async function byId(id) {
    const d = await load();
    const i = Number(String(id || "").replace(/^d/, ""));
    if (!Number.isInteger(i) || i < 0 || i >= d.dealers.length) return null;
    return hydrate(d)[i];
  }

  /* Every dealer, scored against an origin. Callers slice what they
     need after filtering, so a brand filter still returns the ten
     nearest of that marque rather than ten from an already-cut list.

     `audience` is a list of audience keys from audiencesFor(); a dealer
     is kept if it matches any of them. Without one, `type` narrows to
     franchised or independent as before. Businesses tagged "other"
     (RV, marine, leasing) are left out unless asked for by type. */
  async function ranked(origin, opts = {}) {
    const d = await load();
    const dist = d.positions.map((p) => haversine(origin.lat, origin.lon, p[2], p[3]));
    const { brands = [], type = "all", maxKm = null, audience = null, car = null } = opts;

    let list = hydrate(d, dist);

    if (audience && audience.length) {
      const tests = audiencesFor(car).all.filter((a) => audience.includes(a.key)).map((a) => a.test);
      list = list.filter((x) => x.spec !== "other" && tests.some((t) => t(x)));
    } else {
      if (type === "franchise") list = list.filter((x) => x.brands.length);
      else if (type === "independent") list = list.filter((x) => !x.brands.length && x.spec !== "other");
      else list = list.filter((x) => x.spec !== "other");
    }
    if (brands.length) list = list.filter((x) => x.brands.some((b) => brands.includes(b)));
    if (maxKm != null) list = list.filter((x) => x.km <= maxKm);

    return list.sort((a, b) => a.km - b.km || b.staff - a.staff || a.name.localeCompare(b.name));
  }

  /* How many dealers each audience would reach within a radius, so a
     chip can say "Toyota dealers (14)" and never offer an empty one. */
  async function audienceCounts(origin, car, km = 150) {
    const d = await load();
    const dist = d.positions.map((p) => haversine(origin.lat, origin.lon, p[2], p[3]));
    const near = hydrate(d, dist).filter((x) => x.km <= km && x.spec !== "other");
    const a = audiencesFor(car);
    return a.all.map((aud) => ({ key: aud.key, label: aud.label, n: near.filter(aud.test).length }));
  }

  async function nearest(origin, n = 10, opts = {}) {
    return (await ranked(origin, opts)).slice(0, n);
  }

  async function countWithin(origin, km = 100) {
    const d = await load();
    const dist = d.positions.map((p) => haversine(origin.lat, origin.lon, p[2], p[3]));
    return d.dealers.reduce((n, row) => n + (dist[row[1]] <= km ? 1 : 0), 0);
  }

  /* Marques actually present near an origin, so the filter never
     offers a brand with nothing behind it. */
  async function brandsNear(origin, km = 150) {
    const d = await load();
    const dist = d.positions.map((p) => haversine(origin.lat, origin.lon, p[2], p[3]));
    const tally = {};
    d.dealers.forEach((row) => {
      if (dist[row[1]] > km) return;
      (row[6] || []).forEach((b) => { tally[b] = (tally[b] || 0) + 1; });
    });
    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  }

  /* Every dealer as a full record — profile fields included — with no
     distance. The map uses this rather than building its own records,
     so a filter that reads a profile field works everywhere at once. */
  async function all() { return hydrate(await load()); }

  /* The same records from an already-loaded bundle, without fetching.
     The page builder uses this in Node to write the same takes the
     browser shows. */
  const fromBundle = (d) => hydrate(d);

  /* ============================================================
     Buyer's take — how good a buyer this dealer is likely to be for
     a seller, and why.

     Every point comes from a stated, checkable fact: what the
     dealer's own website says, what it sells, how it is organised,
     and — when the seller has told us — how well that matches their
     car. Nothing here judges honesty, service or price; those are
     not in the data and the take does not pretend otherwise.

     A website signal that was not found scores nothing rather than
     counting against the dealer: plenty of good buyers have homepages
     a plain read cannot see into.
     ============================================================ */
  const TIERS = [[50, "strong", "Strong fit"], [30, "good", "Good fit"], [0, "ask", "Worth asking"]];
  const KIND_WORD = { classic: "classic cars", truck: "trucks", performance: "performance cars",
                      ev: "electric and hybrid cars", luxury: "luxury marques", exotic: "exotic marques" };

  function buyerTake(d, car) {
    const reasons = [];
    const add = (pts, text, source, key) => reasons.push({ pts, text, source, key });
    const web = d.web || {};
    const make = car && car.make ? canonMake(car.make) : "";
    const kind = car && (car.make || car.year) ? (car.kind || guessKind(car)) : "";

    if (make && d.brands.includes(make)) add(25, `Sells ${make} new — usually the strongest buyer for a used one`, "network", "make");
    if (web.buys) add(30, "Says on its website that it buys cars from the public", "website", "buys");
    if (web.page) add(10, "Has a page on its site for selling or trading in your car", "website", "page");
    if (web.trade || web.tool) add(10, "Offers trade-in appraisals online", "website", web.tool ? "tool" : "trade");
    if ((kind === "luxury" || kind === "exotic") && (d.tier === "luxury" || d.tier === "exotic") && !(make && d.brands.includes(make)))
      add(12, `Deals in ${d.tier} marques`, "network", "tier");
    const spec = { classic: "classic", truck: "truck", performance: "performance" }[kind];
    if (spec && (d.spec === spec || (d.focus || []).includes(spec))) add(20, `Specialises in ${KIND_WORD[kind]}`, "network", "spec");
    if (web.used) add(8, "Lists used inventory on its site", "website", "used");
    if (!d.brands.length) add(8, "Independent — buys across every make", "network", "indep");
    if (d.group) add(8, `Part of the ${d.group} group — can move a car between its lots`, "network", "group");
    else if (d.sites >= 2) add(8, "Runs more than one location", "network", "sites");
    if (web.cpo) add(4, "Runs a certified pre-owned program, so it wants clean late-model trades", "website", "cpo");
    if (d.size >= 4) add(4, "A larger operation", "network", "size");

    reasons.sort((a, b) => b.pts - a.pts);
    const score = reasons.reduce((a, r) => a + r.pts, 0);
    const [, tier, label] = TIERS.find(([min]) => score >= min);
    const top = reasons.slice(0, 2).map((r) => r.text.charAt(0).toLowerCase() + r.text.slice(1).split(" — ")[0]);
    const headline = top.length
      ? label + ": " + top.join(", and ") + "."
      : label + ": in our network, near you.";
    // The same reasons as a sentence that stands after a verdict chip.
    const summary = top.length
      ? top.join(", and ").replace(/^./, (c) => c.toUpperCase()) + "."
      : "In our network, near you.";
    return {
      score, tier, label, headline, summary, reasons,
      unknown: !web.read,
      note: d.siteLost
        ? "The website we had for this dealer now belongs to someone else, so it may have closed. Call before relying on it."
        : web.read ? "" : "We couldn't read this dealer's website, so this take uses our network data only.",
    };
  }

  /* Recommended order: the best fits among the dealers nearby, with a
     gentle pull toward the closer ones (about 10 points per 25 km). */
  function recommend(list, car) {
    return list.map((d) => ({ d, t: buyerTake(d, car) }))
      .sort((a, b) => (b.t.score - (b.d.km || 0) * 0.4) - (a.t.score - (a.d.km || 0) * 0.4))
      .map((x) => x.d);
  }

  /* Evidence quotes, fetched only by the pages that show them. */
  let _evidence = null;
  function evidence() {
    if (_evidence) return _evidence;
    _evidence = {};   // shard key -> promise
    return _evidence;
  }
  const siteKey = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  async function evidenceFor(d) {
    const dom = siteKey(d.website);
    if (!dom) return null;
    const shards = evidence();
    const k = /^[a-z0-9]/.test(dom) ? dom[0] : "_";
    if (!shards[k]) shards[k] = fetch(withV("/data/evidence/" + k + ".json"))
      .then((r) => (r.ok ? r.json() : { sites: {} })).catch(() => ({ sites: {} }));
    const e = await shards[k];
    return (e.sites || {})[dom] || null;
  }

  /* A side-by-side comparison of a few dealers, as an HTML table. Used
     by the start flow, the sell form and the dealer page. */
  function compareHTML(dealers, car) {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const yes = '<span class="cmp-yes">Yes</span>', unk = '<span class="cmp-unk">Not stated</span>', no = '<span class="cmp-no">No</span>';
    const takes = dealers.map((d) => buyerTake(d, car));
    const make = car && car.make ? canonMake(car.make) : "";
    const row = (label, cells) => `<tr><th scope="row">${label}</th>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    const w = (d, k) => (d.web && d.web.read ? (d.web[k] ? yes : unk) : '<span class="cmp-unk">Site not read</span>');
    return `<div class="table-scroll cmp-scroll"><table class="cmp-table">
      <thead><tr><th></th>${dealers.map((d) => `<th scope="col"><a class="dealer-link" href="/dealer.html?id=${d.id}">${esc(d.name)}</a><span>${esc(d.city)}, ${esc(d.province)}</span></th>`).join("")}</tr></thead>
      <tbody>
        ${row("Buyer's take", takes.map((t) => `<span class="take-chip take-${t.tier}">${t.label}</span>`))}
        ${d0(dealers, "km") ? row("Distance", dealers.map((d) => d.km == null ? "—" : (d.km < 1 ? "Under 1" : Math.round(d.km)) + " km")) : ""}
        ${make ? row(`Sells ${esc(make)} new`, dealers.map((d) => (d.brands.includes(make) ? yes : no))) : ""}
        ${row("Says it buys cars", dealers.map((d) => w(d, "buys")))}
        ${row("Online appraisal", dealers.map((d) => (d.web && d.web.read ? (d.web.trade || d.web.tool ? yes : unk) : '<span class="cmp-unk">Site not read</span>')))}
        ${row("Used stock listed", dealers.map((d) => w(d, "used")))}
        ${row("Makes sold", dealers.map((d) => (d.brands.length ? esc(d.brands.join(", ")) : "Independent")))}
        ${row("Group", dealers.map((d) => (d.group ? esc(d.group) : d.sites >= 2 ? "Multi-site" : "—")))}
        ${row("Phone", dealers.map((d) => (d.phone ? `<a href="tel:${d.phone.replace(/[^0-9+]/g, "")}">${esc(d.phone)}</a>` : "—")))}
      </tbody></table></div>`;
  }
  const d0 = (list, k) => list.some((d) => d[k] != null);

  /* The marques in the network, once loaded; empty before that. */
  const brands = () => (_data ? _data.brands : []);

  return { load, nearest, ranked, countWithin, brandsNear, fromPostal, fromDevice, fromCity, haversine,
           byId, audiencesFor, audienceCounts, guessKind, canonMake, KINDS, KIND_LABEL, tierOfBrands, brands,
           SIZE_LABEL, SITES_LABEL, all, fromBundle, buyerTake, recommend, evidenceFor, compareHTML, TIERS };
})();

window.DealerNet = DealerNet;
