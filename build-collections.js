/* ============================================================
   build-collections.js — static prerenderer (dev tool, run with Node)
   Emits real, crawlable HTML for every collection and
   collection+city page under /collections/..., so search engines
   see full content without executing JS. Re-run after data changes:
     node build-collections.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

global.window = {};
require("./js/data.js");
const D = window.LYC_DATA;
const ROOT = __dirname;
const ORIGIN = "https://listyourcar.ca";

const cityName = (slug) => (D.CITIES.find((c) => c.slug === slug) || {}).name || slug;
const fmt = (n) => "$" + Number(n).toLocaleString("en-CA");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function navHTML() {
  return `<header class="site-header"><div class="container nav">
    <a href="/index.html" class="logo">List<span>Your</span>Car<span class="tld">.ca</span></a>
    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav-links">
      <a href="/browse.html">Browse</a>
      <a href="/collections/" class="active">Collections</a>
      <a href="/list.html">List Your Car</a>
      <a href="/guides.html">Guides</a>
      <a href="/pricing.html">Pricing</a>
      <a href="/dashboard.html" class="inbox-link">Dashboard <span id="inbox-count" class="inbox-badge" hidden></span></a>
      <a href="https://listyourspace.ca" class="spaces-link" target="_blank" rel="noopener">Spaces ↗</a>
      <a href="/list.html" class="btn btn-primary btn-sm">List a Car</a>
    </nav></div></header>`;
}
function footHTML() {
  return `<footer class="site-footer"><div class="footer-bottom"><p>&copy; <span id="year"></span> listyourcar.ca — All rights reserved.</p></div></footer>
  <script src="/js/data.js?v=3"></script><script src="/js/store.js?v=3"></script><script src="/js/config.js?v=3"></script><script src="/js/app.js?v=3"></script>`;
}
function page({ title, desc, canonical, image, body }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" /><meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" /><meta property="og:image" content="${image}" />
<meta property="og:url" content="${canonical}" /><meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="/css/styles.css?v=3" />
</head><body data-page="collections-static">
${navHTML()}
<main class="container section">${body}</main>
${footHTML()}
</body></html>`;
}

function cardHTML(l) {
  const img = l.image;
  const thumb = img
    ? `<div class="thumb has-img"><img src="${img}" alt="${esc(l.year + " " + l.make + " " + l.model)}" loading="lazy" /><div class="badges"><span class="badge badge-rent">For shoots</span></div></div>`
    : `<div class="thumb">${l.emoji}<div class="badges"><span class="badge badge-rent">For shoots</span></div></div>`;
  return `<a class="car-card" href="/listing.html?id=${l.id}">${thumb}
    <div class="body"><h3>${esc(l.year + " " + l.make + " " + l.model)}</h3>
    <div class="price">${fmt(l.dailyRate)}<span class="per">/day</span></div>
    <p class="meta">${esc(cityName(l.city))}</p></div></a>`;
}

function write(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

let count = 0;

/* ---- Collections index ---- */
const idxBody = `
  <span class="eyebrow">Browse by look</span>
  <h1>Collections</h1>
  <p class="lead narrow">Find the exact car your shoot needs — by style and by city. Every collection is stocked across Canada's film metros.</p>
  <div class="card-grid collection-grid">
  ${D.CATEGORIES.map((c) => `<a class="collection-card" href="/collections/${c.id}/">
      <div class="collection-thumb"><img src="${c.images[0]}" alt="${esc(c.name)}" loading="lazy" /><span class="collection-emoji">${c.emoji}</span></div>
      <div class="collection-body"><h3>${esc(c.name)}</h3><p>${esc(c.tagline)}</p><span class="link">View collection →</span></div></a>`).join("")}
  </div>
  <div class="local-strip"><h2>Every collection, every city</h2><p class="muted">Jump straight to a look in your metro.</p>
  ${D.CATEGORIES.map((c) => `<div class="dir-row"><span class="dir-cat">${c.emoji} ${esc(c.name)}</span>
    <span class="dir-links">${D.FILM_CITIES.map((cs) => `<a href="/collections/${c.id}/${cs}/">${esc(cityName(cs))}</a>`).join("")}</span></div>`).join("")}
  </div>`;
write("collections/index.html", page({
  title: "Collections — cars for photo & film shoots | listyourcar.ca",
  desc: "Browse cars for photo and film shoots by collection and city — vintage, luxury, military, muscle, exotic and modern, across Canada's film metros.",
  canonical: `${ORIGIN}/collections/`, image: D.CATEGORIES[0].images[0], body: idxBody,
}));
count++;

/* ---- Per collection + per collection×city ---- */
D.CATEGORIES.forEach((cat) => {
  const variants = [{ city: null }].concat(D.FILM_CITIES.map((c) => ({ city: c })));
  variants.forEach(({ city }) => {
    const cObj = city && D.CITIES.find((c) => c.slug === city);
    const where = cObj ? `in ${cObj.name}` : "across Canada";
    const items = D.SEED_LISTINGS.filter((l) =>
      l.category === cat.id && (l.intent === "rental" || l.intent === "both") && (city ? l.city === city : true));
    const otherCities = D.FILM_CITIES.filter((cs) => cs !== city);
    const otherCats = D.CATEGORIES.filter((c) => c.id !== cat.id);
    const titleLook = cat.name.toLowerCase();
    const body = `
      <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/collections/">Collections</a> / <a href="/collections/${cat.id}/">${esc(cat.name)}</a>${cObj ? " / " + esc(cObj.name) : ""}</nav>
      <span class="eyebrow">${cat.emoji} ${esc(cat.name)} collection</span>
      <h1>${esc(cat.name)} cars for photo &amp; film shoots ${esc(where)}</h1>
      <p class="lead narrow">${esc(cat.tagline)} Perfect for ${esc(cat.use)}. ${cObj ? `Available now in ${esc(cObj.name)} — book by the hour or the day.` : "Stocked in every Canadian film metro."}</p>
      <div class="hero-actions"><a class="btn btn-primary" href="/list.html?intent=rental">List your ${esc(titleLook.split(" ")[0])} car</a>${cObj ? `<a class="btn btn-ghost" href="/collections/${cat.id}/">See all cities</a>` : ""}</div>
      ${cObj ? `<div class="local-note"><strong>${esc(cObj.name)}:</strong> ${esc(cObj.note)}</div>` : ""}
      <div class="section-head" style="margin-top:2.5rem"><h2>${items.length} ${items.length === 1 ? "car" : "cars"} ${esc(where)}</h2></div>
      <div class="card-grid">${items.map(cardHTML).join("")}</div>
      <div class="local-strip"><h2>${esc(cat.name)} in other cities</h2><div class="local-links">
        ${otherCities.map((cs) => `<a href="/collections/${cat.id}/${cs}/">${esc(cat.name)} in ${esc(cityName(cs))}</a>`).join("")}</div></div>
      <div class="local-strip"><h2>Other collections${cObj ? " in " + esc(cObj.name) : ""}</h2><div class="local-links">
        ${otherCats.map((c) => `<a href="/collections/${c.id}/${cObj ? cObj.slug + "/" : ""}">${c.emoji} ${esc(c.name)}</a>`).join("")}</div></div>`;
    const canonical = `${ORIGIN}/collections/${cat.id}/${city ? city + "/" : ""}`;
    const rel = `collections/${cat.id}/${city ? city + "/" : ""}index.html`;
    write(rel, page({
      title: `${cat.name} cars for photo & film shoots ${where} | listyourcar.ca`,
      desc: `Rent ${titleLook} cars as backdrops for photo and film shoots ${where}. ${cat.tagline} Browse ${cat.use}.`,
      canonical, image: cat.images[0], body,
    }));
    count++;
  });
});

console.log(`Generated ${count} static collection pages under /collections/`);
