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
    // "Land Rovers" -> land rover: a trailing plural must not hide a marque.
    const pair = tokens[i] + " " + tokens[i + 1].replace(/s$/, "");
    if (TWO[pair]) found.add(TWO[pair]);
  }
  // "Mercedes-Benz" tokenises to mercedes + benz; keep it as one marque.
  if (!found.size) {
    /* Names written as one word or as a domain — "Rallyemitsubishi",
       "kingstonsubaru.ca" — give the tokeniser nothing to split on.
       Fall back to a substring match, but only for marques long enough
       that a chance hit is implausible ("audi" would match "Saudi"). */
    const squashed = tokens.join("");
    for (const [k, v] of Object.entries(ONE)) if (k.length >= 6 && squashed.includes(k)) found.add(v);
    for (const [k, v] of Object.entries(TWO)) if (squashed.includes(k.replace(" ", ""))) found.add(v);
    const out = [...found];
    out.viaSubstring = out.length > 0;   // a weaker read; the profile marks it
    return out;
  }
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

/* ============================================================
   Profile — every categorical signal the export actually carries.

   The export has eight fields. Beyond name and marque, three of them
   say something real about a business: `l` (how many locations it
   has), `e` (how many people it employs), and the website domain.
   The name itself carries more than marques: what the business does
   (a body shop and a tow yard are in this export, and neither buys
   cars), whether it is a group, which language it trades in, and
   what it specialises in.

   Each dealer gets a compact list of codes in row[8]. Only
   non-default facets are written, so a plain single-site English
   franchised store carries almost nothing.

     r:<role>   service | finance | salvage | broker | rental |
                auction | media          (absent = a car dealer)
     s<1-5>     size by staff: 1-5, 6-20, 21-60, 61-150, 150+
     l<1-3>     sites: single, 2-5, 6+
     g:<name>   the group it belongs to, when one is recognisable
     fr         trades in French
     x:<focus>  ev | truck | classic | exotic | import | performance |
                budget | premium               (repeatable)
     multi      carries three or more marques
     tf         toll-free number, a regional or national operation
     c:<conf>   marque confidence: high (name and domain agree),
                low (found only by substring)  (absent = medium)
   ============================================================ */

const ROLE = [
  ["service", /\b(collision|body ?shop|carrosserie|repairs?|réparations?|service centre|mechanics?|mécanique|tires?|pneus|glass|vitres|detailing|esthétique|towing|remorquage|garage|lube|mufflers?|transmissions?|alignment)\b/i],
  ["finance", /\b(credit|crédit|loans?|financ(e|ing|ement)|approvals?|approved|lending)\b/i],
  ["salvage", /\b(salvage|wreckers?|recycl(ing|ers?)|scrap|auto parts|pièces|pick.?a.?part|junk)\b/i],
  ["broker",  /\b(brokers?|courtiers?|consignment|consignation)\b/i],
  ["rental",  /\b(rentals?|rent-a-car|leasing|lease|fleet|rvs?|trailers?|marine|boats?|powersports?|motorcycles?|atvs?|snowmobiles?)\b/i],
  ["auction", /\b(auctions?|enchères?|encan)\b/i],
  ["media",   /\b(media|marketing|advertising|publicité)\b/i],
];
const FOCUS = [
  ["ev",          /\b(electric|électrique|evs?|hybrids?|hybrides?|green)\b/i],
  ["truck",       /\b(trucks?|camions?|4x4|off.?road|diesel|pickups?|commercial|vans?)\b/i],
  ["classic",     /\b(classics?|vintage|collectors?|antique|muscle|hot.?rods?|restoration)\b/i],
  ["exotic",      /\b(exotics?|supercars?)\b/i],
  ["import",      /\b(imports?|euro|european|jdm|japanese|german)\b/i],
  ["performance", /\b(motorsports?|performance|racing|tuning)\b/i],
  ["budget",      /\b(budget|discount|economy|bargain|liquidation|clearance|wholesale|outlet)\b/i],
  ["premium",     /\b(luxury|luxe|prestige|premium|elite|élite|fine cars|executive|exclusive|signature|platinum)\b/i],
];
/* Franchised stores name themselves with adjectives — "Performance
   Mazda", "Elite BMW" — that are branding, not a category. For them
   only a focus that describes stock is believed. */
const FOCUS_FOR_FRANCHISED = new Set(["ev", "truck", "classic", "exotic"]);
const FRENCH = /\b(groupe|ltée|automobiles?|voitures?|occasion|usagés?|usagées?|véhicules?|camions?|du|des|les|chez)\b|[éèêàçôû]/i;

/* Group detection. The authoritative signal is `l` (locations). The
   label comes from the leading name token when that token also opens
   the names of businesses in three or more other cities — "Murray",
   "Steele", "Wheaton" — and is not a marque or a place-word. */
const GENERIC_LEAD = new Set(["auto", "autos", "automobile", "automobiles", "the", "north", "south", "east", "west",
  "central", "city", "canada", "canadian", "royal", "national", "premier", "prestige", "elite", "performance", "first",
  "great", "northern", "southern", "eastern", "western", "pacific", "atlantic", "metro", "capital", "downtown", "village",
  "country", "lake", "valley", "river", "bay", "park", "maple", "pine", "oak", "hill", "hills", "mountain", "island",
  "harbour", "harbor", "classic", "quality", "budget", "discount", "honest", "best", "top", "super", "new", "used",
  "luxury", "import", "imports", "euro", "european", "japanese", "german", "international", "groupe", "group", "garage",
  "centre", "center", "team", "town", "port", "plaza", "parkway", "airport", "highway", "riverside", "frontier",
  "cars", "car", "motors", "motor", "john", "mike", "scott", "bruce", "land", "grand", "select", "action", "united",
  "world", "family", "brothers", "sons", "auto-", "chez", "les", "groupe",
  "concession", "concessionnaire", "concessionaire", "automotive", "dealership", "dealerships"]);
/* The lead word, kept with its accents and apostrophes ("HGrégoire",
   "O'Regan's") so the label reads as the business writes it. */
const leadWord = (n) => String(n).replace(/[’]/g, "'").trim().split(/\s+/)[0].replace(/[^\p{L}'\-]/gu, "");
const leadKey = (n) => leadWord(n).toLowerCase();
/* A place name at the front of a dealer's name is a location, not a
   group — "Toronto Hyundai", "Richmond Chrysler". Every city in the
   export is excluded, as are the marques. */
const PLACE_LEAD = new Set(dealers.map((d) => String(d.c).toLowerCase().split(/[\s-]/)[0]));
/* Groups named after a person — "Daniel Paré Dodge", "Jim Pattison
   Toyota" — need both words, or every Daniel in the export merges. */
const words = (n) => String(n).replace(/[’]/g, "'").trim().split(/\s+/).map((w) => w.replace(/[^\p{L}'\-]/gu, ""));
const twoKey = (n) => { const w = words(n); return w[1] && /^\p{Lu}/u.test(w[1]) && w[1].length >= 3 ? (w[0] + " " + w[1]).toLowerCase() : ""; };
const leadCities = {}, leadLabel = {}, twoCities = {}, twoLabel = {};
dealers.forEach((d) => {
  const t = leadKey(d.n);
  if (t.length < 4 || GENERIC_LEAD.has(t) || PLACE_LEAD.has(t)) return;
  (leadCities[t] = leadCities[t] || new Set()).add(d.c + "," + d.p);
  if (!leadLabel[t]) leadLabel[t] = leadWord(d.n);
  const k2 = twoKey(d.n);
  if (k2) {
    (twoCities[k2] = twoCities[k2] || new Set()).add(d.c + "," + d.p);
    if (!twoLabel[k2]) twoLabel[k2] = words(d.n).slice(0, 2).join(" ");
  }
});
/* A group needs the same name across three or more cities. `l` alone
   never earns a label: a two-site business is a business. When the
   two-word name spreads that far, it is the better label. */
function groupOf(d, brands) {
  const t = leadKey(d.n);
  if (!t || GENERIC_LEAD.has(t) || PLACE_LEAD.has(t)) return "";
  if (brands.some((b) => b.toLowerCase().replace(/[^a-z]/g, "").startsWith(t.replace(/[^a-z]/g, "")))) return "";
  const k2 = twoKey(d.n);
  const two = k2 && twoCities[k2] ? twoCities[k2].size : 0;
  const one = leadCities[t] ? leadCities[t].size : 0;
  /* The second word only extends the label when it is part of the
     name — "Paré", "Moe", "Dumas" — not a marque or a trade word.
     "Murray Chevy" and "OpenRoad Auto" are Murray and OpenRoad. */
  const second = k2 ? k2.split(" ")[1] : "";
  const secondIsName = second && !GENERIC_LEAD.has(second) && !ONE[second] &&
    !["automotive", "auto", "motors", "group", "chevy", "chev", "ford", "dodge", "cars"].includes(second);
  if (two >= 3 && secondIsName) return twoLabel[k2];
  return one >= 3 ? leadLabel[t] : "";
}

function profileOf(d, brands) {
  const p = [];
  const name = d.n || "";
  for (const [role, re] of ROLE) if (re.test(name)) { p.push("r:" + role); break; }
  const e = d.e || 0;
  p.push("s" + (e > 150 ? 5 : e > 60 ? 4 : e > 20 ? 3 : e > 5 ? 2 : 1));
  const l = d.l || 1;
  if (l >= 6) p.push("l3"); else if (l >= 2) p.push("l2");
  const g = groupOf(d, brands);
  if (g) p.push("g:" + g);
  if (d.p === "QC" && FRENCH.test(name)) p.push("fr");
  for (const [f, re] of FOCUS) {
    if (!re.test(name)) continue;
    if (brands.length && !FOCUS_FOR_FRANCHISED.has(f)) continue;
    p.push("x:" + f);
  }
  if (brands.length >= 3) p.push("multi");
  if (/^\(?8(00|33|44|55|66|77|88)\)?/.test(d.t || "")) p.push("tf");
  if (brands.length) {
    /* High when the website domain agrees with the name; low when the
       marque was only recoverable by substring from a run-together
       name. "Maple Ridge VW" is a clean token match and stays medium. */
    const dom = String(d.w || "").toLowerCase().replace(/[^a-z]/g, "");
    const inDomain = brands.some((b) => dom.includes(b.toLowerCase().replace(/[^a-z]/g, "")));
    if (brands.viaSubstring) p.push("c:low");
    else if (inDomain) p.push("c:high");
  }
  return p;
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
  const prof = profileOf(d, bs);
  /* `spec` is the one-word summary older code reads; it now derives
     from the profile so the two can never disagree. A non-dealer role
     is "other"; otherwise the first stock-describing focus. */
  const role = (prof.find((c) => c.startsWith("r:")) || "").slice(2);
  const focus = prof.filter((c) => c.startsWith("x:")).map((c) => c.slice(2));
  const spec = role ? "other" : (focus.find((f) => ["classic", "truck", "performance", "import"].includes(f)) || "");
  rows.push([d.n, pi, d.z, d.t, d.w, d.e || 0, bs, spec, prof]);
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
{
  const tally = {};
  rows.forEach((r) => r[8].forEach((c) => {
    const k = c.startsWith("g:") ? "g:*" : c;
    tally[k] = (tally[k] || 0) + 1;
  }));
  const line = (prefix, label) => {
    const items = Object.entries(tally).filter(([k]) => k.startsWith(prefix)).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => k.slice(prefix.length) + " " + n).join(", ");
    if (items) console.log((label + " ").padEnd(21, " ") + ": " + items);
  };
  line("r:", "roles (non-dealer)");
  line("s", "size by staff");
  line("l", "multi-site");
  line("g:", "in a named group");
  line("x:", "focus");
  line("fr", "trades in French");
  line("multi", "3+ marques");
  line("tf", "toll-free");
  line("c:", "marque confidence");
}
console.log("data/dealers.json    : " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
