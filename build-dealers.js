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

/* A coordinate counts only if it actually lands inside Canada.
   Rural FSAs (a "0" in the second position) are absent from the postal
   source, and six of them had been written as latitude 0 with the real
   latitude spilled into the longitude slot — which put 22 dealers in
   the Gulf of Guinea. Rejecting them here lets the city fallback take
   over, and stops a bad geocode from ever reaching the map. */
const usable = (c) =>
  Array.isArray(c) && c.length === 2 && isFinite(c[0]) && isFinite(c[1]) &&
  c[0] >= 41 && c[0] <= 83.5 && c[1] >= -141.5 && c[1] <= -52;

/* Full six-character codes, resolved by build-postal.js. Only rural
   codes are in here; see that file for why. */
const postalFile = path.join(DIR, "postal-coords.json");
const postalCoords = fs.existsSync(postalFile) ? JSON.parse(fs.readFileSync(postalFile, "utf8")) : {};
const fullOf = (z) => String(z || "").replace(/\s/g, "").toUpperCase();
const isRural = (f) => /^[A-Z]0[A-Z]$/.test(f);

/* Every distinct position is stored once; dealers reference it by
   index, which strips ~4,400 repeated coordinate pairs. */
const posIdx = new Map();
const positions = [];   // [city, province, lat, lon]
const tierOf = [];      // per position: "P" full postal, "C" city, "F" district
function place(key, d, c) {
  if (!posIdx.has(key)) {
    posIdx.set(key, positions.length);
    positions.push([d.c, d.p, c[0], c[1]]);
    tierOf.push(key[0]);
  }
  return posIdx.get(key);
}

/* Precision order depends on the kind of code.

   Urban FSA:  district centroid, then city. The district is a
               neighbourhood, which is as exact as the map needs.
   Rural FSA:  full postal code, then city, then district. A rural
               district is a region — the median dealer placed by one
               sat 60 km from its own town — so it is the last resort. */
function placeFor(d) {
  const f = fsaOf(d.z);
  const ck = d.c + ", " + d.p;
  const tiers = isRural(f)
    ? [["P:" + fullOf(d.z), postalCoords[fullOf(d.z)]], ["C:" + ck, cityCoords[ck]], ["F:" + f, fsaCoords[f]]]
    : [["F:" + f, fsaCoords[f]], ["C:" + ck, cityCoords[ck]]];
  for (const [key, c] of tiers) {
    if (usable(c)) return place(key, d, c);
  }
  return -1;
}

/* What kind of independent this is, read from the name.

   Only unbranded dealers get a specialty. A franchised store named
   "Performance Mazda" or "Elite BMW" is a Mazda or BMW store — the
   adjective is branding, not a category — whereas an independent
   called "Classic Mustang" or "JDM Connection" really is a specialist.
   Marque tier (luxury, exotic) is not stored: it follows from the
   brands and is derived on the client.

     classic      collector, vintage and muscle cars
     truck        trucks, fleet and commercial
     performance  motorsport and tuning
     import       European and Japanese import specialists
     other        RV, marine, powersports, leasing, rental, wholesale —
                  real businesses, but not retail car buyers, so they
                  are never offered as bid targets by default
     ""           a general used-car dealer */
const SPEC = [
  ["other",       /\b(rv|rvs|trailers?|marine|boats?|powersports?|motorcycles?|atvs?|snowmobiles?|leasing|lease|rentals?|rent|wholesalers?|wholesale)\b/i],
  ["classic",     /\b(classic|classics|vintage|collector|collectors|antique|muscle|hot ?rods?)\b/i],
  ["truck",       /\b(trucks?|fleet|commercial|vans?|diesel)\b/i],
  ["performance", /\b(motorsports?|performance|racing|tuning)\b/i],
  ["import",      /\b(imports?|euro|european|jdm|japanese|german)\b/i],
];
function specialtyOf(name, brands) {
  if (brands.length) return "";
  for (const [tag, re] of SPEC) if (re.test(name)) return tag;
  return "";
}

const brandSet = new Set();
const rows = [];
let dropped = 0, viaPostal = 0, viaFsa = 0, viaCity = 0;
for (const d of dealers) {
  const pi = placeFor(d);
  if (pi === -1) { dropped++; continue; }
  const k = tierOf[pi];
  if (k === "P") viaPostal++; else if (k === "C") viaCity++; else viaFsa++;
  const bs = brandsFor(d.n);
  bs.forEach((b) => brandSet.add(b));
  rows.push([d.n, pi, d.z, d.t, d.w, d.e || 0, bs, specialtyOf(d.n, bs)]);
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
console.log("dealers placed       : " + rows.length +
  "  (district " + viaFsa + ", full postal " + viaPostal + ", city " + viaCity + ")");
console.log("dropped              : " + dropped);
console.log("marques detected     : " + brandSet.size);
console.log("franchised rooftops  : " + franchised + " (" + Math.round(franchised / rows.length * 100) + "%)");
console.log("data/dealers.json    : " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
