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
  let _data = null;          // { positions:[[city,prov,lat,lon]], dealers:[[name,posIdx,postal,phone,web,staff,brands]], brands:[] }
  let _loading = null;
  const _postalCache = {};   // FSA -> [lat,lon], so a retyped code costs nothing

  function load() {
    if (_data) return Promise.resolve(_data);
    if (_loading) return _loading;
    _loading = fetch("/data/dealers.json")
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
  const normPostal = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();

  /* Canadian postal codes resolve to a neighbourhood, not a city —
     which is the whole point of asking for one. */
  async function fromPostal(code) {
    const clean = normPostal(code);
    if (!FSA_RE.test(clean)) throw new Error("That doesn't look like a Canadian postal code.");
    const fsa = clean.slice(0, 3);
    if (_postalCache[fsa]) return { ..._postalCache[fsa], source: "postal", label: fsa };

    const res = await fetch("https://api.zippopotam.us/ca/" + fsa);
    if (!res.ok) throw new Error("We couldn't find that postal code.");
    const j = await res.json();
    const p = j.places && j.places[0];
    if (!p) throw new Error("We couldn't find that postal code.");
    const loc = {
      lat: +p.latitude, lon: +p.longitude,
      place: p["place name"], province: p["state abbreviation"] || p.state,
    };
    _postalCache[fsa] = loc;
    return { ...loc, source: "postal", label: fsa };
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

  /* ---------- Ranking ---------- */

  /* Every dealer, scored against an origin. Callers slice what they
     need after filtering, so a brand filter still returns the ten
     nearest of that marque rather than ten from an already-cut list. */
  async function ranked(origin, opts = {}) {
    const d = await load();
    const dist = d.positions.map((p) => haversine(origin.lat, origin.lon, p[2], p[3]));
    const { brands = [], type = "all", maxKm = null } = opts;

    let list = d.dealers.map((row, i) => ({
      id: "d" + i,
      name: row[0],
      city: d.positions[row[1]][0],
      province: d.positions[row[1]][1],
      postal: row[2] || "",
      phone: row[3] || "",
      website: row[4] || "",
      staff: row[5] || 0,
      brands: row[6] || [],
      km: dist[row[1]],
    }));

    if (brands.length) list = list.filter((x) => x.brands.some((b) => brands.includes(b)));
    if (type === "franchise") list = list.filter((x) => x.brands.length);
    else if (type === "independent") list = list.filter((x) => !x.brands.length);
    if (maxKm != null) list = list.filter((x) => x.km <= maxKm);

    return list.sort((a, b) => a.km - b.km || b.staff - a.staff || a.name.localeCompare(b.name));
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

  return { load, nearest, ranked, countWithin, brandsNear, fromPostal, fromDevice, fromCity, haversine };
})();

window.DealerNet = DealerNet;
