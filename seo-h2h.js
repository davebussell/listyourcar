/* ============================================================
   seo-h2h.js — head-to-head dealer comparison pages

   Called by build-seo.js. Reads the pairs build-profiles.js chose
   (data/h2h.json: the two closest rival stores selling the same make
   in each major metro) and writes:

     /compare/                       every head-to-head, by metro
     /compare/<a>-vs-<b>/            one page per pair
     data/h2h-index.json             dealer id -> its head-to-heads,
                                     for dealer pages and head-to-head.html

   The comparison itself is rendered by js/h2h.js — the same code the
   browser runs for any two dealers — so a static page and the live
   tool never disagree.
   ============================================================ */

const fs = require("fs");
const path = require("path");

module.exports = function buildH2H({ ROOT, ORIGIN, shell, track, esc, breadcrumbLd }) {
  const pairsFile = path.join(ROOT, "data", "h2h.json");
  if (!fs.existsSync(pairsFile)) return { pages: 0, byMetro: {}, byDealer: {} };
  const { pairs } = JSON.parse(fs.readFileSync(pairsFile, "utf8"));

  global.window = global.window || {};
  require(path.join(ROOT, "js", "dealers.js"));
  require(path.join(ROOT, "js", "h2h.js"));
  const Net = global.window.DealerNet, H2H = global.window.H2H;
  const { METROS } = require(path.join(ROOT, "seo-dealer-guides.js"));
  const metroName = Object.fromEntries(METROS.map((m) => [m[0], m[1]]));

  const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dealers.json"), "utf8"));
  const recs = Net.fromBundle(bundle);
  const domainOf = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  const byDomain = {};
  recs.forEach((r) => { const d = domainOf(r.website); if (d) byDomain[d] = r; });
  const EV = {};
  const evDir = path.join(ROOT, "data", "evidence");
  for (const f of fs.readdirSync(evDir)) Object.assign(EV, JSON.parse(fs.readFileSync(path.join(evDir, f), "utf8")).sites);

  const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const km = (a, b) => {
    const fa = EV[domainOf(a.website)] && EV[domainOf(a.website)].f, fb = EV[domainOf(b.website)] && EV[domainOf(b.website)].f;
    if (fa && fa.g && fb && fb.g) return { km: Net.haversine(fa.g[0], fa.g[1], fb.g[0], fb.g[1]), exact: true };
    return { km: Net.haversine(a.lat, a.lon, b.lat, b.lon), exact: false };
  };
  const distWords = (x) => (x.km < 1 ? (x.exact ? "under a kilometre apart" : "in the same postal district")
    : `${x.exact ? "" : "about "}${x.km < 10 ? x.km.toFixed(1) : Math.round(x.km)} km apart`);

  /* ---------- Resolve and order the pairs ---------- */
  const used = new Set();
  const pages = [];
  for (const p of pairs) {
    let a = byDomain[p.a], b = byDomain[p.b];
    if (!a || !b || a.role !== "dealer" || b.role !== "dealer") continue;
    // A fixed order — alphabetical — so a pair has one address, never two.
    if (a.name.localeCompare(b.name) > 0) [a, b] = [b, a];
    let slug = `${slugify(a.name)}-vs-${slugify(b.name)}`;
    if (used.has(slug)) slug += "-" + p.metro;
    used.add(slug);
    pages.push({ slug, metro: p.metro, make: p.make, a, b, evA: EV[domainOf(a.website)] || null, evB: EV[domainOf(b.website)] || null });
  }

  const byMetro = {}, byDealer = {};
  pages.forEach((pg) => {
    (byMetro[pg.metro] = byMetro[pg.metro] || []).push(pg);
    for (const [me, them] of [[pg.a, pg.b], [pg.b, pg.a]]) (byDealer[me.id] = byDealer[me.id] || []).push([pg.slug, them.name, pg.make]);
  });

  /* ---------- One page per pair ---------- */
  for (const pg of pages) {
    const { a, b, make, metro } = pg;
    const city = metroName[metro] || a.city;
    const out = H2H.render(a, pg.evA, b, pg.evB, {});
    const v = out.verdict;
    const dist = km(a, b);
    const fa = pg.evA && pg.evA.f, fb = pg.evB && pg.evB.f;
    const yrs = (f) => (f && f.y ? new Date().getFullYear() - f.y.v : null);
    const nm = (k) => (k === "a" ? a.name : k === "b" ? b.name : null);

    /* A first paragraph written from this pair's own facts. */
    const bits = [];
    if (fa && fa.y && fb && fb.y) {
      const older = fa.y.v <= fb.y.v ? [a, fa] : [b, fb], newer = older[0] === a ? [b, fb] : [a, fa];
      bits.push(older[1].y.v === newer[1].y.v ? `Both have been at it since ${older[1].y.v}.`
        : `${older[0].name} has been in business since ${older[1].y.v}, ${newer[0].name} since ${newer[1].y.v}.`);
    } else if (fa && fa.y) bits.push(`${a.name} has been in business since ${fa.y.v}.`);
    else if (fb && fb.y) bits.push(`${b.name} has been in business since ${fb.y.v}.`);
    const sa = H2H.hoursStats(fa && fa.h), sb = H2H.hoursStats(fb && fb.h);
    if (sa && sb && Math.abs(sa.total - sb.total) >= 3) {
      const more = sa.total > sb.total ? [a, sa, b, sb] : [b, sb, a, sa];
      bits.push(`${more[0].name}'s showroom is open ${more[1].total} hours a week, against ${more[3].total} at ${more[2].name}.`);
    }
    if (sa && sb && !!sa.sun !== !!sb.sun) bits.push(`Only ${sa.sun ? a.name : b.name} opens on Sundays.`);
    const intro = `${a.name} and ${b.name} both sell ${make} in the ${city} area, ${distWords(dist)}. If you're trading in a ${make} or buying one, these are the two stores you're most likely to compare. ${bits.join(" ")}`;

    /* Questions people ask, answered from the same rows. */
    const faq = [];
    faq.push([`Is ${a.name} or ${b.name} better for selling my car?`,
      v.sell ? `On what their websites say, ${nm(v.sell)} is the likelier buyer. In its favour: ${out.sections[0].rows.filter((r) => r.win === v.sell).map((r) => r.label.toLowerCase()).slice(0, 3).join("; ") || "a higher buyer's take"}. Get a written offer from both before you decide.`
        : `They're level on what their websites say about buying cars. Get a written offer from both and take the higher one, or use it as your trade-in number.`]);
    faq.push([`Is ${a.name} or ${b.name} better for buying a ${make}?`,
      v.buy ? `${nm(v.buy)} says more about what it offers buyers. Compare the price of the exact car you want at both, and check each one's reviews.` : `They're level on what their websites say. Compare the price of the exact car you want at both.`]);
    if (sa && sb) faq.push([`Which is open later, ${a.name} or ${b.name}?`,
      `${a.name}: ${sa.evenings} weeknight${sa.evenings === 1 ? "" : "s"} to 8 pm or later, ${sa.total} showroom hours a week${sa.sun ? ", open Sundays" : ""}. ${b.name}: ${sb.evenings} weeknight${sb.evenings === 1 ? "" : "s"} to 8 pm or later, ${sb.total} hours a week${sb.sun ? ", open Sundays" : ""}. Hours as listed on their websites; holidays differ.`]);
    const t = H2H.TAX[a.province];
    if (t && a.province === b.province) faq.push([`Should I trade in my car at ${a.name} or ${b.name}, or sell it myself?`,
      `Trading in at the store you buy from saves ${t[0]}% of the trade-in's value in sales tax, because tax is charged on the price minus the trade. A private sale usually gets more money, but it has to beat the trade-in by that margin to come out ahead.`]);

    const faqHtml = faq.map(([q, ans]) => `<div class="ud-faq"><h3>${esc(q)}</h3><p class="muted">${esc(ans)}</p></div>`).join("");
    const faqLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) });
    const dealerLd = (d, f) => {
      const o = { "@type": "AutoDealer", name: d.name, url: `${ORIGIN}/dealer.html?id=${d.id}`,
        address: { "@type": "PostalAddress", addressLocality: f && f.a ? f.a.l : d.city, addressRegion: d.province, addressCountry: "CA",
          ...(f && f.a ? { streetAddress: f.a.s } : {}), ...((f && f.a && f.a.pc) || d.postal ? { postalCode: (f && f.a && f.a.pc) || d.postal } : {}) },
        ...(d.phone ? { telephone: d.phone } : {}), brand: d.brands.map((x) => ({ "@type": "Brand", name: x })) };
      if (f && f.h) o.openingHoursSpecification = f.h.map((h, i) => (h ? { "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
        opens: `${String(Math.floor(h[0] / 60)).padStart(2, "0")}:${String(h[0] % 60).padStart(2, "0")}`,
        closes: `${String(Math.floor(h[1] / 60)).padStart(2, "0")}:${String(h[1] % 60).padStart(2, "0")}` } : null)).filter(Boolean);
      if (f && f.g) o.geo = { "@type": "GeoCoordinates", latitude: f.g[0], longitude: f.g[1] };
      return o;
    };
    const listLd = JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", name: `${a.name} vs ${b.name}`,
      itemListElement: [dealerLd(a, fa), dealerLd(b, fb)].map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) });

    const sameMetro = (byMetro[metro] || []).filter((x) => x !== pg);
    const sameMake = pages.filter((x) => x.make === make && x !== pg && x.metro !== metro);
    const link = (x) => `<a href="/compare/${x.slug}/">${esc(x.a.name)} vs ${esc(x.b.name)}</a>`;

    const body = `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / <a href="/compare/">Compare dealers</a> / ${esc(city)} ${esc(make)}</nav>
  <div class="page-head">
    <span class="eyebrow">Head to head · ${esc(city)} · ${esc(make)}</span>
    <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
    <p class="lead narrow h2h-intro">${esc(intro)}</p>
  </div>
  ${out.html}
  <section class="seo-block">
    <span class="index">05</span>
    <div><h2>Common questions</h2>${faqHtml}</div>
  </section>
  <section class="linkfarm">
    <h2>More head-to-heads</h2>
    <div class="lf-links">${sameMetro.map(link).join("")}${sameMake.slice(0, 8).map(link).join("")}
      <a href="/used-car-dealers/${esc(metro)}/">Every used car dealer in ${esc(city)}</a>
      <a href="/head-to-head.html">Compare any two dealers</a></div>
  </section>
</main>`;
    const pickLine = v.sell && v.buy && v.sell === v.buy ? `${nm(v.sell)} edges it on both selling and buying.`
      : v.sell && v.buy ? `${nm(v.sell)} to sell to, ${nm(v.buy)} to buy from.`
      : v.sell ? `${nm(v.sell)} is the likelier buyer for your car.` : v.buy ? `${nm(v.buy)} offers more to buyers.` : "Too close to call.";
    shell({
      file: `compare/${pg.slug}/index.html`,
      title: `${a.name} vs ${b.name} — ${city} ${make} dealers compared | listyourcar.ca`,
      desc: `${a.name} or ${b.name}? Hours, trade-in offers, certified pre-owned, track record and more, side by side. ${pickLine}`,
      canonical: `${ORIGIN}/compare/${pg.slug}/`,
      dataPage: "static",
      body,
      jsonld: [breadcrumbLd([["Home", "/"], ["Compare dealers", "/compare/"], [`${a.name} vs ${b.name}`, null]]), listLd, faqLd],
      scripts: ["/js/h2h.js"],
    });
    track(`${ORIGIN}/compare/${pg.slug}/`, "0.6");
    pg.pick = pickLine;
  }

  /* ---------- The hub ---------- */
  const order = METROS.map((m) => m[0]).filter((s) => byMetro[s]);
  const sections = order.map((s) => {
    const items = byMetro[s].slice().sort((x, y) => x.make.localeCompare(y.make)).map((pg) =>
      `<li><a href="/compare/${pg.slug}/">${esc(pg.a.name)} vs ${esc(pg.b.name)}</a><span class="h2h-mk">${esc(pg.make)}</span><span>${esc(pg.pick)}</span></li>`).join("");
    return `<section class="seo-block" id="${esc(s)}"><span class="index">${esc(String(byMetro[s].length).padStart(2, "0"))}</span><div><h2>${esc(metroName[s])}</h2><ul class="h2h-list">${items}</ul></div></section>`;
  }).join("");
  shell({
    file: "compare/index.html",
    title: "Compare car dealerships head to head | listyourcar.ca",
    desc: `${pages.length} head-to-head comparisons of rival dealerships across ${order.length} Canadian cities: who's the better buyer for your car, and the better place to buy your next one.`,
    canonical: `${ORIGIN}/compare/`,
    dataPage: "static",
    body: `<main class="container section">
  <nav class="crumbs"><a href="/index.html">Home</a> / Compare dealers</nav>
  <div class="page-head">
    <span class="eyebrow">Head to head · ${pages.length} comparisons</span>
    <h1 class="has-mark"><span class="mark">Two dealers. Both ends of the deal.</span></h1>
    <p class="lead narrow">Selling a car usually means buying one, often in the same afternoon. Each comparison puts two rival stores side by side on both: which is the likelier buyer for your car, which offers more when you buy, and what trading in where you buy saves you in tax. Every row comes from the dealer's own website or our dealer network, with the source shown.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/head-to-head.html">Compare any two dealers</a>
      <a class="btn btn-ghost" href="/start.html?path=dealers">Send my car to dealers</a>
    </div>
  </div>
  ${sections}
</main>`,
    jsonld: [breadcrumbLd([["Home", "/"], ["Compare dealers", null]])],
  });
  track(`${ORIGIN}/compare/`, "0.7");

  /* For dealer pages and the compare tool: who each dealer is compared with. */
  fs.writeFileSync(path.join(ROOT, "data", "h2h-index.json"), JSON.stringify(byDealer));

  return {
    pages: pages.length,
    byMetro: Object.fromEntries(Object.entries(byMetro).map(([k, l]) => [k, l.map((pg) => ({ slug: pg.slug, a: pg.a.name, b: pg.b.name, make: pg.make, pick: pg.pick }))])),
  };
};
