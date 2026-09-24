/* ============================================================
   seo-dealer-guides.js — "Used car dealers in <metro>" pages

   Called by build-seo.js, which supplies the page shell, the sitemap
   tracker and the escaping helpers. Not run on its own.

   One page per Statistics Canada census metropolitan area — the 41
   CMAs of the 2021 census, which is the standard definition of a
   "major metro" in Canada — plus an index at /used-car-dealers/.

   Every figure on these pages is computed from data/dealers.json at
   build time. Dealer links use the same "d<index>" ids the dealer
   page reads, so this must be rebuilt whenever dealers.json is.

   Membership: a dealer belongs to the nearest metro whose radius
   covers it, so no dealer is listed on two pages. Where distance
   alone would put a town in the wrong CMA — Oakville is nearer
   Hamilton's centre but is part of Toronto — a known town overrides.
   ============================================================ */

const fs = require("fs");
const path = require("path");

/* [slug, name, provinces, lat, lon, radius km] */
const METROS = [
  ["toronto", "Toronto", ["ON"], 43.6532, -79.3832, 45],
  ["montreal", "Montréal", ["QC"], 45.5017, -73.5673, 40],
  ["vancouver", "Vancouver", ["BC"], 49.2600, -122.9500, 38],
  ["ottawa-gatineau", "Ottawa–Gatineau", ["ON", "QC"], 45.4215, -75.6972, 35],
  ["calgary", "Calgary", ["AB"], 51.0447, -114.0719, 30],
  ["edmonton", "Edmonton", ["AB"], 53.5461, -113.4938, 35],
  ["quebec-city", "Québec City", ["QC"], 46.8139, -71.2080, 30],
  ["winnipeg", "Winnipeg", ["MB"], 49.8951, -97.1384, 30],
  ["hamilton", "Hamilton", ["ON"], 43.2557, -79.8711, 22],
  ["kitchener-cambridge-waterloo", "Kitchener–Cambridge–Waterloo", ["ON"], 43.4516, -80.4925, 20],
  ["london", "London", ["ON"], 42.9849, -81.2453, 25],
  ["halifax", "Halifax", ["NS"], 44.6488, -63.5752, 30],
  ["st-catharines-niagara", "St. Catharines–Niagara", ["ON"], 43.1300, -79.2000, 25],
  ["windsor", "Windsor", ["ON"], 42.3149, -83.0364, 25],
  ["oshawa", "Oshawa", ["ON"], 43.8971, -78.8658, 18],
  ["victoria", "Victoria", ["BC"], 48.4284, -123.3656, 25],
  ["saskatoon", "Saskatoon", ["SK"], 52.1332, -106.6700, 25],
  ["regina", "Regina", ["SK"], 50.4452, -104.6189, 25],
  ["sherbrooke", "Sherbrooke", ["QC"], 45.4042, -71.8929, 20],
  ["kelowna", "Kelowna", ["BC"], 49.8880, -119.4960, 25],
  ["barrie", "Barrie", ["ON"], 44.3894, -79.6903, 22],
  ["st-johns", "St. John's", ["NL"], 47.5615, -52.7126, 25],
  ["abbotsford-mission", "Abbotsford–Mission", ["BC"], 49.0800, -122.3045, 17],
  ["kingston", "Kingston", ["ON"], 44.2312, -76.4860, 25],
  ["guelph", "Guelph", ["ON"], 43.5448, -80.2482, 15],
  ["saguenay", "Saguenay", ["QC"], 48.4284, -71.0685, 30],
  ["moncton", "Moncton", ["NB"], 46.0878, -64.7782, 25],
  ["trois-rivieres", "Trois-Rivières", ["QC"], 46.3432, -72.5476, 20],
  ["brantford", "Brantford", ["ON"], 43.1394, -80.2644, 15],
  ["saint-john", "Saint John", ["NB"], 45.2733, -66.0633, 20],
  ["lethbridge", "Lethbridge", ["AB"], 49.6956, -112.8451, 20],
  ["thunder-bay", "Thunder Bay", ["ON"], 48.3809, -89.2477, 25],
  ["nanaimo", "Nanaimo", ["BC"], 49.1659, -123.9401, 25],
  ["peterborough", "Peterborough", ["ON"], 44.3091, -78.3197, 20],
  ["kamloops", "Kamloops", ["BC"], 50.6745, -120.3273, 20],
  ["belleville-quinte-west", "Belleville–Quinte West", ["ON"], 44.1300, -77.4800, 20],
  ["chilliwack", "Chilliwack", ["BC"], 49.1579, -121.9515, 15],
  ["greater-sudbury", "Greater Sudbury", ["ON"], 46.4917, -80.9930, 30],
  ["red-deer", "Red Deer", ["AB"], 52.2681, -113.8112, 20],
  ["fredericton", "Fredericton", ["NB"], 45.9636, -66.6431, 20],
  ["drummondville", "Drummondville", ["QC"], 45.8838, -72.4843, 20],
];

/* Towns whose CMA distance alone gets wrong. Keys are accent-free
   lower case. Only applied within 80 km of the metro's centre. */
const TOWN_METRO = {
  "oakville": "toronto", "milton": "toronto", "halton hills": "toronto", "georgetown": "toronto",
  "ajax": "toronto", "pickering": "toronto", "uxbridge": "toronto", "newmarket": "toronto",
  "aurora": "toronto", "stouffville": "toronto", "bradford": "toronto",
  "burlington": "hamilton", "grimsby": "hamilton",
  "whitby": "oshawa", "oshawa": "oshawa", "bowmanville": "oshawa", "courtice": "oshawa",
  "innisfil": "barrie", "oro": "barrie",
  "mission": "abbotsford-mission",
  "langley": "vancouver", "maple ridge": "vancouver", "pitt meadows": "vancouver",
  "levis": "quebec-city",
};

/* The provinces whose main page this metro already has. */
const CITY_PAGE = { toronto: "toronto", vancouver: "vancouver", montreal: "montreal", calgary: "calgary",
  edmonton: "edmonton", "ottawa-gatineau": "ottawa", winnipeg: "winnipeg", halifax: "halifax" };

/* Buying from a dealer, by province. Kept to rules that are settled
   and verifiable; where a province's dealer licensing body is not
   named here, the page says to check the licence rather than guess. */
const PROVINCE = {
  ON: { name: "Ontario", text: "Every dealer in Ontario must be registered with OMVIC, the Ontario Motor Vehicle Industry Council. Advertised prices must be all-in — everything except HST and licensing — so a dealer cannot add fees at the desk that were not in the ad. Buyers from a registered dealer are also backed by a compensation fund if the dealer fails to deliver." },
  QC: { name: "Quebec", text: "Dealers must hold a permit from the Office de la protection du consommateur. A used car sold by a dealer carries a legal warranty, plus a good-working-order warranty whose length depends on the car's age and distance — from six months on the newest used cars to none on the oldest — and the dealer must post a label on the car setting out which applies." },
  BC: { name: "British Columbia", text: "Dealers must be licensed by the Vehicle Sales Authority of BC. A licensed dealer has to disclose material facts about a car, including damage above a set dollar amount, and the Motor Dealer Customer Compensation Fund can cover buyers in some cases where a dealer does not." },
  AB: { name: "Alberta", text: "Dealers must be licensed by AMVIC, the Alberta Motor Vehicle Industry Council, and must give buyers a mechanical fitness assessment on a used car. Alberta has no provincial sales tax, so GST is the only sales tax on a dealer sale." },
  SK: { name: "Saskatchewan", text: "Vehicle dealers are licensed through the Financial and Consumer Affairs Authority. Registration and insurance run through SGI when you take ownership." },
  MB: { name: "Manitoba", text: "Registration and insurance run through Manitoba Public Insurance at an Autopac agent, and provincial sales tax applies when ownership transfers. Ask the dealer for proof of its dealer permit before you sign." },
  NS: { name: "Nova Scotia", text: "A car needs a valid Motor Vehicle Inspection to be registered and driven in Nova Scotia, so confirm the inspection is current or included before you buy. HST applies to dealer sales." },
  NB: { name: "New Brunswick", text: "New Brunswick requires a valid motor vehicle inspection, so ask whether the car's inspection is current or will be done before delivery. HST applies to dealer sales." },
  NL: { name: "Newfoundland and Labrador", text: "Registration runs through the province's Motor Registration Division. HST applies to dealer sales, and it is worth confirming the dealer is licensed with the province before you commit." },
};

const FOCUS_LABEL = { ev: "Electric & hybrid", truck: "Trucks", classic: "Classic", exotic: "Exotic",
  import: "Imports", performance: "Performance", budget: "Budget", premium: "Premium" };

const rad = Math.PI / 180;
const hav = (a, b, c, e) => {
  const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((e - b) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const num = (n) => Number(n).toLocaleString("en-CA");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* The export writes some towns oddly: "St. John S", "Quebec" beside
   "Québec". Group by an accent-free key and show the commonest form,
   restoring the accents the export drops on the names it drops them
   from most. */
const ACCENTED = { levis: "Lévis", montreal: "Montréal", quebec: "Québec", "trois-rivieres": "Trois-Rivières",
  "trois rivieres": "Trois-Rivières", becancour: "Bécancour", jonquiere: "Jonquière" };
function tidyTown(s) {
  const t = String(s || "").replace(/\bJohn S\b/, "John's").replace(/\s+/g, " ").trim();
  return ACCENTED[fold(t)] || t;
}

/* The main town of each metro, e.g. "Québec" for Québec City. */
const coreTown = (name) => name.split("–")[0].replace(/ City$/, "").replace(/^Greater /, "");

function parseProfile(codes) {
  const p = { role: "", group: "", focus: [], sites: 1 };
  (codes || []).forEach((c) => {
    if (c.startsWith("r:")) p.role = c.slice(2);
    else if (c.startsWith("g:")) p.group = c.slice(2);
    else if (c.startsWith("x:")) p.focus.push(c.slice(2));
    else if (/^l[1-3]$/.test(c)) p.sites = +c[1];
  });
  return p;
}

module.exports = function buildDealerGuides({ ROOT, ORIGIN, shell, track, esc, breadcrumbLd }) {
  const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dealers.json"), "utf8"));
  const bySlug = Object.fromEntries(METROS.map((m) => [m[0], m]));
  const coreSlug = Object.fromEntries(METROS.map((m) => [fold(coreTown(m[1])), m[0]]));

  /* ---------- Assign every car dealer to at most one metro ---------- */
  const members = Object.fromEntries(METROS.map((m) => [m[0], []]));
  let nationalUsed = 0, nationalIndep = 0;

  bundle.dealers.forEach((row, i) => {
    const prof = parseProfile(row[8]);
    if (prof.role) return;                                    // repair shops, lenders, fleet firms: not dealers
    const pos = bundle.positions[row[1]];
    nationalUsed++;
    if (!row[6].length) nationalIndep++;

    let slug = null;
    const override = TOWN_METRO[fold(pos[0])];
    if (override && hav(pos[2], pos[3], bySlug[override][3], bySlug[override][4]) <= 80) slug = override;
    if (!slug) {
      let best = Infinity;
      for (const m of METROS) {
        const km = hav(pos[2], pos[3], m[3], m[4]);
        if (km <= m[5] && km < best) { best = km; slug = m[0]; }
      }
    }
    if (!slug) return;
    /* A town field naming a different metro is an export error, not a
       location: L'Ange-Gardien Ford is filed as "Montreal" but its
       postal code puts it outside Québec City. The position wins, and
       the page shows the metro it actually sits in. */
    let town = tidyTown(pos[0]);
    const namesMetro = coreSlug[fold(town)];
    if (namesMetro && namesMetro !== slug) town = tidyTown(coreTown(bySlug[slug][1]));
    members[slug].push({
      id: "d" + i, name: row[0], town, townKey: fold(town), prov: pos[1],
      postal: row[2] || "", phone: row[3] || "", web: row[4] || "", brands: row[6] || [],
      spec: row[7] || "", ...prof,
    });
  });

  const nationalIndepShare = pct(nationalIndep, nationalUsed);

  /* ---------- Shared bits ---------- */
  const tel = (p) => (p ? `<a href="tel:${p.replace(/[^0-9+]/g, "")}">${esc(p)}</a>` : `<span class="muted">—</span>`);
  const site = (w) => (w
    ? ` <a class="ud-web" href="https://${esc(w.replace(/^https?:\/\//, ""))}" rel="nofollow noopener" target="_blank">site</a>`
    : "");
  const dealerCell = (d) => `<a class="dealer-link" href="/dealer.html?id=${d.id}">${esc(d.name)}</a>${site(d.web)}`;
  const focusOf = (d) => {
    const bits = d.focus.map((f) => FOCUS_LABEL[f]).filter(Boolean);
    if (d.group) bits.push(`${esc(d.group)} group`);
    return bits.length ? bits.join(" · ") : `<span class="muted">—</span>`;
  };

  /* ---------- One page per metro ---------- */
  const summaries = [];

  for (const m of METROS) {
    const [slug, name, provs] = m;
    const list = members[slug];
    if (!list.length) continue;

    // Most common spelling of each town, and the counts behind it.
    const spellings = {};
    list.forEach((d) => { (spellings[d.townKey] = spellings[d.townKey] || {})[d.town] = (spellings[d.townKey][d.town] || 0) + 1; });
    const townName = (k) => Object.entries(spellings[k]).sort((a, b) => b[1] - a[1])[0][0];
    list.forEach((d) => { d.town = townName(d.townKey); });
    const towns = Object.entries(list.reduce((a, d) => ((a[d.town] = (a[d.town] || 0) + 1), a), {}))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const indep = list.filter((d) => !d.brands.length)
      .sort((a, b) => a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
    const franch = list.filter((d) => d.brands.length);

    const byMarque = {};
    franch.forEach((d) => d.brands.forEach((b) => { (byMarque[b] = byMarque[b] || []).push(d); }));
    const marques = Object.entries(byMarque).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

    const groups = Object.entries(list.filter((d) => d.group)
      .reduce((a, d) => ((a[d.group] = (a[d.group] || 0) + 1), a), {}))
      .filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const specialists = {};
    list.forEach((d) => d.focus.forEach((f) => { if (FOCUS_LABEL[f]) specialists[f] = (specialists[f] || 0) + 1; }));

    const share = pct(indep.length, list.length);
    const provsHere = [...new Set(list.map((d) => d.prov))].filter((p) => PROVINCE[p]);
    const provPhrase = provs.length > 1 ? provs.map((p) => PROVINCE[p].name).join(" and ") : PROVINCE[provs[0]].name;

    /* The sentence that makes this page about this market, not a template. */
    const topTowns = towns.slice(0, 3).map(([t, n]) => `${esc(t)} (${n})`);
    const townLine = towns.length > 1
      ? `They are spread across ${towns.length} communities, with the most in ${topTowns.slice(0, -1).join(", ")}${topTowns.length > 1 ? " and " : ""}${topTowns[topTowns.length - 1]}.`
      : `All of them are in ${esc(towns[0][0])} itself.`;
    const shareLine = share > nationalIndepShare + 5
      ? `Independent lots make up ${share}% of the market here — more than the ${nationalIndepShare}% national figure, so there is more choice outside the franchised stores than in most of the country.`
      : share < nationalIndepShare - 5
        ? `Franchised stores dominate: independents are ${share}% of dealers here against ${nationalIndepShare}% nationally, so most used cars in ${esc(name)} are sold off a new-car dealer's lot.`
        : `Independent lots make up ${share}% of dealers here, close to the ${nationalIndepShare}% national figure.`;
    const marqueLine = marques.length
      ? `${esc(marques[0][0])} has the most franchised rooftops (${marques[0][1].length})${marques[1] ? `, followed by ${esc(marques[1][0])} (${marques[1][1].length})` : ""}${marques[2] ? ` and ${esc(marques[2][0])} (${marques[2][1].length})` : ""}.`
      : "";

    const stats = [
      [num(list.length), "Used-car dealers"],
      [num(indep.length), "Independent lots"],
      [num(franch.length), "Franchised stores"],
      [num(marques.length), "Marques represented"],
    ].map(([n, l]) => `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${l}</div></div>`).join("");

    const maxTown = towns.length ? towns[0][1] : 1;
    const townBars = towns.map(([t, n]) =>
      `<li><span class="ud-town">${esc(t)}</span><span class="bm-p-bar"><i style="width:${(n / maxTown * 100).toFixed(1)}%"></i></span><span class="ud-n">${n}</span></li>`).join("");

    const indepRows = indep.map((d) =>
      `<tr><th>${dealerCell(d)}</th><td>${esc(d.town)}</td><td>${focusOf(d)}</td><td class="num">${tel(d.phone)}</td></tr>`).join("");

    const marqueJump = marques.map(([b, ds]) =>
      `<a class="fchip" href="#m-${esc(b.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(b)} <em>${ds.length}</em></a>`).join("");
    const marqueTables = marques.map(([b, ds]) => {
      const rows = ds.slice().sort((x, y) => x.town.localeCompare(y.town) || x.name.localeCompare(y.name)).map((d) => {
        const also = d.brands.filter((x) => x !== b);
        return `<tr><th>${dealerCell(d)}</th><td>${esc(d.town)}</td><td>${also.length ? esc(also.join(", ")) : `<span class="muted">—</span>`}</td><td class="num">${tel(d.phone)}</td></tr>`;
      }).join("");
      return `<h3 class="ud-marque" id="m-${esc(b.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(b)} <span>${ds.length}</span></h3>
      <div class="table-scroll"><table class="valtable ud-table">
        <thead><tr><th>Dealer</th><th>Community</th><th>Also sells</th><th class="num">Phone</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }).join("");

    const groupLine = groups.length
      ? `<p class="muted">Dealer groups with more than one rooftop here: ${groups.slice(0, 8).map(([g, n]) => `${esc(g)} (${n})`).join(", ")}. A group's stores often share used inventory, so one call can cover several lots.</p>`
      : "";
    const specialistLine = Object.keys(specialists).length
      ? `<p class="muted">Specialists in the area: ${Object.entries(specialists).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${FOCUS_LABEL[f].toLowerCase()} (${n})`).join(", ")}.</p>`
      : "";

    const provGuide = provsHere.map((p) =>
      `<div class="ud-prov"><h3>Buying in ${esc(PROVINCE[p].name)}</h3><p class="muted">${esc(PROVINCE[p].text)}</p></div>`).join("");

    const cityLinks = CITY_PAGE[slug]
      ? `<a class="btn btn-ghost" href="/sell-my-car/${CITY_PAGE[slug]}/">Selling in ${esc(name)}</a>`
      : "";

    const others = METROS.filter((x) => x[0] !== slug && members[x[0]].length)
      .map((x) => `<a href="/used-car-dealers/${x[0]}/">Used car dealers in ${esc(x[1])}</a>`).join("");

    /* FAQ — answers computed from the same data as the page. */
    const faq = [
      [`How many used car dealers are there in ${name}?`,
        `Our network lists ${num(list.length)} dealerships in the ${name} area that sell used cars: ${num(indep.length)} independent used-car lots and ${num(franch.length)} franchised new-car stores, which also sell the trade-ins they take in.`],
      [`Which parts of ${name} have the most used car dealers?`,
        towns.length > 1
          ? `${towns.slice(0, 3).map(([t, n]) => `${t} (${n})`).join(", ")}. Together those account for ${pct(towns.slice(0, 3).reduce((a, [, n]) => a + n, 0), list.length)}% of the dealers in the area.`
          : `All ${num(list.length)} are in ${towns[0][0]}.`],
      [`Can I get ${name} dealers to compete for my car?`,
        `Yes. List your car on listyourcar.ca, set a reserve and a closing time, and the dealerships nearest to you are invited to bid against each other and against private buyers. Nothing sells below your reserve.`],
    ];
    const faqHtml = faq.map(([q, a]) => `<div class="ud-faq"><h3>${esc(q)}</h3><p class="muted">${esc(a)}</p></div>`).join("");
    const faqLd = JSON.stringify({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    });
    const listLd = JSON.stringify({
      "@context": "https://schema.org", "@type": "ItemList",
      name: `Used car dealers in ${name}`, numberOfItems: list.length,
      itemListElement: indep.concat(franch).slice(0, 100).map((d, i) => ({
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "AutoDealer", name: d.name, url: `${ORIGIN}/dealer.html?id=${d.id}`,
          address: { "@type": "PostalAddress", addressLocality: d.town, addressRegion: d.prov, addressCountry: "CA", ...(d.postal ? { postalCode: d.postal } : {}) },
          ...(d.phone ? { telephone: d.phone } : {}),
        },
      })),
    });

    const body = `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/used-car-dealers/">Used car dealers</a> / ${esc(name)}</nav>

  <div class="page-head">
    <span class="eyebrow">${esc(provPhrase)} · ${num(list.length)} dealerships</span>
    <h1>Used car dealers in ${esc(name)}</h1>
    <p class="lead narrow">${num(list.length)} dealerships in the ${esc(name)} area sell used cars — ${num(indep.length)} independent lots and ${num(franch.length)} franchised stores. Every one is listed below, with a way to reach them, and a way to get them bidding against each other for your car.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/sell.html">Get these dealers bidding</a>
      <a class="btn btn-ghost" href="/find-buyers.html">See them on the map</a>
    </div>
  </div>

  <div class="stats">${stats}</div>

  <section class="seo-block">
    <span class="index">01</span>
    <div>
      <h2>The ${esc(name)} used-car market</h2>
      <p class="muted">${townLine} ${shareLine} ${marqueLine}</p>
      ${groupLine}
      ${specialistLine}
      ${towns.length > 1 ? `<ul class="ud-towns">${townBars}</ul>` : ""}
    </div>
  </section>

  <section class="seo-block">
    <span class="index">02</span>
    <div>
      <h2>Independent used-car dealers in ${esc(name)}</h2>
      <p class="muted">Lots that are not tied to a manufacturer and buy across every make. ${indep.length ? `Sorted by community.` : ""}</p>
      ${indep.length
        ? `<div class="table-scroll"><table class="valtable ud-table">
        <thead><tr><th>Dealer</th><th>Community</th><th>Known for</th><th class="num">Phone</th></tr></thead>
        <tbody>${indepRows}</tbody></table></div>`
        : `<p class="muted">None in our network yet — the franchised stores below all sell used cars.</p>`}
    </div>
  </section>

  <section class="seo-block">
    <span class="index">03</span>
    <div>
      <h2>Franchised dealers selling used cars, by make</h2>
      <p class="muted">New-car stores sell the trade-ins they take in, and they are usually the strongest buyers for a used car of their own make. Stores that carry several makes appear under each.</p>
      <div class="chipbar ud-jump">${marqueJump}</div>
      ${marqueTables}
    </div>
  </section>

  <section class="seo-block">
    <span class="index">04</span>
    <div>
      <h2>Before you buy from a dealer</h2>
      ${provGuide}
      <div class="ud-prov"><h3>Wherever you buy</h3><p class="muted">Get a vehicle history report and a lien check before you pay — a car sold with money owing on it can be repossessed from the new owner. Ask for an independent pre-purchase inspection; a dealer that refuses one is telling you something. And compare the all-in price, not the monthly payment.</p></div>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">05</span>
    <div>
      <h2>Selling instead?</h2>
      <p class="muted">A trade-in is one offer from one dealer. List your car here instead: set a reserve and a closing time, and the ${esc(name)} dealers nearest you are invited to bid against each other — and against private buyers. You see every bid, and nothing sells below your floor.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="/value.html">What's my car worth?</a>
        <a class="btn btn-ghost" href="/sell.html">List it for auction</a>
        ${cityLinks}
      </div>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">06</span>
    <div>
      <h2>Common questions</h2>
      ${faqHtml}
    </div>
  </section>

  <p class="muted small ud-note">Dealer details come from our dealer network and may be out of date — call ahead before you visit. Figures on this page were computed from that network when it was last built.</p>

  <section class="linkfarm">
    <h2>Used car dealers in other cities</h2>
    <div class="lf-links">${others}</div>
  </section>
</main>`;

    shell({
      file: `used-car-dealers/${slug}/index.html`,
      title: `Used car dealers in ${name} — ${num(list.length)} dealerships | listyourcar.ca`,
      desc: `${num(list.length)} used car dealers in the ${name} area: ${num(indep.length)} independent lots and ${num(franch.length)} franchised stores, with phone numbers, by community and by make.`,
      canonical: `${ORIGIN}/used-car-dealers/${slug}/`,
      dataPage: "static",
      body,
      jsonld: [breadcrumbLd([["Home", "/"], ["Used car dealers", "/used-car-dealers/"], [name, null]]), listLd, faqLd],
    });
    track(`${ORIGIN}/used-car-dealers/${slug}/`, "0.7");
    summaries.push({ slug, name, provs, n: list.length, indep: indep.length, franch: franch.length, towns: towns.length });
  }

  /* ---------- Index, grouped by province ---------- */
  const provOrder = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "NL"];
  const sections = provOrder.map((p) => {
    const here = summaries.filter((s) => s.provs[0] === p).sort((a, b) => b.n - a.n);
    if (!here.length) return "";
    const cards = here.map((s) => `<a class="idx-card" href="/used-car-dealers/${s.slug}/">
      <span class="idx-name">${esc(s.name)}</span>
      <span class="idx-meta">${num(s.n)} dealers · ${num(s.indep)} independent</span>
      <span class="idx-cta">See the dealers →</span></a>`).join("");
    return `<h2 class="ud-idx-prov">${esc(PROVINCE[p].name)}</h2><div class="idx-grid">${cards}</div>`;
  }).join("");
  const total = summaries.reduce((a, s) => a + s.n, 0);

  shell({
    file: "used-car-dealers/index.html",
    title: "Used car dealers in every major Canadian city | listyourcar.ca",
    desc: `Used car dealers in all ${summaries.length} of Canada's census metropolitan areas — ${num(total)} dealerships, independent and franchised, with phone numbers.`,
    canonical: `${ORIGIN}/used-car-dealers/`,
    dataPage: "static",
    body: `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / Used car dealers</nav>
  <div class="page-head">
    <span class="eyebrow">${summaries.length} metros · ${num(total)} dealerships</span>
    <h1>Used car dealers in every major Canadian city</h1>
    <p class="lead narrow">Every census metropolitan area in Canada, and every used-car dealer our network knows in each — independent lots and franchised stores, with a way to reach them.</p>
  </div>
  ${sections}
  <section class="cta section-line">
    <h2>Make them compete for your car.</h2>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-primary" href="/sell.html">List my car</a>
      <a class="btn btn-ghost" href="/find-buyers.html">See every buyer on the map</a>
    </div>
  </section>
</main>`,
    jsonld: [breadcrumbLd([["Home", "/"], ["Used car dealers", null]])],
  });
  track(`${ORIGIN}/used-car-dealers/`, "0.7");

  return { metros: summaries.length, dealers: total };
};
