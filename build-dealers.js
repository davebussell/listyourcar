/* ============================================================
   build-dealers.js — compile the dealer network (dev tool)

   Joins the cleaned dealer export to the geocoded city table and
   emits a compact data/dealers.json for the browser.

   Format is deliberately terse: cities are stored once with their
   coordinates and dealers reference them by index, which removes
   ~4,400 repeated city names and lat/lon pairs.

     node build-dealers.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "data");

const dealers = JSON.parse(fs.readFileSync(path.join(DIR, "dealers-raw.json"), "utf8"));
const coords = JSON.parse(fs.readFileSync(path.join(DIR, "city-coords.json"), "utf8"));

// Index the cities we actually have coordinates for.
const cityIdx = new Map();
const cities = [];
for (const [key, ll] of Object.entries(coords)) {
  const [name, prov] = key.split(", ");
  cityIdx.set(key, cities.length);
  cities.push([name, prov, ll[0], ll[1]]);
}

/* One bundle, including contact details, per the owner's decision.
   Note this is served publicly at /data/dealers.json — the compiled
   set is readable by anyone. The original ZoomInfo CSV itself stays
   out of the repo (see .gitignore); only this derived working set
   ships. */
const pub = [], priv = [];
let dropped = 0;
for (const d of dealers) {
  const key = d.c + ", " + d.p;
  const ci = cityIdx.get(key);
  if (ci === undefined) { dropped++; continue; }   // no coordinates → cannot rank by distance
  pub.push([d.n, ci, d.z, d.t, d.w, d.e || 0]);
  priv.push([d.n, ci, d.z, d.t, d.w, d.e || 0]);
}
const out = pub;

const file = path.join(DIR, "dealers.json");
fs.writeFileSync(file, JSON.stringify({ cities, dealers: pub, built: new Date().toISOString().slice(0, 10) }));
fs.writeFileSync(path.join(DIR, "dealers-private.json"),
  JSON.stringify({ cities, dealers: priv, built: new Date().toISOString().slice(0, 10) }));

const kb = (fs.statSync(file).size / 1024).toFixed(0);
console.log(`cities with coordinates : ${cities.length}`);
console.log(`dealers placed          : ${out.length}`);
console.log(`dropped (no city coords): ${dropped}`);
console.log(`data/dealers.json       : ${kb} KB`);

// Province spread, as a sanity check on coverage.
const byProv = {};
out.forEach((r) => { const p = cities[r[1]][1]; byProv[p] = (byProv[p] || 0) + 1; });
console.log("by province:", Object.entries(byProv).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join("  "));
