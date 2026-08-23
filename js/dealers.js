/* ============================================================
   listyourcar.ca — dealer proximity network

   Matches a listed car to the dealerships closest to it, so the
   seller can see exactly who is being invited to bid and the
   platform has a concrete outreach list per lot.

   Source: a Canadian dealer dataset (4,441 rooftops) compiled at
   build time by build-dealers.js. City coordinates are geocoded
   once, offline, so matching at runtime is pure arithmetic — no
   API, no key, no per-listing cost.

   The dataset is ~300KB, so it is fetched lazily and only on the
   surfaces that actually need it, never on the general page load.

   NOTE ON SENDING: matching a dealer is not the same as lawfully
   messaging one. See notifyDealers() before wiring real delivery.
   ============================================================ */

const DealerNet = (() => {
  let _data = null;      // { cities:[[name,prov,lat,lon]], dealers:[[name,cityIdx,postal,phone,web,staff]] }
  let _loading = null;

  /* Lazy load, once, shared across callers. */
  function load() {
    if (_data) return Promise.resolve(_data);
    if (_loading) return _loading;
    _loading = fetch("/data/dealers.json")
      .then((r) => { if (!r.ok) throw new Error("dealer data " + r.status); return r.json(); })
      .then((d) => { _data = d; return d; })
      .catch((e) => { _loading = null; throw e; });
    return _loading;
  }

  /* Great-circle distance in km. */
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* Resolve a seller location to coordinates. Accepts an auction
     city slug, or an explicit {lat,lon}. */
  function originFor(where) {
    if (where && typeof where === "object" && where.lat != null) return where;
    const c = (window.LYC_DATA?.CITIES || []).find((x) => x.slug === where);
    return c ? { lat: c.lat, lon: c.lon, name: c.name } : null;
  }

  /* The n dealerships closest to a listing, nearest first. */
  async function nearest(where, n = 10) {
    const origin = originFor(where);
    if (!origin) return [];
    const d = await load();

    // Distance is per city, not per dealer — so compute it once per
    // city and reuse it across every rooftop in that city.
    const cityDist = d.cities.map((c) => haversine(origin.lat, origin.lon, c[2], c[3]));

    return d.dealers
      .map((row, i) => ({
        id: "d" + i,
        name: row[0],
        city: d.cities[row[1]][0],
        province: d.cities[row[1]][1],
        postal: row[2] || "",
        phone: row[3] || "",
        website: row[4] || "",
        staff: row[5] || 0,
        km: cityDist[row[1]],
      }))
      /* Distance is resolved to city level, so every rooftop in the
         seller's own city ties at the same figure. Breaking those ties
         on headcount surfaces the dealerships with the volume to
         actually bid, instead of whichever row happened to come first
         in the source file. */
      .sort((a, b) => a.km - b.km || b.staff - a.staff || a.name.localeCompare(b.name))
      .slice(0, n);
  }

  /* How many rooftops sit within a given radius — used to tell a
     seller how deep the bidding pool around them actually is. */
  async function countWithin(where, km = 100) {
    const origin = originFor(where);
    if (!origin) return 0;
    const d = await load();
    const cityDist = d.cities.map((c) => haversine(origin.lat, origin.lon, c[2], c[3]));
    return d.dealers.reduce((n, row) => n + (cityDist[row[1]] <= km ? 1 : 0), 0);
  }

  return { load, nearest, countWithin, haversine };
})();

window.DealerNet = DealerNet;
