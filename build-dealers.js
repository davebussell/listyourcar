/* ============================================================
   build-dealers.js — compile the dealer network (dev tool)

   Joins the cleaned dealer export to geocoded locations and emits a
   compact data/dealers.json for the browser.

   Positions come from the Forward Sortation Area — the first three
   characters of the postal code — which puts each rooftop in its own
   neighbourhood rather than at a shared city centroid. Toronto's 122
   dealers resolve across the GTA instead of stacking on one point.
   Cities are the fallback for the few without a usable postal code.

   Marques are detected from the trading name by tokenising rather
   than by regex: franchised dealers almost always carry the brand,
   and matching whole tokens avoids "Ford" hitting "Fordham".

     node build-dealers.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "data");

const dealers = JSON.parse(fs.readFileSync(path.join(DIR, "dealers-raw.json"), "utf8"));
const cityCoords = JSON.parse(fs.readFileSync(path.join(DIR, "city-coords.json"), "utf8"));
const fsaCoords = fs.existsSync(path.join(DIR, "fsa-coords.json"))
  ? JSON.parse(fs.readFileSync(path.join(DIR, "fsa-coords.json"), "utf8"))
  : {};

/* Single-token marques, keyed lower-case for direct lookup. */
const ONE = {
  toyota: "Toyota", honda: "Honda", ford: "Ford", chevrolet: "Chevrolet", chev: "Chevrolet",
  gmc: "GMC", buick: "Buick", cadillac: "Cadillac", chrysler: "Chrysler", dodge: "Dodge",
  jeep: "Jeep", ram: "Ram", nissan: "Nissan", infiniti: "Infiniti", mazda: "Mazda",
  subaru: "Subaru", hyundai: "Hyundai", kia: "Kia", genesis: "Genesis",
  volkswagen: "Volkswagen", vw: "Volkswagen", audi: "Audi", bmw: "BMW", mini: "MINI",
  mercedes: "Mercedes-Benz", benz: "Mercedes-Benz", volvo: "Volvo", porsche: "Porsche",
  lexus: "Lexus", acura: "Acura", jaguar: "Jaguar", tesla: "Tesla",
  mitsubishi: "Mitsubishi", lincoln: "Lincoln", fiat: "Fiat", maserati: "Maserati",
  ferrari: "Ferrari", lamborghini: "Lamborghini", bentley: "Bentley", polestar: "Polestar",
  suzuki: "Suzuki", isuzu: "Isuzu", rivian: "Rivian", lucid: "Lucid", mclaren: "McLaren",
};
/* Two-token marques, checked against adjacent token pairs. */
const TWO = {
  "land rover": "Land Rover", "range rover": "Land Rover", "alfa romeo": "Alfa Romeo",
  "aston martin": "Aston Martin", "rolls royce": "Rolls-Royce", "mercedes benz": "Mercedes-Benz",
};

function brandsFor(name) {
  // Split on anything that isn't a letter or digit. No backslash escapes,
  // which this build environment mangles inside heredocs.
  const tokens = String(name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const found = new Set();
  tokens.forEach((t) => { if (ONE[t]) found.add(ONE[t]); });
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = tokens[i] + " " + tokens[i + 1];
    if (TWO[pair]) found.add(TWO[pair]);
  }
  // "Mercedes-Benz" tokenises to mercedes + benz; keep it as one marque.
  return [...found];
}

const fsaOf = (z) => String(z || "").replace(/\s/g, "").toUpperCase().slice(0, 3);

/* Every distinct position is stored once; dealers reference it by
   index, which strips ~4,400 repeated coordinate pairs. */
const posIdx = new Map();
const positions = [];   // [city, province, lat, lon]
function placeFor(d) {
  const f = fsaOf(d.z);
  if (fsaCoords[f]) {
    const key = "F:" + f;
    if (!posIdx.has(key)) {
      posIdx.set(key, positions.length);
      positions.push([d.c, d.p, fsaCoords[f][0], fsaCoords[f][1]]);
    }
    return posIdx.get(key);
  }
  const ck = d.c + ", " + d.p;
  if (cityCoords[ck]) {
    const key = "C:" + ck;
    if (!posIdx.has(key)) {
      posIdx.set(key, positions.length);
      positions.push([d.c, d.p, cityCoords[ck][0], cityCoords[ck][1]]);
    }
    return posIdx.get(key);
  }
  return -1;
}

const brandSet = new Set();
const rows = [];
let dropped = 0, viaFsa = 0, viaCity = 0;
for (const d of dealers) {
  const pi = placeFor(d);
  if (pi === -1) { dropped++; continue; }
  if (fsaCoords[fsaOf(d.z)]) viaFsa++; else viaCity++;
  const bs = brandsFor(d.n);
  bs.forEach((b) => brandSet.add(b));
  rows.push([d.n, pi, d.z, d.t, d.w, d.e || 0, bs]);
}

const payload = {
  positions,
  dealers: rows,
  brands: [...brandSet].sort(),
  built: new Date().toISOString().slice(0, 10),
};
const file = path.join(DIR, "dealers.json");
fs.writeFileSync(file, JSON.stringify(payload));

const franchised = rows.filter((r) => r[6].length).length;
console.log("positions            : " + positions.length);
console.log("dealers placed       : " + rows.length + "  (postal " + viaFsa + ", city fallback " + viaCity + ")");
console.log("dropped              : " + dropped);
console.log("marques detected     : " + brandSet.size);
console.log("franchised rooftops  : " + franchised + " (" + Math.round(franchised / rows.length * 100) + "%)");
console.log("data/dealers.json    : " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
