/* ============================================================
   build-seo.js — static prerenderer (dev tool, run with Node)

   Emits crawlable landing pages for the two searches that actually
   carry intent — "sell my car <city>" and "what is my car worth" —
   plus the buyer-side auction pages per city.

   Every page carries content computed from the real valuation
   engine, so these are answers rather than doorway pages: a
   value-by-year table per model, and per-city market and
   provincial-paperwork detail.

     node build-seo.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

global.window = {};
require("./js/data.js");
require("./js/valuation.js");
const D = window.LYC_DATA;
const { estimateValue } = window.LYC_VAL;

const ROOT = __dirname;
const ORIGIN = "https://listyourcar.ca";
const V = 23;
const THIS_YEAR = new Date().getFullYear();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => "$" + Math.round(n).toLocaleString("en-CA");
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Breadcrumb markup mirroring the visible crumbs on the page. */
function breadcrumbLd(trail) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, url], i) => ({
      "@type": "ListItem", position: i + 1, name,
      ...(url ? { item: ORIGIN + url } : {}),
    })),
  });
}

/* ---------- Shared shell ---------- */
function shell({ file, title, desc, canonical, dataPage, body, dataAttrs = "", jsonld = [] }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:site_name" content="listyourcar.ca" />
<meta property="og:image" content="${ORIGIN}/assets/cars/model3.jpg" />
<meta property="og:image:width" content="960" />
<meta property="og:image:height" content="498" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${ORIGIN}/assets/cars/model3.jpg" />
<link rel="stylesheet" href="/css/styles.css?v=${V}" />
${jsonld.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n")}
</head>
<body data-page="${dataPage}"${dataAttrs}>
<header class="site-header">
  <div class="container nav">
    <div class="nav-brand"><a href="/index.html" class="logo">List<span>Your</span>Car<span class="tld">.ca</span></a><span class="now-casting"><span class="live-dot"></span>Live bidding</span></div>
    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav-links">
      <a href="/auctions.html">Live Auctions</a>
      <a href="/find-buyers.html">Find Buyers</a>
      <a href="/value.html">What's It Worth</a>
      <div class="nav-more">
        <button type="button" class="nav-more-btn" aria-expanded="false" aria-haspopup="true">More <span class="caret">▾</span></button>
        <div class="nav-more-menu">
          <div class="nm-group"><span class="nm-label">Selling</span>
            <a href="/how-it-works.html">How it works</a>
            <a href="/sell-my-car/">Sell by city</a>
          </div>
          <div class="nm-group"><span class="nm-label">Buying</span>
            <a href="/auctions.html">Live auctions</a>
            <a href="/find-buyers.html">Buyer map</a>
            <a href="/dealers.html">For dealers</a>
          </div>
          <div class="nm-group"><span class="nm-label">Your account</span>
            <a href="/dashboard.html">Dashboard</a>
            <a href="/about.html">About</a>
          </div>
        </div>
      </div>
      <a href="/sell.html" class="btn btn-primary btn-sm">Sell My Car</a>
    </nav>
  </div>
</header>

${body}

<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <a href="/index.html" class="logo">List<span>Your</span>Car<span class="tld">.ca</span></a>
      <p class="muted" style="margin-top:1rem;max-width:32ch">List your car, set your reserve, and let dealers and private buyers bid it up. Canada-wide.</p>
    </div>
    <div><h4>Sell</h4><a href="/value.html">What's my car worth</a><a href="/sell.html">List for auction</a><a href="/sell-my-car/">Sell by city</a><a href="/how-it-works.html">How it works</a></div>
    <div><h4>Buy</h4><a href="/auctions.html">Live auctions</a><a href="/find-buyers.html">Buyer map</a><a href="/car-auctions/">Auctions by city</a><a href="/dealers.html">For dealers</a></div>
    <div><h4>Values</h4><a href="/what-is-my-car-worth/">Car values by model</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></div>
  </div>
  <div class="footer-bottom"><p>&copy; <span id="year"></span> listyourcar.ca — All rights reserved.</p></div>
</footer>

<script src="/js/data.js?v=${V}"></script>
<script src="/js/auction-data.js?v=${V}"></script>
<script src="/js/valuation.js?v=${V}"></script>
<script src="/js/store.js?v=${V}"></script>
<script src="/js/config.js?v=${V}"></script>
<script src="/js/analytics.js?v=${V}"></script>
<script src="/js/app.js?v=${V}"></script>
<script src="/js/auction.js?v=${V}"></script>
<script src="/js/locator.js?v=${V}"></script>
</body>
</html>
`;
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
  count++;
}

let count = 0;
const urls = [];
const track = (loc, priority) => urls.push({ loc, priority });

/* ---------- Vehicles used for the per-city value table ---------- */
const CITY_SAMPLE = [
  ["Toyota", "RAV4", 2021, 60000],
  ["Ford", "F-150", 2020, 85000],
  ["Honda", "Civic", 2021, 55000],
  ["Mazda", "CX-5", 2020, 70000],
  ["Jeep", "Wrangler", 2020, 75000],
];

/* Models that carry real search volume in Canada. */
const MODELS = [
  ["Toyota", "RAV4"], ["Toyota", "Corolla"], ["Toyota", "Camry"],
  ["Toyota", "Tacoma"], ["Toyota", "Highlander"],
  ["Honda", "Civic"], ["Honda", "CR-V"], ["Honda", "Accord"],
  ["Ford", "F-150"], ["Ford", "Escape"], ["Ford", "Explorer"],
  ["Chevrolet", "Silverado"], ["Chevrolet", "Equinox"],
  ["Mazda", "CX-5"], ["Mazda", "Mazda3"],
  ["Hyundai", "Tucson"], ["Hyundai", "Elantra"],
  ["Kia", "Sportage"], ["Kia", "Sorento"],
  ["Nissan", "Rogue"],
  ["Subaru", "Outback"], ["Subaru", "Forester"], ["Subaru", "Crosstrek"],
  ["Jeep", "Wrangler"], ["Jeep", "Grand Cherokee"],
  ["Ram", "1500"], ["GMC", "Sierra"],
  ["Tesla", "Model 3"], ["Tesla", "Model Y"],
  ["Volkswagen", "Tiguan"], ["Volkswagen", "Golf"],
];

/* ============================================================
   1. Sell my car in <city>
   ============================================================ */
CITIES_LOOP: for (const c of D.CITIES) {
  const rows = CITY_SAMPLE.map(([make, model, year, km]) => {
    const e = estimateValue({ make, model, year, mileage: km, condition: "good" });
    return `<tr>
      <th>${year} ${esc(make)} ${esc(model)}</th>
      <td class="num">${Number(km).toLocaleString("en-CA")} km</td>
      <td class="num muted">${money(e.tradeIn)}</td>
      <td class="num strong">${money(e.bidLow)} – ${money(e.bidHigh)}</td>
      <td class="num up">+${money(e.upside)}</td>
    </tr>`;
  }).join("");

  const others = D.CITIES.filter((x) => x.slug !== c.slug)
    .map((x) => `<a href="/sell-my-car/${x.slug}/">Sell your car in ${esc(x.name)}</a>`).join("");

  const body = `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/sell-my-car/">Sell my car</a> / ${esc(c.name)}</nav>

  <div class="page-head">
    <span class="eyebrow">${esc(c.province)} · ${esc(c.region)}</span>
    <h1>Sell your car in ${esc(c.name)}</h1>
    <p class="lead narrow">Skip the lowball trade-in. List your car, set a reserve and a closing time, and let verified ${esc(c.name)} dealers and private buyers bid against each other until the clock runs out.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/value.html?city=${c.slug}">What's my car worth?</a>
      <a class="btn btn-ghost" href="/sell.html?city=${c.slug}">List it for auction</a>
    </div>
  </div>

  <section class="seo-block">
    <span class="index">01</span>
    <div>
      <h2>What cars fetch in ${esc(c.name)}</h2>
      <p class="muted">${esc(c.market)}</p>
      <div class="table-scroll">
        <table class="valtable">
          <thead><tr><th>Vehicle</th><th class="num">Distance</th><th class="num">Trade-in</th><th class="num">At auction</th><th class="num">Difference</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="muted small">Smart Estimate figures for vehicles in good condition, ${THIS_YEAR}. Your car's own history, tires and service record move the number — <a href="/value.html?city=${c.slug}" class="link-inline">run yours</a>.</p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">02</span>
    <div>
      <h2>Live auctions in ${esc(c.name)}</h2>
      <div class="ac-grid" id="city-auctions"></div>
      <p class="muted small" id="city-auctions-note"></p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">03</span>
    <div>
      <h2>The paperwork in ${esc(c.provinceName)}</h2>
      <p>${esc(c.paperwork)}</p>
      <div class="tipbox"><strong>Local tip.</strong> ${esc(c.tip)}</div>
      <p class="muted small">A plain-language summary, not legal advice. Requirements and tax rates change — confirm the current rules with ${esc(c.provinceName)} before you close.</p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">04</span>
    <div>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><span class="index">01</span><h3>Check the number</h3><p>Free Smart Estimate: trade-in value, auction range, and the gap between them.</p></div>
        <div class="step"><span class="index">02</span><h3>Set your terms</h3><p>Your reserve is the floor. Below it, nothing sells and nothing is owed.</p></div>
        <div class="step"><span class="index">03</span><h3>Let them compete</h3><p>${esc(c.name)} dealers and private buyers bid in the open until your closing time.</p></div>
        <div class="step"><span class="index">04</span><h3>Close and hand over</h3><p>Clear the reserve and it's a sale. You deal with the buyer directly.</p></div>
      </div>
    </div>
  </section>

  <section class="linkfarm">
    <h2>Selling somewhere else?</h2>
    <div class="lf-links">${others}</div>
  </section>

  <section class="cta section-line">
    <h2>Find out what your car would fetch in ${esc(c.name)}.</h2>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-primary" href="/value.html?city=${c.slug}">Get my Smart Estimate</a>
    </div>
  </section>
</main>`;

  shell({
    file: `sell-my-car/${c.slug}/index.html`,
    title: `Sell your car in ${c.name} — dealers bid, you set the reserve | listyourcar.ca`,
    desc: `Sell your car in ${c.name} by auction. Verified dealers and private buyers bid against each other; you set the reserve and the closing time. Free estimate first — see what it should fetch.`,
    canonical: `${ORIGIN}/sell-my-car/${c.slug}/`,
    dataPage: "city",
    dataAttrs: ` data-city="${c.slug}"`,
    body,
    jsonld: [breadcrumbLd([['Home','/'],['Sell my car','/sell-my-car/'],[c.name,null]])],
  });
  track(`${ORIGIN}/sell-my-car/${c.slug}/`, "0.8");
}

/* ============================================================
   2. Car auctions in <city> (buyer intent)
   ============================================================ */
for (const c of D.CITIES) {
  const others = D.CITIES.filter((x) => x.slug !== c.slug)
    .map((x) => `<a href="/car-auctions/${x.slug}/">Car auctions in ${esc(x.name)}</a>`).join("");

  const body = `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/car-auctions/">Car auctions</a> / ${esc(c.name)}</nav>

  <div class="page-head">
    <span class="eyebrow">${esc(c.province)} · ${esc(c.region)}</span>
    <h1>Car auctions in ${esc(c.name)}</h1>
    <p class="lead narrow">Private cars listed by the people who own them, with a disclosed reserve and a hard closing time. No wholesale middleman, and no buyer's premium guesswork — you see every competing bid.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/auctions.html?city=${c.slug}">Browse live lots</a>
      <a class="btn btn-ghost" href="/dealers.html">Register as a dealer</a>
    </div>
  </div>

  <section class="seo-block">
    <span class="index">01</span>
    <div>
      <h2>Open now in ${esc(c.name)}</h2>
      <div class="ac-grid" id="city-auctions"></div>
      <p class="muted small" id="city-auctions-note"></p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">02</span>
    <div>
      <h2>What the ${esc(c.name)} market looks like</h2>
      <p class="muted">${esc(c.market)}</p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">03</span>
    <div>
      <h2>How bidding works</h2>
      <div class="steps">
        <div class="step"><span class="index">01</span><h3>Every bid is public</h3><p>Amount, bidder type and timestamp. Dealers bid under their business name.</p></div>
        <div class="step"><span class="index">02</span><h3>Reserve is disclosed</h3><p>You always know whether the seller's floor has been cleared — before you bid.</p></div>
        <div class="step"><span class="index">03</span><h3>Fixed closing time</h3><p>No endless haggling. The clock runs out and the high bid wins.</p></div>
        <div class="step"><span class="index">04</span><h3>Direct handover</h3><p>Win above reserve and you get the seller's details immediately.</p></div>
      </div>
      <p class="muted small">Buying in ${esc(c.provinceName)}: ${esc(c.paperwork)}</p>
    </div>
  </section>

  <section class="linkfarm">
    <h2>Auctions in other cities</h2>
    <div class="lf-links">${others}</div>
  </section>

  <section class="cta section-line">
    <h2>Got a car to sell instead?</h2>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-primary" href="/value.html?city=${c.slug}">What's it worth?</a>
      <a class="btn btn-ghost" href="/sell-my-car/${c.slug}/">Sell in ${esc(c.name)}</a>
    </div>
  </section>
</main>`;

  shell({
    file: `car-auctions/${c.slug}/index.html`,
    title: `Car auctions in ${c.name} — bid on private inventory | listyourcar.ca`,
    desc: `Live car auctions in ${c.name}. Private-seller vehicles with disclosed reserves and a fixed closing time. Every bid public, dealers and private buyers competing.`,
    canonical: `${ORIGIN}/car-auctions/${c.slug}/`,
    dataPage: "city",
    dataAttrs: ` data-city="${c.slug}"`,
    body,
    jsonld: [breadcrumbLd([['Home','/'],['Car auctions','/car-auctions/'],[c.name,null]])],
  });
  track(`${ORIGIN}/car-auctions/${c.slug}/`, "0.7");
}

/* ============================================================
   3. What is a <make> <model> worth — value by year and distance
   ============================================================ */
for (const [make, model] of MODELS) {
  const slug = slugify(`${make}-${model}`);

  // Value by model year, at distance typical for the age.
  const years = [];
  for (let y = THIS_YEAR - 1; y >= THIS_YEAR - 10; y--) {
    const age = THIS_YEAR - y;
    const km = age * 18000;
    const e = estimateValue({ make, model, year: y, mileage: km, condition: "good" });
    years.push({ y, km, e });
  }
  const yearRows = years.map(({ y, km, e }) => `<tr>
    <th>${y}</th>
    <td class="num muted">${Number(km).toLocaleString("en-CA")} km</td>
    <td class="num muted">${money(e.tradeIn)}</td>
    <td class="num strong">${money(e.bidLow)} – ${money(e.bidHigh)}</td>
    <td class="num">${money(e.privateHigh)}</td>
  </tr>`).join("");

  // How distance moves a mid-age example.
  const refYear = THIS_YEAR - 5;
  const kmRows = [40000, 80000, 120000, 160000, 200000].map((km) => {
    const e = estimateValue({ make, model, year: refYear, mileage: km, condition: "good" });
    return `<tr>
      <th>${Number(km).toLocaleString("en-CA")} km</th>
      <td class="num muted">${money(e.tradeIn)}</td>
      <td class="num strong">${money(e.bidLow)} – ${money(e.bidHigh)}</td>
    </tr>`;
  }).join("");

  // How condition moves the same car.
  const condRows = [["excellent", "Excellent — no needs"], ["good", "Good — normal wear"], ["fair", "Fair — cosmetic or minor mechanical"], ["needs-work", "Needs work"]].map(([cond, label]) => {
    const e = estimateValue({ make, model, year: refYear, mileage: refYear ? (THIS_YEAR - refYear) * 18000 : 90000, condition: cond });
    return `<tr><th>${esc(label)}</th><td class="num strong">${money(e.bidLow)} – ${money(e.bidHigh)}</td></tr>`;
  }).join("");

  const sample = estimateValue({ make, model, year: refYear, mileage: 5 * 18000, condition: "good" });
  const others = MODELS.filter(([mk, md]) => !(mk === make && md === model))
    .slice(0, 14)
    .map(([mk, md]) => `<a href="/what-is-my-car-worth/${slugify(mk + "-" + md)}/">${esc(mk)} ${esc(md)} value</a>`).join("");
  const cityLinks = D.CITIES.map((c) => `<a href="/sell-my-car/${c.slug}/">Sell a ${esc(make)} ${esc(model)} in ${esc(c.name)}</a>`).join("");

  const body = `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/what-is-my-car-worth/">Car values</a> / ${esc(make)} ${esc(model)}</nav>

  <div class="page-head">
    <span class="eyebrow">Canadian values · ${THIS_YEAR}</span>
    <h1>What is a ${esc(make)} ${esc(model)} worth?</h1>
    <p class="lead narrow">A ${refYear} ${esc(make)} ${esc(model)} in good condition with average distance is worth about <strong>${money(sample.tradeIn)}</strong> on trade-in — but should fetch <strong>${money(sample.bidLow)}–${money(sample.bidHigh)}</strong> when dealers and private buyers bid against each other. That gap is roughly ${money(sample.upside)}.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/value.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}">Value my ${esc(model)}</a>
      <a class="btn btn-ghost" href="/sell.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}">Sell it at auction</a>
    </div>
  </div>

  <section class="seo-block">
    <span class="index">01</span>
    <div>
      <h2>${esc(make)} ${esc(model)} value by year</h2>
      <p class="muted">Good condition, at the distance typical for each model year (about 18,000 km a year, the Canadian average).</p>
      <div class="table-scroll">
        <table class="valtable">
          <thead><tr><th>Year</th><th class="num">Distance</th><th class="num">Trade-in</th><th class="num">At auction</th><th class="num">Private sale</th></tr></thead>
          <tbody>${yearRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">02</span>
    <div>
      <h2>How distance changes it</h2>
      <p class="muted">A ${refYear} ${esc(make)} ${esc(model)} in good condition, at different odometer readings.</p>
      <div class="table-scroll">
        <table class="valtable">
          <thead><tr><th>Distance</th><th class="num">Trade-in</th><th class="num">At auction</th></tr></thead>
          <tbody>${kmRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">03</span>
    <div>
      <h2>How condition changes it</h2>
      <div class="table-scroll">
        <table class="valtable">
          <thead><tr><th>Condition</th><th class="num">At auction</th></tr></thead>
          <tbody>${condRows}</tbody>
        </table>
      </div>
      <p class="muted small">Condition is the single biggest lever you control. A detail, a fresh set of tires and a tidy service file routinely move a car up a grade.</p>
    </div>
  </section>

  <section class="seo-block">
    <span class="index">04</span>
    <div>
      <h2>Where these numbers come from</h2>
      <p>Our Smart Estimate starts from the ${esc(make)} ${esc(model)}'s delivered price when new, then applies a depreciation curve, your distance measured against the Canadian average, condition, body-style demand, how well ${esc(make)} holds value relative to the segment, and the season you're selling in.</p>
      <p class="muted">Nothing is hidden: run your own car and the tool shows every factor and what it added or subtracted. It's an estimate, not an appraisal — service history, accident record and tires all move the real number.</p>
      <a class="link" href="/value.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}">Run my ${esc(model)} →</a>
    </div>
  </section>

  <section class="linkfarm">
    <h2>Other models</h2>
    <div class="lf-links">${others}</div>
  </section>

  <section class="linkfarm">
    <h2>Selling a ${esc(make)} ${esc(model)} near you</h2>
    <div class="lf-links">${cityLinks}</div>
  </section>

  <section class="cta section-line">
    <h2>Get the number for your actual ${esc(model)}.</h2>
    <p class="lead">Year, distance and condition. Thirty seconds, free.</p>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-primary" href="/value.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}">Value my ${esc(model)}</a>
    </div>
  </section>
</main>`;

  shell({
    file: `what-is-my-car-worth/${slug}/index.html`,
    title: `What is a ${make} ${model} worth? ${THIS_YEAR} Canadian values | listyourcar.ca`,
    desc: `${make} ${model} values in Canada by year, distance and condition. See trade-in value versus what competitive bidding should get you — a ${refYear} is worth about ${money(sample.tradeIn)} on trade, ${money(sample.bidLow)}–${money(sample.bidHigh)} at auction.`,
    canonical: `${ORIGIN}/what-is-my-car-worth/${slug}/`,
    dataPage: "model",
    body,
    jsonld: [breadcrumbLd([['Home','/'],['Car values','/what-is-my-car-worth/'],[make + ' ' + model, null]])],
  });
  track(`${ORIGIN}/what-is-my-car-worth/${slug}/`, "0.7");
}

/* ============================================================
   4. Index pages
   ============================================================ */
function indexPage({ file, title, desc, canonical, h1, lead, eyebrow, items, extra = "" }) {
  const body = `<main class="container section">
  <div class="page-head">
    <span class="eyebrow">${esc(eyebrow)}</span>
    <h1>${esc(h1)}</h1>
    <p class="lead narrow">${esc(lead)}</p>
  </div>
  <div class="idx-grid">${items}</div>
  ${extra}
  <section class="cta section-line">
    <h2>Start with what it's worth.</h2>
    <div class="hero-actions" style="justify-content:center">
      <a class="btn btn-primary" href="/value.html">Get my Smart Estimate</a>
      <a class="btn btn-ghost" href="/auctions.html">See live auctions</a>
    </div>
  </section>
</main>`;
  shell({ file, title, desc, canonical, dataPage: "static", body });
  track(canonical, "0.6");
}

indexPage({
  file: "sell-my-car/index.html",
  title: "Sell my car — by city, across Canada | listyourcar.ca",
  desc: "Sell your car by auction in Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Winnipeg or Halifax. Dealers and private buyers bid; you set the reserve.",
  canonical: `${ORIGIN}/sell-my-car/`,
  eyebrow: "By city", h1: "Sell your car, wherever you are",
  lead: "Pick your city for local market conditions, the provincial paperwork you'll need, and the dealers bidding there.",
  items: D.CITIES.map((c) => `<a class="idx-card" href="/sell-my-car/${c.slug}/">
    <span class="idx-name">${esc(c.name)}</span>
    <span class="idx-meta">${esc(c.province)} · ${esc(c.region)}</span>
    <span class="idx-cta">Sell in ${esc(c.name)} →</span></a>`).join(""),
});

indexPage({
  file: "car-auctions/index.html",
  title: "Car auctions in Canada — by city | listyourcar.ca",
  desc: "Live car auctions across Canada. Private-seller inventory with disclosed reserves and fixed closing times, in eight major markets.",
  canonical: `${ORIGIN}/car-auctions/`,
  eyebrow: "By city", h1: "Car auctions across Canada",
  lead: "Private cars, disclosed reserves, a hard closing time, and every bid in the open. Choose your market.",
  items: D.CITIES.map((c) => `<a class="idx-card" href="/car-auctions/${c.slug}/">
    <span class="idx-name">${esc(c.name)}</span>
    <span class="idx-meta">${esc(c.province)} · ${esc(c.region)}</span>
    <span class="idx-cta">Browse ${esc(c.name)} →</span></a>`).join(""),
});

indexPage({
  file: "what-is-my-car-worth/index.html",
  title: "What is my car worth? Canadian car values by model | listyourcar.ca",
  desc: "Canadian used-car values by make and model — trade-in value versus what competitive bidding should get you, broken down by year, distance and condition.",
  canonical: `${ORIGIN}/what-is-my-car-worth/`,
  eyebrow: "Car values", h1: "What is my car worth?",
  lead: "Values by model, year, distance and condition — and the gap between the trade-in offer and what an auction should get you.",
  items: MODELS.map(([mk, md]) => `<a class="idx-card" href="/what-is-my-car-worth/${slugify(mk + "-" + md)}/">
    <span class="idx-name">${esc(mk)} ${esc(md)}</span>
    <span class="idx-cta">See values →</span></a>`).join(""),
  extra: `<section class="linkfarm"><h2>Don't see yours?</h2>
    <p class="muted">The estimator covers every make and model — these are just the ones people search for most.</p>
    <div class="hero-actions"><a class="btn btn-primary" href="/value.html">Value any car</a></div></section>`,
});

/* ============================================================
   4b. Photo credits
   The seed vehicle photos are CC BY-SA / public domain from
   Wikimedia Commons. BY-SA requires naming the author and licence,
   so this page is a licensing obligation, not a nicety. It is
   generated from assets/cars/credits.json, which the download
   script writes — so credits can never drift from the files.
   ============================================================ */
try {
  const credits = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/cars/credits.json"), "utf8"));
  const rows = credits.map((c) => `<tr>
      <th><img class="credit-thumb" src="/assets/cars/${esc(c.file)}" alt="" loading="lazy" /></th>
      <td><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a></td>
      <td>${esc(c.author)}</td>
      <td>${esc(c.licence)}</td>
    </tr>`).join("");

  shell({
    file: "credits.html",
    title: "Photo credits | listyourcar.ca",
    desc: "Attribution for the vehicle photography used on listyourcar.ca, sourced from Wikimedia Commons under free licences.",
    canonical: `${ORIGIN}/credits.html`,
    dataPage: "static",
    body: `<main class="container section">
  <div class="page-head">
    <span class="eyebrow">Attribution</span>
    <h1>Photo credits</h1>
    <p class="lead narrow">Vehicle photography on our demonstration listings comes from Wikimedia Commons under free licences. Where a licence requires attribution, the author and licence are named below. Photos on real member listings are supplied by the seller.</p>
  </div>
  <div class="table-scroll">
    <table class="valtable credits-table">
      <thead><tr><th>Photo</th><th>File</th><th>Author</th><th>Licence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="muted small" style="margin-top:2rem">CC BY-SA licences require that derivative works be shared under the same terms. If you reuse these images, follow the licence linked on each file's Commons page.</p>
</main>`,
  });
  track(`${ORIGIN}/credits.html`, "0.2");
  console.log(`  credits.html       ${credits.length} photos attributed`);
} catch (e) {
  console.log("  credits.html SKIPPED —", e.message);
}

/* ============================================================
   5. Sitemap
   ============================================================ */
const core = [
  [`${ORIGIN}/`, "1.0"],
  [`${ORIGIN}/value.html`, "0.9"],
  [`${ORIGIN}/sell.html`, "0.9"],
  [`${ORIGIN}/auctions.html`, "0.9"],
  [`${ORIGIN}/find-buyers.html`, "0.8"],
  [`${ORIGIN}/how-it-works.html`, "0.7"],
  [`${ORIGIN}/dealers.html`, "0.7"],
  [`${ORIGIN}/about.html`, "0.4"],
  [`${ORIGIN}/contact.html`, "0.4"],
];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${core.map(([loc, p]) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join("\n")}
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log(`Generated ${count} SEO pages`);
console.log(`  sell-my-car/       ${D.CITIES.length} cities + index`);
console.log(`  car-auctions/      ${D.CITIES.length} cities + index`);
console.log(`  what-is-my-car-worth/ ${MODELS.length} models + index`);
console.log(`Sitemap: ${core.length + urls.length} URLs`);
