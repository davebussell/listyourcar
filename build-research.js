#!/usr/bin/env node
/* ============================================================
   listyourcar.ca — dealer website research

   Reads each dealer's own homepage, once, and records whether the
   dealer publicly says it buys cars, offers a trade-in appraisal,
   or sells used stock — with a short quote as evidence. These are
   the facts behind each dealer's buyer's take.

     node build-research.js            resumes; only fetches what's new
     node build-research.js --refresh  re-checks everything

   Manners:
   - one request per site (plus robots.txt), a handful at a time
   - identifies itself, and honours robots.txt for "/"
   - reads at most 800 KB of a page
   - never records email addresses or anything personal; only
     short public phrases about what the business does

   Output: data/.research-cache.json (private, gitignored) — raw
   per-domain results. build-dealers.js turns it into profile codes
   and data/dealer-evidence.json, the public quotes.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "data");
const RAW = path.join(DIR, "dealers-raw.json");
const OUT = path.join(DIR, ".research-cache.json");
const UA = "Mozilla/5.0 (compatible; ListYourCarResearch/1.0; +https://listyourcar.ca/about.html)";
const CONCURRENCY = 10;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 800 * 1024;
const REFRESH = process.argv.includes("--refresh");

/* What a dealer's own site can tell a seller. English and French. */
const SIGNALS = {
  buys: [
    /\bwe buy (?:cars|vehicles|used cars|all makes|any car|trucks)\b/i,
    /\bsell (?:us )?your (?:car|vehicle|truck)\b/i,
    /\bsell (?:or|&|and) trade\b/i,
    /\b(?:instant|guaranteed) (?:cash )?offer\b/i,
    /\bcash for (?:your )?(?:car|vehicle|truck)s?\b/i,
    /\bwe(?:'ll| will) buy your (?:car|vehicle)\b/i,
    /\bget (?:an|your) (?:instant )?offer\b/i,
    /\bnous achetons\b/i,
    /\bachat de (?:véhicules|voitures|autos)\b/i,
    /\bvendez(?:-nous)? votre (?:auto|voiture|véhicule)\b/i,
    /\bon ach[eè]te (?:votre|vos|les) (?:auto|voiture|véhicule)s?\b/i,
  ],
  trade: [
    /\b(?:value|appraise) your (?:trade|trade-in|vehicle|car)\b/i,
    /\btrade-?in (?:value|appraisal|evaluator|estimator|calculator)\b/i,
    /\bwhat'?s (?:my|your) (?:car|trade|vehicle|trade-in) worth\b/i,
    /\bévaluation (?:de votre |du |gratuite de votre )?(?:véhicule|échange)\b/i,
    /\bvaleur (?:de votre )?(?:échange|véhicule)\b/i,
  ],
  tool: [
    /\bcanadian black book\b/i, /\bkelley blue book\b/i, /\btradepending\b/i,
    /\bautoverify\b/i, /\baccu-?trade\b/i, /\bcarfax (?:trade|value)\b/i,
    /\btrade-?in (?:tool|widget)\b/i,
  ],
  used: [
    /\b(?:used|pre-owned|preowned) (?:vehicles|cars|inventory|trucks|suvs)\b/i,
    /\bvéhicules? d'occasion\b/i, /\bvoitures? d'occasion\b/i, /\bvéhicules? usagés?\b/i,
  ],
  cpo: [
    /\bcertified pre-owned\b/i, /\bvéhicules? d'occasion certifiés?\b/i,
  ],
};
/* A link to a dedicated buying or appraisal page is the strongest sign. */
const PAGE_HREF = /(?:sell-?(?:us-)?your-?(?:car|vehicle)|sell-?my-?car|we-?buy|webuy|instant-?(?:cash-?)?offer|value-?your-?trade|trade-?in|tradein|appraisal|evaluation|vendez|achat-de-vehicule)/i;

const domainOf = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

function textOf(html) {
  return clean(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&eacute;/g, "é"));
}

/* A short quote around the match — the dealer's own words. Anything
   resembling an email address is dropped rather than stored. */
function quote(text, re) {
  const m = re.exec(text);
  if (!m) return null;
  const a = Math.max(0, m.index - 30), b = Math.min(text.length, m.index + m[0].length + 40);
  let q = text.slice(a, b);
  q = q.replace(/^\S*\s/, "").replace(/\s\S*$/, "");     // whole words only
  // A match inside page data rather than visible text comes with JSON
  // punctuation around it; the phrase itself is the honest quote.
  if (/@/.test(q) || /["\\{}[\]]|":|\\u/.test(q)) q = m[0];
  return clean(q).slice(0, 110);
}

/* Name the appraisal vendor rather than quote script noise. */
const TOOL_NAMES = [
  [/canadian black book/i, "Canadian Black Book"], [/kelley blue book/i, "Kelley Blue Book"],
  [/tradepending/i, "TradePending"], [/autoverify/i, "AutoVerify"], [/accu-?trade/i, "Accu-Trade"],
  [/carfax/i, "CARFAX"], [/trade-?in (?:tool|widget)/i, "an online trade-in tool"],
];

async function get(url, maxBytes) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.5", "Accept-Language": "en-CA,fr-CA;q=0.8" },
    redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = r.headers.get("content-type") || "";
  let body = "";
  if (r.body && (type.includes("html") || type.includes("text"))) {
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let n = 0;
    while (n < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      n += value.length;
      body += dec.decode(value, { stream: true });
    }
    try { await reader.cancel(); } catch { /* already closed */ }
  }
  return { status: r.status, url: r.url, type, body };
}

/* robots.txt: skip the site if "/" is disallowed for everyone or for us. */
async function allowed(base) {
  try {
    const r = await get(base + "/robots.txt", 64 * 1024);
    if (r.status >= 400) return true;
    let applies = false, blocked = false;
    for (const raw of r.body.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") applies = v === "*" || /listyourcar/i.test(v);
      else if (applies && k === "disallow" && v === "/") blocked = true;
      else if (applies && k === "allow" && v === "/") blocked = false;
    }
    return !blocked;
  } catch { return true; }
}

async function research(domain) {
  const rec = { domain, checked: new Date().toISOString().slice(0, 10), status: "error", signals: {}, evidence: {}, pages: [] };
  let page = null, base = null;
  for (const scheme of ["https://", "http://"]) {
    base = scheme + (domain.includes(".") ? "www." + domain : domain);
    try {
      if (!(await allowed(base))) { rec.status = "robots"; return rec; }
      page = await get(base + "/", MAX_BYTES);
      if (page.status < 400) break;
    } catch (e) { page = null; }
    // Some sites only answer on the bare domain.
    try {
      base = scheme + domain;
      page = await get(base + "/", MAX_BYTES);
      if (page.status < 400) break;
    } catch { page = null; }
  }
  if (!page) return rec;
  rec.http = page.status;
  if (page.status >= 400) { rec.status = page.status === 403 || page.status === 429 ? "blocked" : "http-" + page.status; return rec; }
  if (!page.body) { rec.status = "not-html"; return rec; }

  const text = textOf(page.body);
  if (text.length < 200) { rec.status = "thin"; }
  else rec.status = "ok";

  for (const [sig, res] of Object.entries(SIGNALS)) {
    for (const re of res) {
      const q = quote(text, re) || quote(page.body.replace(/<[^>]+>/g, " "), re);
      if (!q) continue;
      rec.signals[sig] = true;
      rec.evidence[sig] = sig === "tool" ? (TOOL_NAMES.find(([r]) => r.test(q)) || [, q])[1] : q;
      break;
    }
  }
  // Links to dedicated buying / appraisal pages, with their anchor text.
  const links = [...page.body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)];
  for (const [, href, inner] of links) {
    if (/^mailto:|^tel:/i.test(href) || !PAGE_HREF.test(href)) continue;
    let abs;
    try { abs = new URL(href, page.url).toString(); } catch { continue; }
    const label = clean(inner.replace(/<[^>]+>/g, " ")).slice(0, 60);
    if (!rec.pages.some((p) => p.url === abs)) rec.pages.push({ url: abs, label });
    if (rec.pages.length >= 3) break;
  }
  if (rec.pages.length) rec.signals.page = true;
  rec.lang = /<html[^>]+lang=["']?fr/i.test(page.body) ? "fr" : undefined;
  return rec;
}

/* Other build steps import the signal patterns; only a direct run crawls. */
module.exports = { SIGNALS };
if (require.main === module) (async () => {
  // --only=a.ca,b.com checks just those and prints the result, for testing.
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
  if (only) {
    for (const d of only.split(",")) console.log(JSON.stringify(await research(d), null, 1));
    return;
  }
  const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const domains = [...new Set(raw.map((d) => domainOf(d.w)).filter((d) => d && d.includes(".")))];
  const cache = fs.existsSync(OUT) && !REFRESH ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const todo = domains.filter((d) => !cache[d]);
  console.log(`domains: ${domains.length} | cached: ${domains.length - todo.length} | to check: ${todo.length}`);

  let i = 0, done = 0;
  const t0 = Date.now();
  const save = () => fs.writeFileSync(OUT, JSON.stringify(cache));
  async function worker() {
    while (i < todo.length) {
      const d = todo[i++];
      try { cache[d] = await research(d); }
      catch (e) { cache[d] = { domain: d, checked: new Date().toISOString().slice(0, 10), status: "error", signals: {}, evidence: {}, pages: [] }; }
      done++;
      if (done % 100 === 0 || done === todo.length) {
        save();
        const tally = Object.values(cache).reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
        const mins = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`  ${done}/${todo.length} in ${mins} min | ${JSON.stringify(tally)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();

  const all = Object.values(cache);
  const n = (s) => all.filter((r) => r.signals[s]).length;
  console.log(`\nread ${all.filter((r) => r.status === "ok" || r.status === "thin").length} of ${all.length} sites`);
  console.log(`buys from public: ${n("buys")} | trade appraisal: ${n("trade")} | valuation tool: ${n("tool")} | buying page link: ${n("page")} | used stock: ${n("used")} | CPO: ${n("cpo")}`);
})();
