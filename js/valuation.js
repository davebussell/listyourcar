/* ============================================================
   listyourcar.ca — SMART ESTIMATE
   The valuation engine behind "what will my car actually get?"

   Deterministic, explainable, and offline: every dollar the user
   sees can be traced to a factor we show them. That matters more
   than a black box here — sellers only list if they trust the
   number, and dealers only bid if it isn't fantasy.

   The model:
     value = base × depreciation(age) × mileage × condition
             × demand(body) × season(month)

   then split into the three numbers that actually drive the
   decision: the trade-in lowball, the competitive-bid range,
   and the private-sale ceiling.

   NOTE ON A REAL LLM: to layer a model-written narrative on top,
   call it from a SERVER-SIDE endpoint (e.g. a Netlify function
   reading ANTHROPIC_API_KEY from env) and pass the factors below
   as context. Never put an API key in this file — it ships to
   every visitor's browser. See estimateNarrativeHook() at the end.
   ============================================================ */

/* ---------- Reference values ----------
   Approximate Canadian new-vehicle transaction prices (CAD) for
   the trims people actually buy, plus the body type that drives
   demand. Used as the depreciation starting point. */
const VAL_BASE = {
  // ── Mainstream ──
  "toyota|corolla": [27000, "sedan"],      "toyota|camry": [34000, "sedan"],
  "toyota|rav4": [36000, "suv"],           "toyota|tacoma": [45000, "truck"],
  "toyota|tundra": [58000, "truck"],       "toyota|highlander": [48000, "suv"],
  "toyota|sienna": [45000, "minivan"],     "toyota|prius": [33000, "hybrid"],
  "toyota|4runner": [52000, "suv"],        "toyota|venza": [42000, "suv"],
  "honda|civic": [28000, "sedan"],         "honda|accord": [35000, "sedan"],
  "honda|cr-v": [36000, "suv"],            "honda|crv": [36000, "suv"],
  "honda|pilot": [50000, "suv"],           "honda|odyssey": [46000, "minivan"],
  "honda|hr-v": [30000, "suv"],            "honda|ridgeline": [48000, "truck"],
  "mazda|3": [26000, "sedan"],             "mazda|mazda3": [26000, "sedan"],
  "mazda|cx-5": [34000, "suv"],            "mazda|cx-30": [30000, "suv"],
  "mazda|cx-9": [45000, "suv"],            "mazda|cx-50": [38000, "suv"],
  "mazda|mx-5": [37000, "convertible"],
  "nissan|rogue": [33000, "suv"],          "nissan|sentra": [24000, "sedan"],
  "nissan|altima": [30000, "sedan"],       "nissan|frontier": [40000, "truck"],
  "nissan|murano": [42000, "suv"],         "nissan|kicks": [24000, "suv"],
  "hyundai|elantra": [24000, "sedan"],     "hyundai|tucson": [33000, "suv"],
  "hyundai|santa fe": [40000, "suv"],      "hyundai|kona": [28000, "suv"],
  "hyundai|palisade": [50000, "suv"],      "hyundai|venue": [22000, "suv"],
  "kia|forte": [23000, "sedan"],           "kia|sportage": [32000, "suv"],
  "kia|sorento": [42000, "suv"],           "kia|telluride": [50000, "suv"],
  "kia|soul": [24000, "hatch"],            "kia|seltos": [28000, "suv"],
  "subaru|outback": [36000, "suv"],        "subaru|forester": [33000, "suv"],
  "subaru|crosstrek": [30000, "suv"],      "subaru|impreza": [26000, "sedan"],
  "subaru|wrx": [35000, "sedan"],          "subaru|ascent": [45000, "suv"],
  "volkswagen|golf": [28000, "hatch"],     "volkswagen|jetta": [26000, "sedan"],
  "volkswagen|tiguan": [34000, "suv"],     "volkswagen|atlas": [45000, "suv"],
  "volkswagen|passat": [30000, "sedan"],
  "ford|f-150": [50000, "truck"],          "ford|f150": [50000, "truck"],
  "ford|escape": [33000, "suv"],           "ford|explorer": [45000, "suv"],
  "ford|bronco": [48000, "suv"],           "ford|ranger": [40000, "truck"],
  "ford|mustang": [42000, "coupe"],        "ford|edge": [40000, "suv"],
  "ford|maverick": [32000, "truck"],       "ford|f-250": [62000, "truck"],
  "chevrolet|silverado": [50000, "truck"], "chevrolet|equinox": [32000, "suv"],
  "chevrolet|traverse": [45000, "suv"],    "chevrolet|colorado": [42000, "truck"],
  "chevrolet|camaro": [40000, "coupe"],    "chevrolet|corvette": [90000, "sports"],
  "chevrolet|tahoe": [68000, "suv"],       "chevrolet|malibu": [28000, "sedan"],
  "gmc|sierra": [52000, "truck"],          "gmc|terrain": [34000, "suv"],
  "gmc|yukon": [70000, "suv"],             "gmc|acadia": [42000, "suv"],
  "ram|1500": [52000, "truck"],            "ram|2500": [64000, "truck"],
  "jeep|wrangler": [45000, "suv"],         "jeep|grand cherokee": [48000, "suv"],
  "jeep|cherokee": [38000, "suv"],         "jeep|compass": [32000, "suv"],
  "jeep|gladiator": [50000, "truck"],
  "dodge|charger": [42000, "sedan"],       "dodge|challenger": [42000, "coupe"],
  "dodge|grand caravan": [38000, "minivan"],"dodge|durango": [48000, "suv"],
  "chrysler|pacifica": [45000, "minivan"],
  "mitsubishi|rvr": [26000, "suv"],        "mitsubishi|outlander": [34000, "suv"],
  "buick|encore": [30000, "suv"],          "buick|enclave": [48000, "suv"],
  // ── Premium ──
  "bmw|3 series": [55000, "sedan"],        "bmw|5 series": [70000, "sedan"],
  "bmw|x3": [55000, "suv"],                "bmw|x5": [75000, "suv"],
  "bmw|x1": [45000, "suv"],                "bmw|4 series": [60000, "coupe"],
  "mercedes-benz|c-class": [55000, "sedan"],"mercedes-benz|e-class": [72000, "sedan"],
  "mercedes-benz|glc": [58000, "suv"],     "mercedes-benz|gle": [78000, "suv"],
  "mercedes-benz|gla": [45000, "suv"],     "mercedes-benz|s-class": [125000, "sedan"],
  "audi|a4": [52000, "sedan"],             "audi|q5": [55000, "suv"],
  "audi|q7": [75000, "suv"],               "audi|a3": [42000, "sedan"],
  "audi|q3": [45000, "suv"],
  "lexus|rx": [65000, "suv"],              "lexus|nx": [50000, "suv"],
  "lexus|es": [52000, "sedan"],            "lexus|gx": [75000, "suv"],
  "lexus|is": [48000, "sedan"],
  "acura|mdx": [60000, "suv"],             "acura|rdx": [48000, "suv"],
  "acura|tlx": [45000, "sedan"],           "acura|integra": [38000, "sedan"],
  "infiniti|qx60": [55000, "suv"],         "infiniti|qx50": [48000, "suv"],
  "volvo|xc60": [55000, "suv"],            "volvo|xc90": [70000, "suv"],
  "volvo|xc40": [45000, "suv"],
  "porsche|911": [130000, "sports"],       "porsche|cayenne": [90000, "suv"],
  "porsche|macan": [65000, "suv"],         "porsche|718": [80000, "sports"],
  "land rover|range rover": [140000, "suv"],"land rover|discovery": [75000, "suv"],
  "land rover|defender": [78000, "suv"],
  "genesis|g70": [52000, "sedan"],         "genesis|gv70": [58000, "suv"],
  "jaguar|f-pace": [65000, "suv"],         "cadillac|escalade": [95000, "suv"],
  "cadillac|xt5": [52000, "suv"],          "lincoln|navigator": [95000, "suv"],
  // ── Electric ──
  "tesla|model 3": [55000, "ev"],          "tesla|model y": [65000, "ev"],
  "tesla|model s": [110000, "ev"],         "tesla|model x": [120000, "ev"],
  "chevrolet|bolt": [40000, "ev"],         "nissan|leaf": [40000, "ev"],
  "ford|mustang mach-e": [55000, "ev"],    "hyundai|ioniq 5": [55000, "ev"],
  "kia|ev6": [55000, "ev"],                "volkswagen|id.4": [50000, "ev"],
  "polestar|2": [58000, "ev"],             "rivian|r1t": [95000, "ev"],
};

/* Typical new price by body style, market-wide. Paired with the
   make tier below so an unlisted Ford Focus prices like a compact
   hatch rather than like the F-150 that drags Ford's average up. */
const VAL_BODY_BASE = {
  hatch: 22000, sedan: 30000, coupe: 40000, convertible: 42000,
  sports: 75000, suv: 40000, truck: 50000, minivan: 45000,
  ev: 55000, hybrid: 35000,
};
const MARKET_AVG_NEW = 38000;

/* Fallback new-price by make when the model isn't in the table.
   Keeps unknown-model estimates in a sane band instead of guessing. */
const VAL_MAKE_TIER = {
  toyota: 36000, honda: 36000, mazda: 32000, nissan: 32000, hyundai: 32000,
  kia: 32000, subaru: 34000, volkswagen: 34000, ford: 42000, chevrolet: 42000,
  gmc: 46000, ram: 50000, jeep: 42000, dodge: 42000, chrysler: 40000,
  mitsubishi: 30000, buick: 38000, fiat: 26000, "mini": 38000,
  bmw: 60000, "mercedes-benz": 65000, mercedes: 65000, audi: 55000,
  lexus: 58000, acura: 50000, infiniti: 52000, volvo: 58000, genesis: 55000,
  cadillac: 60000, lincoln: 60000, jaguar: 65000, "land rover": 85000,
  porsche: 95000, tesla: 65000, polestar: 58000, rivian: 90000, lucid: 110000,
  maserati: 110000, bentley: 250000, ferrari: 350000, lamborghini: 350000,
  "aston martin": 220000, "rolls-royce": 450000, mclaren: 300000,
};

/* Demand multipliers — how the Canadian used market treats each
   body style once the car is a few years old. */
const VAL_DEMAND = {
  truck: 1.10, suv: 1.06, hybrid: 1.04, sports: 1.02, coupe: 1.00,
  minivan: 0.98, convertible: 0.97, sedan: 0.96, hatch: 0.95, ev: 0.90,
};

const VAL_CONDITION = {
  excellent: 1.08, good: 1.00, fair: 0.88, "needs-work": 0.70,
};

/* Brand retention — the single biggest thing buyers under-price.
   A ten-year-old Toyota and a ten-year-old Land Rover do not sit
   on the same depreciation curve, and pretending they do produces
   estimates nobody believes. */
const VAL_RETENTION = {
  toyota: 1.10, honda: 1.10, lexus: 1.10, subaru: 1.09,
  mazda: 1.05, acura: 1.04, porsche: 1.08, ram: 1.04, gmc: 1.02,
  ford: 1.00, chevrolet: 1.00, hyundai: 1.00, kia: 1.00,
  nissan: 0.98, volkswagen: 0.97, jeep: 1.02, dodge: 0.98,
  chrysler: 0.94, mitsubishi: 0.94, buick: 0.95, fiat: 0.86,
  bmw: 0.90, "mercedes-benz": 0.89, mercedes: 0.89, audi: 0.90,
  infiniti: 0.92, volvo: 0.91, cadillac: 0.90, lincoln: 0.90,
  jaguar: 0.82, "land rover": 0.84, maserati: 0.78, alfa: 0.80,
  tesla: 0.94, polestar: 0.86, genesis: 0.92,
};

const KM_PER_YEAR = 18000; // Canadian average annual distance

/* New-vehicle sticker understates what people actually pay.
   Depreciation runs off the transaction price — freight, PDI,
   admin and tax-in delivery — so lift the table before curving. */
const TRANSACTION_UPLIFT = 1.10;

/* ---------- Core model ---------- */
function estimateValue(input) {
  const make = String(input.make || "").toLowerCase().trim();
  const model = String(input.model || "").toLowerCase().trim();
  const year = Number(input.year) || new Date().getFullYear();
  const km = input.mileage == null || input.mileage === "" ? null : Number(input.mileage);
  const condition = input.condition || "good";
  const now = new Date();
  const age = Math.max(0, now.getFullYear() - year);
  const factors = [];

  /* 1. Base — exact model, else make tier, else market median */
  let base, body, matched;
  const key = `${make}|${model}`;
  if (VAL_BASE[key]) {
    [base, body] = VAL_BASE[key]; matched = "model";
  } else {
    // try a loose model match within the same make (e.g. "f-150 xlt")
    const loose = Object.keys(VAL_BASE).find((k) => {
      if (!k.startsWith(make + "|")) return false;
      const m = k.split("|")[1];
      return model.includes(m) || m.includes(model);
    });
    if (loose && model) {
      [base, body] = VAL_BASE[loose]; matched = "model";
    } else {
      // Price the segment, then scale it by where the make sits
      // relative to the market — not the make's raw average.
      body = guessBody(model);
      const bodyBase = VAL_BODY_BASE[body] || MARKET_AVG_NEW;
      if (VAL_MAKE_TIER[make]) {
        base = bodyBase * (VAL_MAKE_TIER[make] / MARKET_AVG_NEW);
        matched = "make";
      } else {
        base = bodyBase; matched = "segment";
      }
    }
  }
  base = base * TRANSACTION_UPLIFT;
  factors.push({
    label: matched === "model" ? "Comparable when new" : matched === "make" ? `${titleish(make)} segment average` : "Market segment average",
    detail: fmtCad(base) + " delivered",
    weight: "base",
  });

  /* 2. Depreciation — steep first year, then compounding decline
     that flattens with age. Calibrated against observed Canadian
     retention, which has run high since 2021. */
  let retained;
  if (age <= 0) retained = 1.0;
  else retained = 0.85 * Math.pow(0.925, age - 1);
  const isClassic = age >= 25;
  const floor = isClassic ? 0.14 : 0.08;
  retained = Math.max(floor, retained);
  factors.push({
    label: `${age} ${age === 1 ? "year" : "years"} old`,
    detail: age === 0 ? "New — no depreciation applied" : `${Math.round(retained * 100)}% of value retained`,
    weight: pct(retained - 1),
  });

  /* 3. Mileage vs what's expected for the age */
  let kmAdj = 1.0, kmNote = "Not provided — estimate assumes average distance";
  if (km != null && km >= 0) {
    const expected = Math.max(KM_PER_YEAR, age * KM_PER_YEAR);
    const delta = (km - expected) / expected;
    // Buyers punish high distance harder than they reward low, and a
    // 0.15 coefficient under-priced genuinely worn-out examples.
    kmAdj = clamp(1 - delta * 0.22, 0.62, 1.15);
    const pctOff = Math.round(Math.abs(delta) * 100);
    kmNote = delta < -0.08
      ? `${valKm(km)} — about ${pctOff}% below average for the age`
      : delta > 0.08
      ? `${valKm(km)} — about ${pctOff}% above average for the age`
      : `${valKm(km)} — right around average for the age`;
  }
  factors.push({ label: "Distance", detail: kmNote, weight: pct(kmAdj - 1) });

  /* 4. Condition */
  const condAdj = VAL_CONDITION[condition] || 1.0;
  factors.push({
    label: "Condition",
    detail: titleish(String(condition).replace("-", " ")),
    weight: pct(condAdj - 1),
  });

  /* 5. Body-type demand */
  const demandAdj = VAL_DEMAND[body] || 1.0;
  factors.push({
    label: `${bodyLabel(body)} demand`,
    detail: demandAdj > 1.02 ? "Strong in the Canadian market"
      : demandAdj < 0.97 ? "Softer in the Canadian market" : "Steady in the Canadian market",
    weight: pct(demandAdj - 1),
  });

  /* 6. Brand retention */
  const retAdj = VAL_RETENTION[make] || 1.0;
  if (Math.abs(retAdj - 1) > 0.005) {
    factors.push({
      label: `${titleish(make)} resale`,
      detail: retAdj > 1 ? "Holds value better than the segment" : "Depreciates faster than the segment",
      weight: pct(retAdj - 1),
    });
  }

  /* 7. Seasonality — real and worth timing a sale around */
  const month = now.getMonth(); // 0-11
  let seasonAdj = 1.0, seasonNote = "No meaningful seasonal swing this month";
  const summer = month >= 4 && month <= 7;      // May–Aug
  const deepWinter = month >= 10 || month <= 1; // Nov–Feb
  if (body === "convertible" || body === "sports") {
    if (summer) { seasonAdj = 1.06; seasonNote = "Peak season — buyers pay up in summer"; }
    else if (deepWinter) { seasonAdj = 0.94; seasonNote = "Off season — consider waiting for spring"; }
  } else if (body === "truck" || body === "suv") {
    if (deepWinter) { seasonAdj = 1.04; seasonNote = "Winter demand lifts trucks and SUVs"; }
  }
  factors.push({ label: "Season", detail: seasonNote, weight: pct(seasonAdj - 1) });

  /* Assemble */
  const priv = base * retained * kmAdj * condAdj * demandAdj * retAdj * seasonAdj;

  /* The three numbers that drive the decision.
     Dealers bid below private because they carry recon, floorplan
     and warranty risk — but competitive bidding closes most of it. */
  const tradeIn = round50(priv * 0.78);
  const bidLow = round50(priv * 0.86);
  const bidHigh = round50(priv * 0.96);
  const privateHigh = round50(priv * 1.04);
  const mid = round50((bidLow + bidHigh) / 2);

  /* Confidence — say so when we're extrapolating */
  let confidence = matched === "model" ? 88 : matched === "make" ? 72 : 60;
  if (km == null) confidence -= 10;
  if (age > 20) confidence -= 12;
  if (isClassic) confidence -= 8; // enthusiast values diverge from curves
  if (km != null && age > 0 && km / Math.max(1, age) > 40000) confidence -= 6;
  confidence = clamp(Math.round(confidence), 35, 93);

  return {
    tradeIn, bidLow, bidHigh, mid, privateHigh,
    upside: Math.max(0, mid - tradeIn),
    body, age, confidence, matched, isClassic,
    factors,
    suggestedReserve: round50(bidLow * 0.94),
    suggestedStart: round50(bidLow * 0.70),
  };
}

/* ---------- helpers ---------- */
function guessBody(model) {
  const m = String(model).toLowerCase();
  if (/truck|pickup|f-?\d|silverado|sierra|ram|tacoma|tundra|ranger|colorado/.test(m)) return "truck";
  if (/suv|crossover|cx-|rav|cr-v|explorer|tahoe|yukon|highlander|pilot/.test(m)) return "suv";
  if (/van|caravan|sienna|odyssey|pacifica/.test(m)) return "minivan";
  if (/convertible|cabrio|roadster|spyder|miata|mx-5/.test(m)) return "convertible";
  if (/coupe|mustang|camaro|challenger|corvette|911/.test(m)) return "coupe";
  if (/hatch|golf|soul|fit|yaris/.test(m)) return "hatch";
  if (/ev|electric|tesla|leaf|bolt|ioniq|ev6|mach-e/.test(m)) return "ev";
  if (/hybrid|prius/.test(m)) return "hybrid";
  return "sedan";
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round50 = (n) => Math.max(500, Math.round(n / 50) * 50);
const pct = (d) => (Math.abs(d) < 0.005 ? "0%" : (d > 0 ? "+" : "") + Math.round(d * 100) + "%");
const fmtCad = (n) => "$" + Math.round(n).toLocaleString("en-CA");
const valKm = (n) => Number(n).toLocaleString("en-CA") + " km";
const titleish = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());
/* Body styles that read wrong under naive title-casing. */
const BODY_LABELS = { suv: "SUV", ev: "EV", hatch: "Hatchback", minivan: "Minivan" };
const bodyLabel = (b) => BODY_LABELS[b] || titleish(b);

/* ---------- Server-side narrative hook (not wired) ----------
   If you want a model-written summary of the estimate, add a
   Netlify function at /.netlify/functions/estimate-narrative that
   reads ANTHROPIC_API_KEY from the environment, and POST the
   factor list to it. The key must never appear in client code. */
async function estimateNarrativeHook(estimate, vehicle) {
  const endpoint = (window.LYC_CONFIG || {}).ESTIMATE_NARRATIVE_ENDPOINT;
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimate, vehicle }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.narrative || null;
  } catch { return null; }
}

window.LYC_VAL = { estimateValue, estimateNarrativeHook, guessBody, VAL_BASE, VAL_DEMAND };
