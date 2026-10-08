#!/usr/bin/env node
/* ============================================================
   listyourcar.ca — dealer profiles for head-to-head comparisons

   Picks the obvious head-to-heads — the two closest stores selling
   the same make in each major metro — and reads both dealers' own
   websites more deeply than build-research.js does: the homepage,
   plus their about page and their hours page. From those it records
   facts a seller (who is usually also a buyer) would weigh:

     where it is      street address, from the site's own structured data
     when it's open   sales hours by day
     who runs it      founding year, family ownership, manufacturer awards,
                      languages spoken
     buying from it   certified pre-owned, free history reports, price
                      policy, credit help, buy online, home delivery,
                      warranty, service extras

   Every fact keeps the page it came from, and most keep the dealer's
   own words, so a comparison can show its working.

     node build-profiles.js              profiles new pair candidates
     node build-profiles.js --refresh    re-reads every candidate
     node build-profiles.js --only=a.ca  reads one site and prints it

   Then run build-dealers.js (merges the facts into the evidence
   files) and build-seo.js (writes the comparison pages).

   Manners match build-research.js: identifies itself, honours
   robots.txt for every path it fetches, a few pages per site, a
   handful of sites at a time, and never records email addresses or
   anything about individual people.

   Output:
     data/.profile-cache.json   raw per-domain profiles (private)
     data/h2h.json              the published pairs (public)
   ============================================================ */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "data");
const OUT = path.join(DIR, ".profile-cache.json");
const PAIRS = path.join(DIR, "h2h.json");
const RESEARCH = path.join(DIR, ".research-cache.json");
const UA = "Mozilla/5.0 (compatible; ListYourCarResearch/1.0; +https://listyourcar.ca/about.html)";
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;
const MAX_BYTES = 900 * 1024;
const MAX_EXTRA_PAGES = 3;
const REFRESH = process.argv.includes("--refresh");
const THIS_YEAR = new Date().getFullYear();

/* ---------- Which head-to-heads ---------- */

/* The metros and makes to start with: the biggest markets, and the
   makes most Canadians drive. One pair per metro and make. */
const START_METROS = ["toronto", "montreal", "vancouver", "ottawa-gatineau", "calgary", "edmonton",
  "quebec-city", "winnipeg", "hamilton", "kitchener-cambridge-waterloo", "london", "halifax"];
const START_MAKES = ["Toyota", "Honda", "Ford", "Hyundai", "Kia", "Mazda", "Nissan", "Chevrolet",
  "Subaru", "Volkswagen", "Jeep", "BMW", "Mercedes-Benz", "Lexus", "Audi"];
/* How many of the closest pairs per metro and make to read, so a
   pair whose site can't be read still leaves a runner-up. */
const CANDIDATES_PER_SLOT = 3;

/* Words that don't make two dealer names "the same business". */
const NAME_NOISE = new Set(("of the de du des la le les et and on in at sales ventes motors motor auto autos automobiles " +
  "automobile automotive group groupe ltd ltee ltée inc limited centre center dealership dealer cars car " +
  "chrysler dodge jeep ram fiat buick gmc cadillac lincoln gm chevrolet chevy mazda honda toyota ford hyundai kia " +
  "nissan subaru volkswagen vw bmw mercedes benz mercedes-benz lexus audi acura infiniti genesis mitsubishi volvo " +
  "porsche jaguar land rover mini north south east west city new used").split(" "));
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nameTokens = (n) => fold(n).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !NAME_NOISE.has(t));
const domainOf = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

/* Two stores are sisters, not rivals, if they share a group or a
   distinctive word in the name: Nissan Gabriel and Nissan Gabriel
   Anjou, or two Jim Pattison stores. */
function sisters(a, b) {
  if (a.group && a.group === b.group) return true;
  // One store under two names answers the same phone.
  const digits = (p) => String(p || "").replace(/\D/g, "").slice(-10);
  if (digits(a.phone) && digits(a.phone) === digits(b.phone)) return true;
  const ta = new Set(nameTokens(a.name));
  return nameTokens(b.name).some((t) => ta.has(t));
}

function candidatePairs() {
  global.window = global.window || {};
  require(path.join(__dirname, "js", "dealers.js"));
  const Net = global.window.DealerNet;
  const { metroOfPosition } = require(path.join(__dirname, "seo-dealer-guides.js"));
  const bundle = JSON.parse(fs.readFileSync(path.join(DIR, "dealers.json"), "utf8"));
  const recs = Net.fromBundle(bundle);
  const perDomain = {};
  recs.forEach((r) => { const d = domainOf(r.website); if (d) perDomain[d] = (perDomain[d] || 0) + 1; });
  // A rival must be a working dealer with its own website: facts read
  // off a site several stores share can't be pinned to one of them.
  // A name that is just a web address ("gorichmondsubaru.ca") can't head a page.
  const ok = recs.filter((r) => r.role === "dealer" && r.website && !r.siteLost && r.brands.length &&
    perDomain[domainOf(r.website)] === 1 && !/\.[a-z]{2,4}$/i.test(r.name.trim()));
  const slots = [];
  for (const metro of START_METROS) {
    const here = ok.filter((r) => metroOfPosition(bundle.positions[r.pos]) === metro);
    for (const make of START_MAKES) {
      const list = here.filter((r) => r.brands.includes(make));
      const pairs = [];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        if (sisters(list[i], list[j])) continue;
        pairs.push({ a: list[i], b: list[j], km: Net.haversine(list[i].lat, list[i].lon, list[j].lat, list[j].lon) });
      }
      pairs.sort((x, y) => x.km - y.km || (y.a.staff + y.b.staff) - (x.a.staff + x.b.staff));
      if (pairs.length) slots.push({ metro, make, pairs: pairs.slice(0, CANDIDATES_PER_SLOT) });
    }
  }
  return slots;
}

/* ---------- Fetching, politely ---------- */

async function get(url, maxBytes = MAX_BYTES) {
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
    try { await reader.cancel(); } catch { /* closed */ }
  }
  return { status: r.status, url: r.url, type, body };
}

/* robots.txt rules that apply to us, as [allow?, prefix] pairs. */
async function robotsFor(origin) {
  try {
    const r = await get(origin + "/robots.txt", 64 * 1024);
    if (r.status >= 400) return [];
    const rules = [];
    let applies = false, inGroup = false;
    for (const raw of r.body.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") {
        if (!inGroup) applies = false;
        applies = applies || v === "*" || /listyourcar/i.test(v);
        inGroup = true;
      } else {
        inGroup = false;
        if (applies && (k === "disallow" || k === "allow") && v) rules.push([k === "allow", v]);
      }
    }
    return rules;
  } catch { return []; }
}
function allowedBy(rules, pathname) {
  let best = null;
  for (const [allow, prefix] of rules) {
    const re = new RegExp("^" + prefix.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(pathname) && (!best || prefix.length > best[1].length || (prefix.length === best[1].length && allow))) best = [allow, prefix];
  }
  return !best || best[0];
}

/* ---------- Reading a page ---------- */

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const ENT = { amp: "&", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: "\"", rdquo: "\"", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ecirc: "ê", ocirc: "ô", ndash: "–", mdash: "—", quot: "\"", apos: "'" };
const decode = (s) => String(s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, k) => ENT[k.toLowerCase()] || m);
function textOf(html) {
  return clean(decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th|\/dt|\/dd)\b[^>]*>/gi, " | ")
    // Quoted attributes can hold ">" (inline handlers do), so skip them whole.
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ")));
}

/* Every JSON-LD block on a page, parsed; broken ones are skipped. */
function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* not valid JSON */ }
  }
  return out;
}
/* Walk JSON-LD for business nodes: AutoDealer, AutomotiveBusiness and kin. */
const BIZ = /^(?:AutoDealer|AutomotiveBusiness|AutoRepair|LocalBusiness|Organization|CarDealer|MotorcycleDealer|Store)$/;
function businesses(node, out = [], depth = 0) {
  if (!node || depth > 6) return out;
  if (Array.isArray(node)) { node.forEach((n) => businesses(n, out, depth + 1)); return out; }
  if (typeof node !== "object") return out;
  const types = [].concat(node["@type"] || []).map(String);
  if (types.some((t) => BIZ.test(t))) out.push(node);
  for (const k of ["@graph", "department", "subOrganization", "mainEntity", "itemListElement"]) if (node[k]) businesses(node[k], out, depth + 1);
  return out;
}

/* ---------- Hours ---------- */

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_ALIASES = [
  ["monday", /^(?:monday|mon|mo|lundi|lun)$/i], ["tuesday", /^(?:tuesday|tues?|tu|mardi|mar)$/i],
  ["wednesday", /^(?:wednesday|wed|we|mercredi|mer)$/i], ["thursday", /^(?:thursday|thu(?:rs?)?|th|jeudi|jeu)$/i],
  ["friday", /^(?:friday|fri|fr|vendredi|ven)$/i], ["saturday", /^(?:saturday|sat|sa|samedi|sam)$/i],
  ["sunday", /^(?:sunday|sun|su|dimanche|dim)$/i],
];
const dayIndex = (s) => {
  const k = String(s || "").replace(/^https?:\/\/schema\.org\//i, "").replace(/[.:]$/, "").trim();
  const hit = DAY_ALIASES.findIndex(([, re]) => re.test(k));
  return hit;
};
/* "9:00am", "9am", "21:00", "9 h 30", "21h" -> minutes after midnight. */
function minutes(t, pmHint) {
  const s = String(t || "").toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  const m = s.match(/^(\d{1,2})(?:[:h](\d{2}))?h?(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (!m[3] && pmHint && h < 12) h += 12;
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}
const sane = (o, c) => o != null && c != null && o >= 5 * 60 && o <= 13 * 60 && c >= 12 * 60 && c <= 24 * 60 && c > o;

/* From schema.org openingHoursSpecification / openingHours. */
function hoursFromLd(biz) {
  const week = Array(7).fill(undefined);
  const spec = [].concat(biz.openingHoursSpecification || []);
  for (const s of spec) {
    if (!s || typeof s !== "object") continue;
    const o = minutes(String(s.opens || "").slice(0, 5)), c = minutes(String(s.closes || "").slice(0, 5));
    for (const d of [].concat(s.dayOfWeek || [])) {
      const i = dayIndex(d);
      if (i < 0) continue;
      if (o != null && c != null && o === c) week[i] = null;          // 00:00–00:00 is how some sites say closed
      else if (sane(o, c)) week[i] = [o, c];
    }
  }
  for (const line of [].concat(biz.openingHours || [])) {
    // "Mo-Fr 09:00-21:00" or "Sa 09:00-18:00"
    const m = String(line).match(/^([A-Za-z]{2})(?:\s*-\s*([A-Za-z]{2}))?\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const a = dayIndex(m[1]), b = m[2] ? dayIndex(m[2]) : a;
    const o = minutes(m[3]), c = minutes(m[4]);
    if (a < 0 || b < 0 || !sane(o, c)) continue;
    for (let i = a; i <= b; i++) week[i] = [o, c];
  }
  const known = week.filter((x) => x !== undefined).length;
  if (known < 5) return null;
  // A day the site leaves out of an otherwise full week is a closed day.
  return week.map((x) => (x === undefined ? null : x));
}

/* From visible text: "Monday 9:00am - 9:00pm Tuesday ... Sunday Closed". Takes
   the first full week after a "Sales" / "Ventes" label if there is one, so a
   store listing several departments gives its showroom hours. */
const TIME = "(\\d{1,2}(?:[:h]\\s?\\d{2})?\\s*(?:[ap]\\.?m\\.?)?\\s*h?)";
const DAY_WORD = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)";
const ENTRY = new RegExp(DAY_WORD + "\\.?\\s*:?\\s*(?:\\|\\s*)?(?:(closed|fermé|ferme)|" + TIME + "\\s*(?:-|–|—|to|à|a)\\s*" + TIME + ")", "gi");
function hoursFromText(text) {
  const starts = [];
  const lab = /\b(?:sales|ventes|showroom|salle de montre)\b/gi;
  let m;
  while ((m = lab.exec(text)) && starts.length < 6) starts.push(m.index);
  starts.push(0);
  for (const at of starts) {
    const chunk = text.slice(at, at + 700);
    const week = Array(7).fill(undefined);
    let seen = 0, lastIdx = -1, ok = true;
    ENTRY.lastIndex = 0;
    let e;
    while ((e = ENTRY.exec(chunk))) {
      const i = dayIndex(e[1]);
      if (i < 0) continue;
      if (i <= lastIdx) break;                 // the next department's week begins
      lastIdx = i;
      if (e[2]) week[i] = null;
      else {
        const pmClose = !/[ap]\.?m/i.test(e[4]) && !/h/i.test(e[4]);
        const o = minutes(e[3]), c = minutes(e[4], pmClose && +e[4].match(/\d+/)[0] < 12);
        if (!sane(o, c)) { ok = false; break; }
        week[i] = [o, c];
      }
      seen++;
    }
    if (ok && seen >= 6) return week.map((x) => (x === undefined ? null : x));
  }
  return null;
}

/* ---------- Facts in the dealer's own words ---------- */

/* A short quote around a match, whole words, no email addresses. */
function quoteAt(text, idx, len, before = 50, after = 60) {
  // Stay inside the block the match sits in: textOf marks block ends with " | ".
  const blockStart = text.lastIndexOf(" | ", idx);
  const blockEnd = text.indexOf(" | ", idx + len);
  const a = Math.max(0, idx - before, blockStart < 0 ? 0 : blockStart + 3);
  const b = Math.min(text.length, idx + len + after, blockEnd < 0 ? text.length : blockEnd);
  let q = text.slice(a, b);
  if (a > 0 && a !== blockStart + 3) q = q.replace(/^\S*\s/, "");
  if (b < text.length && b !== blockEnd) q = q.replace(/\s\S*$/, "");
  if (/@/.test(q)) return "";
  // Anything that reads like code rather than prose: keep only the phrase itself.
  if (/[{}<>\\]|=>|\(\)|":|getAttribute|function\b/.test(q)) q = text.substr(idx, len);
  return clean(q).slice(0, 160);
}

/* Founding year. Only phrasings about the business itself: "serving
   ... since 1973", "established in 1985", "depuis 1962". A customer
   testimonial ("I've bought cars here since 1978") never matches, and
   a sentence about the manufacturer ("Toyota, in Canada since 1964")
   is rejected. */
const FOUNDED = [
  /\b(?:established|founded|opened (?:its|our) doors|in business|incorporated)\s+(?:in|since)\s+((?:18|19|20)\d\d)\b/i,
  /\b(?:serving|served|proudly serving|been serving|family[- ]owned|family[- ]operated|owned and operated)\b[^.|!?]{0,70}?\bsince\s+((?:18|19|20)\d\d)\b/i,
  /\bsince\s+((?:18|19|20)\d\d)\b[^.|!?]{0,40}?\b(?:serving|family[- ]owned|in business)\b/i,
  /\best\.?\s+((?:18|19|20)\d\d)\b/,
  /\b(?:fondée?|établie?|en affaires)\s+(?:en|depuis)\s+((?:18|19|20)\d\d)\b/i,
  /\b(?:au service|servons|sert)\b[^.|!?]{0,70}?\bdepuis\s+((?:18|19|20)\d\d)\b/i,
  /\b(?:entreprise familiale|famille)\b[^.|!?]{0,70}?\bdepuis\s+((?:18|19|20)\d\d)\b/i,
];
const MAKERS = /\b(?:toyota|honda|ford|hyundai|kia|mazda|nissan|chevrolet|gm|general motors|subaru|volkswagen|jeep|chrysler|stellantis|bmw|mercedes|lexus|audi|acura|infiniti)\b/i;
function founded(text, dealerName) {
  const own = nameTokens(dealerName);
  for (const re of FOUNDED) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = g.exec(text))) {
      const year = +m[1];
      if (year < 1880 || year >= THIS_YEAR) continue;
      const q = quoteAt(text, m.index, m[0].length, 70, 30);
      const lead = text.slice(Math.max(0, m.index - 70), m.index + m[0].length);
      if (/\b(?:I|I've|I have|my|me|we've been customers|customer)\b/.test(lead)) continue;
      // About the maker, not this store?
      if (MAKERS.test(lead) && !/\b(?:we|our|us|nous|notre|dealership|concession|famil)/i.test(lead) &&
          !own.some((t) => fold(lead).replace(/[^a-z0-9]/g, "").includes(t))) continue;
      return { v: year, q };
    }
  }
  return null;
}

const FAMILY = /\b(?:family[- ]owned|family[- ]run|family[- ]operated|family business|entreprise familiale|propriété familiale)\b/i;

/* Recognition from the manufacturer or an outside body. */
const AWARDS = [
  /\bPresident'?s (?:Award|Club|Circle)\b(?: (?:winner|recipient))?/i,
  /\b(?:Toyota|Lexus|Honda|Acura|Ford|Hyundai|Kia|Mazda|Nissan|Subaru|Volkswagen|GM|BMW|Mercedes-Benz|Audi)\b[^.|]{0,30}\b(?:Award of Excellence|Dealer of Excellence|Excellence Award)\b/i,
  /\bOrder of Excellence\b/i, /\bCouncil of Excellence\b/i, /\bMark of Excellence\b/i,
  /\bElite of Lexus\b/i, /\bWolfsburg Crest(?: Club)?\b/i, /\bStellar Care\b/i, /\bPlatinum Club\b/i,
  /\bCanada'?s Best Managed Compan(?:y|ies)\b/i, /\bConsumer Choice Award\b/i,
  /\bDealerRater[^.|]{0,40}?(?:Dealer of the Year|Consumer Satisfaction Award)\b/i,
  /\bReaders'? Choice\b[^.|]{0,40}/i, /\bTop Choice Award\b/i,
  /\bPrix (?:du président|d'excellence)\b/i,
];
/* Languages, only from a sentence that says the team speaks them. */
const LANG_LEAD = /\b(?:we speak|languages? spoken|our (?:team|staff) speaks?|we can serve you in|service (?:available )?in|nous parlons|on parle|langues? parlées?)\b/i;
const LANGS = ["English", "French", "Mandarin", "Cantonese", "Punjabi", "Hindi", "Urdu", "Tamil", "Tagalog", "Arabic",
  "Farsi", "Persian", "Spanish", "Portuguese", "Italian", "Korean", "Vietnamese", "Russian", "Ukrainian", "Polish",
  "German", "Gujarati", "Greek", "Japanese", "Bengali", "Turkish", "Romanian", "Hungarian", "Serbian", "Croatian",
  "Anglais", "Français", "Espagnol", "Arabe", "Italien", "Portugais"];
const LANG_EN = { Anglais: "English", "Français": "French", Espagnol: "Spanish", Arabe: "Arabic", Italien: "Italian", Portugais: "Portuguese" };

/* What a buyer might want, as the site says it. Each is a mention on
   the dealer's own site, shown as such — not a guarantee. Patterns are
   deliberately specific: "collision" alone would match a safety-system
   feature list, so only a collision centre or body shop counts. */
const OFFERS = {
  cpo:      /\b(?:certified pre-?owned|véhicules? d'occasion certifiés?|certifiés?\s+(?:toyota|honda|ford|hyundai|kia|mazda|nissan|subaru|vw|volkswagen))\b/i,
  history:  /\b(?:free (?:CARFAX|Carproof|vehicle history)|CARFAX (?:report )?(?:included|provided|available) (?:on|with|for) (?:every|all)|every (?:used )?vehicle comes with a (?:free )?CARFAX|rapport CARFAX (?:gratuit|inclus))\b/i,
  price:    /\b(?:no[- ]haggle|one[- ]price|haggle[- ]free|market[- ]value pricing|transparent pricing|upfront pricing|prix (?:fixe|transparent|sans négociation))\b/i,
  credit:   /\b(?:all credit (?:types|situations|levels|welcome)|bad credit|credit rebuild(?:ing)?|no credit|second chance (?:financing|credit)|mauvais crédit|crédit difficile|tous (?:les )?(?:types de |dossiers de )?crédit)\b/i,
  online:   /\b(?:buy (?:your (?:next )?(?:car|vehicle) )?online|shop (?:and buy )?(?:online|from home)|(?:complete|start) your purchase online|achat en ligne|achetez en ligne|online (?:purchase|buying|reservation))\b/i,
  delivery: /\b(?:home delivery|free delivery|deliver (?:it|your (?:vehicle|car)) (?:right )?to your (?:home|door)|at[- ]home test drives?|test drive at home|livraison à domicile|essai routier à domicile)\b/i,
  warranty: /\b(?:lifetime (?:powertrain |engine )?warranty|extended warranty|warranty for life|garantie (?:prolongée|à vie))\b/i,
  collision:/\b(?:collision (?:centre|center|repair centre|repair center)|body shop|auto body|carrosserie)\b/i,
  shuttle:  /\b(?:shuttle service|courtesy shuttle|navette)\b/i,
  loaner:   /\b(?:loaner (?:car|vehicle)s?|courtesy (?:car|vehicle)s?|véhicules? de courtoisie)\b/i,
  wash:     /\b(?:free car wash|complimentary (?:car )?wash|car wash|lave-auto)\b/i,
  tires:    /\b(?:tire storage|tyre storage|tire hotel|entreposage de pneus|hôtel à pneus)\b/i,
  express:  /\b(?:express service|quick lane|service express|no appointment (?:necessary|needed|required)|sans rendez-vous)\b/i,
  commercial:/\b(?:commercial (?:vehicle|truck) (?:centre|center|department|sales)|fleet (?:sales|department)|business elite|véhicules commerciaux|centre commercial (?:ford|ram))\b/i,
  evening:  null,   // derived from hours
};

/* Pages worth a second look, by link text or address. */
/* In order of preference: the first that matches a link wins its slot. */
const ABOUT_LINKS = [/(?:about|a-propos|qui-sommes|our-story|notre-histoire|history|histoire)/i,
  /(?:why-(?:buy|choose|us)|pourquoi)/i, /(?:our-dealership|notre-concession|meet-our-team|equipe)/i];
const HOURS_LINKS = [/(?:hours|heures)/i, /(?:location|directions|itineraire)/i, /(?:contact|nous-joindre|joindre|coordonnees)/i];
const SKIP_LINK = /(?:inventory|inventaire|\.pdf|\.jpg|\.png|mailto:|tel:|javascript:|facebook|instagram|twitter|youtube|google|linkedin|tiktok|privacy|confidential|terms|careers|emplois|blog|news|nouvelles|specials|promotions|credit-app|finance-app)/i;

async function profile(domain, dealerName, hint) {
  const rec = { domain, checked: new Date().toISOString().slice(0, 10), status: "error", pages: [] };
  const hosts = [...new Set([hint, "www." + domain, domain].filter(Boolean))];
  let home = null, origin = null, rules = [];
  for (const scheme of ["https://", "http://"]) {
    for (const h of hosts) {
      origin = scheme + h;
      try {
        rules = await robotsFor(origin);
        if (!allowedBy(rules, "/")) { rec.status = "robots"; return rec; }
        home = await get(origin + "/");
        if (home.status < 400 && home.body) break;
      } catch { home = null; }
    }
    if (home && home.status < 400 && home.body) break;
  }
  if (!home || home.status >= 400 || !home.body) { rec.status = home ? "http-" + home.status : "error"; return rec; }
  try { origin = new URL(home.url).origin; } catch { /* keep */ }

  const pages = [{ url: home.url, html: home.body }];
  // Pick an about page and an hours page, then anything else useful, up to the cap.
  const links = [];
  for (const [, href, inner] of home.body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    if (SKIP_LINK.test(href)) continue;
    let u;
    try { u = new URL(decode(href), home.url); } catch { continue; }
    if (u.origin !== new URL(home.url).origin || u.pathname === "/" || u.search) continue;
    const label = clean(inner.replace(/<[^>]+>/g, " "));
    links.push({ url: u.origin + u.pathname, path: u.pathname, label });
  }
  const pick = [];
  const hitFor = (re) => links.find((l) => (re.test(l.path) || re.test(fold(l.label).replace(/\s+/g, "-"))) && !pick.includes(l.url));
  const want = (list) => {
    for (const re of list) { const hit = hitFor(re); if (hit) { pick.push(hit.url); return; } }
  };
  want(ABOUT_LINKS); want(HOURS_LINKS); want(ABOUT_LINKS.slice(1));
  for (const u of pick.slice(0, MAX_EXTRA_PAGES)) {
    if (!allowedBy(rules, new URL(u).pathname)) continue;
    try {
      const p = await get(u);
      if (p.status < 400 && p.body) pages.push({ url: p.url, html: p.body });
    } catch { /* skip that page */ }
  }
  rec.pages = pages.map((p) => p.url);
  rec.status = "ok";

  /* Structured data first: it is the dealer's own statement of where
     and when, made for machines, and the least ambiguous source. */
  const bizs = pages.flatMap((p) => jsonLd(p.html).flatMap((j) => businesses(j)));
  const withAddr = bizs.find((b) => b.address && (b.address.streetAddress || (b.address[0] && b.address[0].streetAddress)));
  if (withAddr) {
    const a = Array.isArray(withAddr.address) ? withAddr.address[0] : withAddr.address;
    let region = clean(a.addressRegion), postal = clean(a.postalCode);
    const tucked = region.match(/^([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i);   // "ON M4A 1J6" in the region field
    if (tucked) { region = tucked[1]; postal = postal || tucked[2]; }
    const PROV = { QU: "QC", QUE: "QC", QUEBEC: "QC", ONTARIO: "ON", ONT: "ON", ALBERTA: "AB", ALTA: "AB",
      "BRITISH COLUMBIA": "BC", MANITOBA: "MB", SASKATCHEWAN: "SK", "NOVA SCOTIA": "NS", "NEW BRUNSWICK": "NB",
      "NEWFOUNDLAND AND LABRADOR": "NL", "PRINCE EDWARD ISLAND": "PE" };
    const r = fold(region).toUpperCase().replace(/\./g, "").trim();
    rec.address = { street: clean(decode(a.streetAddress)), city: clean(decode(a.addressLocality)),
      region: PROV[r] || r.slice(0, 2), postal: postal.toUpperCase().replace(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/, "$1 $2") };
    const geo = withAddr.geo || {};
    if (geo.latitude && geo.longitude) rec.geo = [+geo.latitude, +geo.longitude];
  }
  // Sales hours: a department named Sales, else the business, else any.
  const salesDept = bizs.find((b) => /\b(?:sales|ventes)\b/i.test(String(b.name || "")) && (b.openingHoursSpecification || b.openingHours));
  const anyHours = bizs.find((b) => b.openingHoursSpecification || b.openingHours);
  rec.hours = (salesDept && hoursFromLd(salesDept)) || (anyHours && hoursFromLd(anyHours)) || null;
  rec.hoursFrom = rec.hours ? "data" : "";
  const texts = pages.map((p) => textOf(p.html));
  if (!rec.hours) {
    for (let i = 0; i < texts.length && !rec.hours; i++) {
      const h = hoursFromText(texts[i]);
      if (h) { rec.hours = h; rec.hoursFrom = "text"; rec.hoursPage = i; }
    }
  }
  const foundingLd = bizs.map((b) => String(b.foundingDate || "").match(/^(18|19|20)\d\d/)).find(Boolean);

  /* Then the words on the pages, each fact tied to the page it was on. */
  const facts = { offers: {} };
  texts.forEach((t, i) => {
    if (!facts.founded) {
      const f = founded(t, dealerName);
      if (f) facts.founded = { ...f, s: i };
    }
    if (!facts.family) {
      const m = FAMILY.exec(t);
      if (m) facts.family = { q: quoteAt(t, m.index, m[0].length), s: i };
    }
    for (const [k, re] of Object.entries(OFFERS)) {
      if (!re || facts.offers[k]) continue;
      const m = re.exec(t);
      if (m) facts.offers[k] = { q: quoteAt(t, m.index, m[0].length, 40, 50), s: i };
    }
    for (const re of AWARDS) {
      const m = re.exec(t);
      if (!m) continue;
      facts.awards = facts.awards || [];
      const q = quoteAt(t, m.index, m[0].length, 50, 50);
      if (q && !facts.awards.some((a) => a.q === q) && facts.awards.length < 4) facts.awards.push({ name: clean(m[0]), q, s: i });
    }
    if (!facts.langs) {
      const m = LANG_LEAD.exec(t);
      if (m) {
        const win = t.slice(m.index, m.index + 200);
        const found = [...new Set(LANGS.filter((l) => new RegExp("\\b" + l + "\\b", "i").test(win)).map((l) => LANG_EN[l] || l))];
        if (found.length >= 2 || (found.length === 1 && found[0] !== "English")) facts.langs = { v: found, q: quoteAt(t, m.index, m[0].length, 10, 120), s: i };
      }
    }
  });
  if (!facts.founded && foundingLd) facts.founded = { v: +foundingLd[0].slice(0, 4), q: "", s: 0, ld: true };
  Object.assign(rec, facts);
  rec.lang = /<html[^>]+lang=["']?fr/i.test(home.body) ? "fr" : undefined;
  return rec;
}

/* ---------- Run ---------- */
module.exports = { candidatePairs, profile, sisters };
if (require.main === module) (async () => {
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
  if (only) {
    for (const d of only.split(",")) console.log(JSON.stringify(await profile(d, d.split(".")[0], ""), null, 1));
    return;
  }
  const research = fs.existsSync(RESEARCH) ? JSON.parse(fs.readFileSync(RESEARCH, "utf8")) : {};
  const slots = candidatePairs();
  const wanted = new Map();
  slots.forEach((s) => s.pairs.forEach((p) => [p.a, p.b].forEach((d) => wanted.set(domainOf(d.website), d.name))));
  const cache = fs.existsSync(OUT) && !REFRESH ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const todo = [...wanted.keys()].filter((d) => !cache[d]);
  console.log(`slots: ${slots.length} | dealers in candidate pairs: ${wanted.size} | cached: ${wanted.size - todo.length} | to read: ${todo.length}`);

  let i = 0, done = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(cache));
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < todo.length) {
      const d = todo[i++];
      const hint = research[d] && research[d].finalHost ? (research[d].finalHost.includes(".") && research[d].finalHost !== d ? "www." + research[d].finalHost.replace(/^www\./, "") : "") : "";
      try { cache[d] = await profile(d, wanted.get(d), hint); }
      catch { cache[d] = { domain: d, checked: new Date().toISOString().slice(0, 10), status: "error", pages: [] }; }
      if (++done % 20 === 0 || done === todo.length) { save(); console.log(`  ${done}/${todo.length}`); }
    }
  }));
  save();

  /* A pair is published when both sites were read and each says
     enough to compare: at least its hours or one other fact beyond
     what the network already knows. */
  const rich = (d) => {
    const r = cache[domainOf(d.website)];
    if (!r || r.status !== "ok") return false;
    // Its own site puts it somewhere else entirely: our record is wrong, so leave it out.
    if (r.geo && r.address && r.address.postal && String(d.postal).replace(/\s/g, "").slice(0, 3) !== r.address.postal.replace(/\s/g, "").slice(0, 3) &&
        global.window.DealerNet.haversine(r.geo[0], r.geo[1], d.lat, d.lon) > 25) return false;
    const n = (r.hours ? 1 : 0) + (r.address ? 1 : 0) + (r.founded ? 1 : 0) + (r.family ? 1 : 0) +
      (r.awards ? 1 : 0) + Object.keys(r.offers || {}).length;
    return n >= 2;
  };
  const published = [];
  for (const s of slots) {
    // Two names at one street address are one store, not rivals.
    const street = (d) => {
      const r = cache[domainOf(d.website)];
      return r && r.address ? fold(r.address.street).replace(/[^a-z0-9]/g, "") : "";
    };
    const p = s.pairs.find((x) => rich(x.a) && rich(x.b) && !(street(x.a) && street(x.a) === street(x.b)));
    if (!p) continue;
    published.push({ metro: s.metro, make: s.make, a: domainOf(p.a.website), b: domainOf(p.b.website) });
  }
  fs.writeFileSync(PAIRS, JSON.stringify({ built: new Date().toISOString().slice(0, 10), pairs: published }, null, 1));
  const all = Object.values(cache);
  const has = (k) => all.filter((r) => r[k]).length;
  console.log(`\nread ${all.filter((r) => r.status === "ok").length} of ${all.length} sites`);
  console.log(`address ${has("address")} · hours ${has("hours")} · founded ${has("founded")} · family ${has("family")} · awards ${has("awards")} · languages ${has("langs")}`);
  console.log(`pairs published: ${published.length} of ${slots.length} slots -> data/h2h.json`);
})();
