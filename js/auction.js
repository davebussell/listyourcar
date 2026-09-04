/* ============================================================
   listyourcar.ca — the auction platform
   Page logic for: the Smart Estimate tool, the live auction book,
   the auction detail page (countdown + bidding + reserve), and
   the seller's listing flow.
   Depends on data.js, auction-data.js, valuation.js, store.js and
   the shared helpers in app.js ($, $$, fmtPrice, cityName, qs).
   ============================================================ */

const V = () => window.LYC_VAL;

/* ---------- Money + time formatting ---------- */
const money = (n) => "$" + Math.round(Number(n)).toLocaleString("en-CA");
const kms = (n) => Number(n).toLocaleString("en-CA") + " km";

/* Auction ladder — the minimum a new bid must clear. */
function bidIncrement(current) {
  if (current < 5000) return 100;
  if (current < 20000) return 250;
  if (current < 50000) return 500;
  return 1000;
}

/* Human countdown. Seconds appear inside the final hour, where
   they actually change behaviour. */
function countdownParts(closesAt) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return { ended: true, text: "Auction ended", urgent: false };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let text;
  if (d > 0) text = `${d}d ${String(h).padStart(2, "0")}h`;
  else if (h > 0) text = `${h}h ${String(m).padStart(2, "0")}m`;
  else text = `${m}m ${String(sec).padStart(2, "0")}s`;
  return { ended: false, text, urgent: ms < 3600000, critical: ms < 600000, ms };
}

function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* Every countdown on the page ticks from one interval. */
function startCountdowns(root = document) {
  const tick = () => {
    $$("[data-closes]", root).forEach((el) => {
      const c = countdownParts(el.dataset.closes);
      el.textContent = c.text;
      el.classList.toggle("is-urgent", !!c.urgent);
      el.classList.toggle("is-critical", !!c.critical);
      el.classList.toggle("is-ended", !!c.ended);
    });
  };
  tick();
  if (startCountdowns._t) clearInterval(startCountdowns._t);
  startCountdowns._t = setInterval(tick, 1000);
}

/* ============================================================
   Auction card — used on the home page and the auction book
   ============================================================ */
function auctionCard(a) {
  const title = `${a.year} ${a.make} ${a.model}`;
  const c = countdownParts(a.closesAt);
  const bidCount = (a.bids || []).length;
  const reserveTag = a.status === "sold"
    ? '<span class="ac-reserve met">Sold</span>'
    : a.reserveMet
    ? '<span class="ac-reserve met">Reserve met</span>'
    : '<span class="ac-reserve">Reserve not met</span>';
  return `
    <a class="ac" href="auction.html?id=${encodeURIComponent(a.id)}">
      <div class="ac-media">
        ${a.photo ? `<img src="${a.photo}" alt="${title}" loading="lazy" />` : '<span class="ac-noimg">No photo</span>'}
        <span class="ac-clock ${c.urgent ? "is-urgent" : ""}" data-closes="${a.closesAt}">${c.text}</span>
        ${a.demo ? '<span class="demo-tag">Sample lot</span>' : ""}
      </div>
      <div class="ac-body">
        <div class="ac-head">
          <h3>${title}</h3>
          <span class="ac-trim">${a.trim || ""}</span>
        </div>
        <dl class="ac-figs">
          <div><dt>Current bid</dt><dd class="ac-bid">${a.currentBid != null ? money(a.currentBid) : "No bids yet"}</dd></div>
          <div><dt>Bids</dt><dd>${bidCount}</dd></div>
        </dl>
        <div class="ac-foot">
          <span class="ac-meta">${kms(a.mileage)} · ${cityName(a.city)}</span>
          ${reserveTag}
        </div>
      </div>
    </a>`;
}

/* ============================================================
   PAGE: Smart Estimate — "what will my car actually get?"
   The tool works with zero inventory, which is exactly why it
   leads the funnel: value first, listing second.
   ============================================================ */
function pageValue() {
  const wrap = $("#value-wrap");
  if (!wrap) return;

  const form = $("#value-form");
  const out = $("#value-out");
  const params = qs();

  // Deep links from the home page / SEO pages prefill the form.
  ["make", "model", "year", "mileage", "condition", "city"].forEach((k) => {
    const v = params.get(k);
    if (v && form[k]) form[k].value = v;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (!f.make || !f.model || !f.year) return;
    renderEstimate(out, f);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    // Keep the URL shareable — the estimate is the thing people send around.
    const u = new URL(location.href);
    Object.entries(f).forEach(([k, v]) => v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    history.replaceState(null, "", u.toString());
  });

  // If we arrived with a full vehicle in the URL, show the answer immediately.
  if (params.get("make") && params.get("model") && params.get("year")) {
    renderEstimate(out, Object.fromEntries(new FormData(form)));
  }
}

/* Title-case only what the user typed in lower case — otherwise
   "RAV4" comes back as "Rav4" and the estimate looks careless. */
function keepCase(s) {
  const v = String(s || "").trim();
  return /[A-Z]/.test(v) ? v : titleCase(v);
}

function renderEstimate(out, vehicle) {
  const est = V().estimateValue(vehicle);
  const title = `${vehicle.year} ${keepCase(vehicle.make)} ${keepCase(vehicle.model)}`;

  // The hook firing is the single most important signal on the site.
  window.Analytics?.track("estimate_completed", {
    make: String(vehicle.make || "").toLowerCase(),
    body: est.body,
    age: est.age,
    value_band: window.Analytics.band(est.mid),
    upside_band: window.Analytics.band(est.upside),
    confidence: est.confidence,
    matched: est.matched,
    from: window.Analytics.pageKind(),
  });
  const upsidePct = est.tradeIn ? Math.round((est.upside / est.tradeIn) * 100) : 0;

  out.innerHTML = `
    <div class="est reveal is-visible">
      <div class="est-head">
        <span class="eyebrow">Smart Estimate</span>
        <h2>${title}</h2>
        <p class="muted">${vehicle.mileage ? kms(vehicle.mileage) + " · " : ""}${titleCase(String(vehicle.condition || "good").replace("-", " "))} condition${vehicle.city ? " · " + cityName(vehicle.city) : ""}</p>
      </div>

      <div class="est-range">
        <span class="index">01</span>
        <h3>What competitive bidding should get you</h3>
        <div class="est-big">${money(est.bidLow)} <span class="dash">–</span> ${money(est.bidHigh)}</div>
        <div class="est-scale" aria-hidden="true">
          <span class="es-track"></span>
          <span class="es-band" style="left:${bandPos(est, est.bidLow)}%;width:${bandPos(est, est.bidHigh) - bandPos(est, est.bidLow)}%"></span>
          <span class="es-mark trade" style="left:${bandPos(est, est.tradeIn)}%"><i></i><em>Trade-in<br>${money(est.tradeIn)}</em></span>
          <span class="es-mark priv" style="left:${bandPos(est, est.privateHigh)}%"><i></i><em>Private sale<br>${money(est.privateHigh)}</em></span>
        </div>
      </div>

      ${est.upside > 300 ? `
      <div class="est-upside">
        <span class="index">02</span>
        <div>
          <h3>You'd leave about <em>${money(est.upside)}</em> on the table taking the first trade-in offer.</h3>
          <p class="muted">A dealer trade-in on this car runs around ${money(est.tradeIn)}. Auctioning it to a room of bidders typically lands near ${money(est.mid)} — roughly ${upsidePct}% more, for the price of setting a reserve and waiting out the clock.</p>
        </div>
      </div>` : ""}

      <div class="est-factors">
        <span class="index">${est.upside > 300 ? "03" : "02"}</span>
        <h3>How we got there</h3>
        <table class="ftable">
          <tbody>
            ${est.factors.map((f) => `
              <tr>
                <th>${f.label}</th>
                <td>${f.detail}</td>
                <td class="fw ${f.weight === "base" ? "base" : String(f.weight).startsWith("+") ? "up" : String(f.weight).startsWith("-") ? "down" : ""}">${f.weight === "base" ? "" : f.weight}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <p class="est-conf">
          <span class="conf-bar" aria-hidden="true"><span style="width:${est.confidence}%"></span></span>
          <span class="muted small">${est.confidence}% confidence — ${est.matched === "model" ? "based on a direct comparable" : est.matched === "make" ? "no direct comparable, priced off the make's segment" : "no direct comparable, priced off the market segment"}${est.isClassic ? ". Older vehicles vary widely with condition and originality." : ""}</span>
        </p>
      </div>

      <div class="est-cta">
        <div>
          <h3>Put it in front of the bidders</h3>
          <p class="muted">We'd suggest a reserve around <strong>${money(est.suggestedReserve)}</strong> and an opening bid of <strong>${money(est.suggestedStart)}</strong>. You set both — nothing sells below your reserve.</p>
        </div>
        <a class="btn btn-primary" href="sell.html?${new URLSearchParams({
          make: vehicle.make || "", model: vehicle.model || "", year: vehicle.year || "",
          mileage: vehicle.mileage || "", condition: vehicle.condition || "good",
          city: vehicle.city || "", reserve: est.suggestedReserve, start: est.suggestedStart,
        }).toString()}">List it for auction</a>
      </div>

      <p class="est-disclaimer muted small">An estimate, not an appraisal or an offer. Real bids depend on service history, accident record, tires, and what the bidder pool needs that week.</p>
    </div>`;
}

// Position a dollar figure on the estimate scale (trade-in → private).
function bandPos(est, v) {
  const lo = est.tradeIn * 0.94, hi = est.privateHigh * 1.03;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}

/* ============================================================
   PAGE: The auction book (live auctions)
   ============================================================ */
function pageAuctions() {
  const grid = $("#auction-grid");
  if (!grid) return;

  const state = { city: "", sort: "ending", status: "live" };
  /* Open on the market the visitor pinned, the way a retailer opens
     on your store. An explicit ?city= in the URL always wins, and the
     chip bar shows the active filter so changing it is one click. */
  const here = window.Locator ? Locator.get() : null;
  if (here && here.market && (D.AUCTION_CITIES || []).includes(here.market.slug)) {
    state.city = here.market.slug;
  }
  ["city", "sort", "status"].forEach((k) => { const v = qs().get(k); if (v) state[k] = v; });

  const cityBar = $("#auction-cities");
  if (cityBar) {
    const cities = ["", ...(D.AUCTION_CITIES || [])];
    cities.forEach((cs) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fchip" + (state.city === cs ? " active" : "");
      b.textContent = cs ? cityName(cs) : "All cities";
      b.addEventListener("click", () => {
        state.city = cs;
        $$(".fchip", cityBar).forEach((x) => x.classList.toggle("active", x === b));
        render();
      });
      cityBar.appendChild(b);
    });
  }

  const sortSel = $("#auction-sort");
  sortSel?.addEventListener("change", () => { state.sort = sortSel.value; render(); });
  const statusSel = $("#auction-status");
  statusSel?.addEventListener("change", () => { state.status = statusSel.value; render(); });

  function render() {
    let items = Store.allAuctions();
    if (state.city) items = items.filter((a) => a.city === state.city);
    if (state.status === "live") items = items.filter((a) => a.status === "live");
    else if (state.status === "closed") items = items.filter((a) => a.status !== "live");

    items.sort((a, b) => {
      switch (state.sort) {
        case "ending": return new Date(a.closesAt) - new Date(b.closesAt);
        case "newest": return new Date(b.openedAt) - new Date(a.openedAt);
        case "bid-high": return (b.currentBid || 0) - (a.currentBid || 0);
        case "bid-low": return (a.currentBid || 0) - (b.currentBid || 0);
        case "bids": return (b.bids || []).length - (a.bids || []).length;
        default: return 0;
      }
    });

    grid.innerHTML = items.length
      ? items.map(auctionCard).join("")
      : `<p class="muted empty-note">No auctions match. <button type="button" class="link-btn" id="clear-auc">Clear filters</button></p>`;
    $("#clear-auc")?.addEventListener("click", () => {
      state.city = ""; state.status = "live";
      $$(".fchip", cityBar).forEach((x, i) => x.classList.toggle("active", i === 0));
      if (statusSel) statusSel.value = "live";
      render();
    });

    const count = $("#auction-count");
    if (count) count.innerHTML = `<b>${items.length}</b> ${items.length === 1 ? "auction" : "auctions"}${state.status === "live" ? " live now" : ""}`;

    // Say plainly how much of the book is sample stock.
    const note = $("#auction-demo-note");
    if (note) {
      const demo = items.filter((a) => a.demo).length;
      note.innerHTML = demo
        ? `<div class="demo-note"><strong>${demo === items.length ? "These are sample lots." : `${demo} of these are sample lots.`}</strong> listyourcar.ca is a working prototype — sample bidding is simulated so you can see how the book behaves. Real listings appear here the moment sellers create them. <a href="sell.html" class="link-inline">List a real car →</a></div>`
        : "";
    }
    startCountdowns(grid);
  }
  render();
}

/* ============================================================
   PAGE: Auction detail — countdown, bid history, place a bid
   ============================================================ */
function pageAuction() {
  const wrap = $("#auction-wrap");
  if (!wrap) return;
  const id = qs().get("id");
  const a = id && Store.getAuction(id);
  if (!a) {
    wrap.innerHTML = `<p class="muted">Auction not found. <a href="auctions.html" class="link">See live auctions →</a></p>`;
    return;
  }
  render(a);

  function render(a) {
    const title = `${a.year} ${a.make} ${a.model}`;
    const c = countdownParts(a.closesAt);
    const bids = [...(a.bids || [])].sort((x, y) => y.amount - x.amount);
    const top = bids[0] || null;
    const nextMin = top ? top.amount + bidIncrement(top.amount) : a.startingBid;
    const toReserve = a.currentBid != null ? Math.max(0, a.reserve - a.currentBid) : a.reserve;
    const est = V().estimateValue(a);
    const closed = a.status !== "live";
    const dealerCount = new Set(bids.filter((b) => b.type === "dealer").map((b) => b.bidder)).size;

    const state = closed ? (a.status === "sold" ? "sold at auction" : "auction closed") : "live auction";
    const closeDay = new Date(a.closesAt).toLocaleDateString("en-CA", { month: "long", day: "numeric" });
    // A shared lot should preview with its own car, not the house image.
    setSeo({
      title: `${title} — ${state} | listyourcar.ca`,
      desc: `${a.currentBid != null ? "Current bid " + money(a.currentBid) + ". " : ""}${kms(a.mileage)}, ${cityName(a.city)}. ${a.reserveMet ? "Reserve met." : "Reserve not yet met."} Closes ${closeDay}.`,
      canonical: `${location.origin}${location.pathname}?id=${encodeURIComponent(a.id)}`,
      image: a.photo ? new URL(a.photo, location.origin).href : undefined,
    });

    wrap.innerHTML = `
      <a href="auctions.html" class="link back">← All auctions</a>
      ${a.demo ? `<div class="demo-note"><strong>Sample lot.</strong> This is a demonstration listing on a working prototype — the bidding is simulated and the car is not for sale. Everything else on the page behaves exactly as it would on a real auction. <a href="sell.html" class="link-inline">List a real car →</a></div>` : ""}

      <div class="ad-grid">
        <div class="ad-main">
          <div class="ad-media">
            ${a.photo ? `<img src="${a.photo}" alt="${title}" />` : '<span class="ac-noimg">No photo</span>'}
          </div>

          <h1 class="ad-title">${title}</h1>
          <p class="ad-trim">${a.trim || ""}</p>

          <dl class="ad-specs">
            <div><dt>Year</dt><dd>${a.year}</dd></div>
            <div><dt>Distance</dt><dd>${kms(a.mileage)}</dd></div>
            <div><dt>Condition</dt><dd>${titleCase(String(a.condition).replace("-", " "))}</dd></div>
            <div><dt>Location</dt><dd>${cityName(a.city)}</dd></div>
            <div><dt>Seller</dt><dd>${a.seller}</dd></div>
            <div><dt>Watchers</dt><dd>${a.watchers}</dd></div>
          </dl>

          <section class="ad-section">
            <span class="index">01</span>
            <h2>About this vehicle</h2>
            <p>${a.description || ""}</p>
          </section>

          <section class="ad-section">
            <span class="index">02</span>
            <h2>Bid history <span class="muted small">${bids.length} ${bids.length === 1 ? "bid" : "bids"}${dealerCount ? ` · ${dealerCount} dealers competing` : ""}</span></h2>
            ${bids.length ? `
              <table class="bidtable">
                <thead><tr><th>Amount</th><th>Bidder</th><th>Type</th><th>When</th></tr></thead>
                <tbody>
                  ${bids.map((b, i) => `
                    <tr class="${i === 0 ? "top-bid" : ""}${b.mine ? " my-bid" : ""}">
                      <td class="bt-amt">${money(b.amount)}</td>
                      <td>${b.bidder}${b.mine && b.bidder !== "You" ? ' <span class="you-tag">you</span>' : ""}</td>
                      <td><span class="btype ${b.type}">${b.type === "dealer" ? "Dealer" : "Public"}</span>${b.rating ? ` <span class="muted small">★ ${b.rating}</span>` : ""}</td>
                      <td class="muted small">${relTime(b.created)}</td>
                    </tr>`).join("")}
                </tbody>
              </table>` : '<p class="muted">No bids yet — the opening bid is ' + money(a.startingBid) + ".</p>"}
          </section>

          <section class="ad-section">
            <span class="index">03</span>
            <h2>What this car is worth</h2>
            <p class="muted">Our Smart Estimate puts competitive bidding for this vehicle between <strong>${money(est.bidLow)}</strong> and <strong>${money(est.bidHigh)}</strong>, against a typical dealer trade-in of ${money(est.tradeIn)}.</p>
            <a class="link" href="value.html?make=${encodeURIComponent(a.make)}&model=${encodeURIComponent(a.model)}&year=${a.year}&mileage=${a.mileage}&condition=${a.condition}&city=${a.city}">See the full breakdown →</a>
          </section>
        </div>

        <aside class="ad-side">
          <div class="bidbox ${closed ? "is-closed" : ""}">
            <div class="bb-clock">
              <span class="bb-label">${closed ? "Auction closed" : "Closes in"}</span>
              <span class="bb-count ${c.urgent ? "is-urgent" : ""}" data-closes="${a.closesAt}">${c.text}</span>
              <span class="muted small">${new Date(a.closesAt).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>

            <div class="bb-current">
              <span class="bb-label">${closed ? "Final bid" : "Current bid"}</span>
              <span class="bb-amt">${a.currentBid != null ? money(a.currentBid) : "No bids"}</span>
              <span class="bb-reserve ${a.reserveMet ? "met" : ""}">
                ${a.reserveMet
                  ? "✓ Reserve met — this car sells"
                  : `${money(toReserve)} below the seller's reserve`}
              </span>
            </div>

            ${closed ? `
              <div class="bb-closed-note">
                ${a.status === "sold"
                  ? `<strong>Sold</strong> at ${money(a.currentBid)} to ${top ? top.bidder : "the high bidder"}.`
                  : "<strong>Reserve not met.</strong> The seller may still accept the high bid."}
              </div>`
            : `
              <form id="bid-form" class="bb-form">
                <label>Your bid
                  <div class="bb-input">
                    <span class="bb-cur">$</span>
                    <input type="number" name="amount" min="${nextMin}" step="50" value="${nextMin}" required inputmode="numeric" />
                  </div>
                </label>
                <p class="muted small">Minimum bid ${money(nextMin)} · increments of ${money(bidIncrement(top ? top.amount : a.startingBid))}</p>
                <fieldset class="bb-who">
                  <legend class="bb-label">Bidding as</legend>
                  <label class="radio"><input type="radio" name="type" value="public" checked /> Private buyer</label>
                  <label class="radio"><input type="radio" name="type" value="dealer" /> Registered dealer</label>
                </fieldset>
                <button type="submit" class="btn btn-primary btn-block">Place bid</button>
                <p class="form-note muted small">Bids are binding on the seller once the reserve is met. Prototype — bids are stored in your browser.</p>
              </form>`}

            <button type="button" class="btn btn-ghost btn-block" id="watch-btn">
              ${Store.isWatching(a.id) ? "★ Watching" : "☆ Watch this auction"}
            </button>
          </div>

          <div class="side-note">
            <span class="index">—</span>
            <p class="muted small">Selling something similar? <a href="value.html?make=${encodeURIComponent(a.make)}&model=${encodeURIComponent(a.model)}&year=${a.year}" class="link">Check what yours would get →</a></p>
          </div>
        </aside>
      </div>`;

    startCountdowns(wrap);
    auctionJsonLd(a, title, top);

    $("#watch-btn")?.addEventListener("click", (e) => {
      const on = Store.toggleWatch(a.id);
      e.target.textContent = on ? "★ Watching" : "☆ Watch this auction";
      window.Analytics?.track("watch_toggled", { on, city: a.city });
    });

    $("#bid-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const amount = Number(f.amount);
      if (!(amount >= nextMin)) {
        alert(`Your bid must be at least ${money(nextMin)}.`);
        return;
      }
      Store.addBid({ auctionId: a.id, amount, bidder: "You", type: f.type });
      window.submitForm({
        _subject: `Bid placed: ${title}`, kind: "bid", auction: a.id,
        vehicle: title, amount, bidderType: f.type,
      });

      // Demand side, plus how close to the wire bids actually land.
      const left = new Date(a.closesAt).getTime() - Date.now();
      window.Analytics?.track("bid_placed", {
        bidder_type: f.type,
        city: a.city,
        amount_band: window.Analytics.band(amount),
        cleared_reserve: amount >= a.reserve,
        hours_left: Math.max(0, Math.round(left / 3600000)),
      });
      render(Store.getAuction(a.id)); // re-read so reserve/status recompute
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

/* Structured data for an auction lot. Describes only what is
   genuinely on the page — the vehicle, the current bid, and when
   bidding ends — so the markup and the rendered page agree. */
function auctionJsonLd(a, title, top) {
  document.getElementById("auction-jsonld")?.remove();
  const city = (D.CITIES || []).find((c) => c.slug === a.city);
  const data = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: title,
    vehicleModelDate: String(a.year),
    manufacturer: { "@type": "Organization", name: a.make },
    model: a.model,
    ...(a.trim ? { vehicleConfiguration: a.trim } : {}),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: a.mileage, unitCode: "KMT" },
    itemCondition: "https://schema.org/UsedCondition",
    ...(a.photo ? { image: a.photo } : {}),
    description: a.description || title,
    offers: {
      "@type": "Offer",
      url: location.href.split("#")[0],
      priceCurrency: "CAD",
      price: a.currentBid != null ? a.currentBid : a.startingBid,
      availability: a.status === "live"
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      availabilityEnds: a.closesAt,
      ...(city ? { areaServed: { "@type": "City", name: city.name } } : {}),
      seller: { "@type": "Person", name: a.seller || "Private seller" },
    },
  };
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.id = "auction-jsonld";
  s.textContent = JSON.stringify(data);
  document.head.appendChild(s);
}

/* ============================================================
   PAGE: Sell — create an auction (reserve + closing time)
   ============================================================ */
function pageSell() {
  const form = $("#sell-form");
  if (!form) return;

  const params = qs();
  ["make", "model", "year", "mileage", "condition", "city"].forEach((k) => {
    const v = params.get(k);
    if (v && form[k]) form[k].value = v;
  });
  if (params.get("reserve") && form.reserve) form.reserve.value = params.get("reserve");
  if (params.get("start") && form.startingBid) form.startingBid.value = params.get("start");

  // Default the close to a week out at 8pm — auctions end when people are home.
  if (form.closesAt && !form.closesAt.value) {
    const d = new Date(Date.now() + 7 * 86400000);
    d.setHours(20, 0, 0, 0);
    form.closesAt.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  /* Live estimate rail — updates as they type, so the reserve they
     pick is informed rather than a guess. */
  const rail = $("#sell-estimate");
  function refreshEstimate() {
    const f = Object.fromEntries(new FormData(form));
    if (!f.make || !f.model || !f.year) {
      rail.innerHTML = `<p class="muted small">Fill in the year, make and model and we'll estimate what the bidders should pay.</p>`;
      return;
    }
    const est = V().estimateValue(f);
    rail.innerHTML = `
      <span class="eyebrow">Smart Estimate</span>
      <div class="sr-range">${money(est.bidLow)} – ${money(est.bidHigh)}</div>
      <p class="muted small">What competitive bidding should get you. A dealer trade-in on this car runs about ${money(est.tradeIn)}.</p>
      <dl class="sr-sugg">
        <div><dt>Suggested reserve</dt><dd>${money(est.suggestedReserve)}</dd></div>
        <div><dt>Suggested opening bid</dt><dd>${money(est.suggestedStart)}</dd></div>
      </dl>
      <button type="button" class="link-btn" id="use-sugg">Use these figures</button>
      <p class="muted small" style="margin-top:1rem">${est.confidence}% confidence. Nothing sells below the reserve you set.</p>`;
    $("#use-sugg")?.addEventListener("click", () => {
      form.reserve.value = est.suggestedReserve;
      form.startingBid.value = est.suggestedStart;
    });
  }
  ["make", "model", "year", "mileage", "condition"].forEach((k) => {
    form[k]?.addEventListener("input", refreshEstimate);
    form[k]?.addEventListener("change", refreshEstimate);
  });
  refreshEstimate();

  /* Dealer picker — postal lookup, marque filters, hand-selection.
     Seeded from the chosen city so it is useful before the seller
     types anything, then overridden by whatever they search. */
  let picker = null;
  let picked = [];
  let origin = null;
  const pickHost = document.getElementById("dealer-picker");
  const postalNote = document.getElementById("postal-note");

  /* The car on the form decides who is asked to bid. The header may
     already know it; the form is the source of truth while here, and
     writes back so the rest of the site follows. */
  const headerCar = window.Locator && Locator.car ? Locator.car() : null;
  if (headerCar) {
    if (form.make && !form.make.value && headerCar.make) form.make.value = headerCar.make;
    if (form.year && !form.year.value && headerCar.year) form.year.value = headerCar.year;
  }
  function carOnForm() {
    const make = form.make ? form.make.value.trim() : "";
    const year = form.year ? Number(form.year.value) || "" : "";
    if (!make && !year) return null;
    const body = window.LYC_VAL && LYC_VAL.guessBody && form.model ? LYC_VAL.guessBody(form.model.value) : "";
    const kind = headerCar && headerCar.make && headerCar.make.toLowerCase() === make.toLowerCase() && headerCar.kind
      ? headerCar.kind : "";
    return { make: window.DealerNet ? DealerNet.canonMake(make) : make, year, body, kind,
             audience: headerCar && headerCar.audience && kind ? headerCar.audience : null };
  }

  if (pickHost && window.createDealerPicker) {
    picker = createDealerPicker(pickHost, {
      count: 10,
      embedded: true,      // the form already asks for a postal code
      car: carOnForm(),
      onChange: (sel) => { picked = sel; },
    });
    let carTimer = null;
    const syncCar = () => {
      clearTimeout(carTimer);
      carTimer = setTimeout(() => {
        const c = carOnForm();
        picker.setCar(c);
        if (c && window.Locator && Locator.setCar) Locator.setCar({ ...(Locator.car() || {}), ...c, audience: null });
      }, 350);
    };
    ["make", "year", "model"].forEach((k) => form[k]?.addEventListener("input", syncCar));
  }

  /* The postal code is the single source of truth for location: it
     ranks the dealers, and it sets the market the lot files under.
     Resolved on blur rather than per keystroke, so a half-typed code
     never fires a lookup. */
  /* Which auction market a lot files under is decided by actual
     distance from the resolved postal code, not by the postal
     letter — a Saskatoon seller has no letter mapping but is
     unambiguously closest to Winnipeg. */
  function nearestMarket(o) {
    const cities = (window.LYC_DATA && window.LYC_DATA.CITIES) || [];
    let best = null, bestKm = Infinity;
    for (const c of cities) {
      const km = DealerNet.haversine(o.lat, o.lon, c.lat, c.lon);
      if (km < bestKm) { bestKm = km; best = c; }
    }
    return best ? { slug: best.slug, km: bestKm } : null;
  }

  async function resolvePostal() {
    const raw = form.postal ? form.postal.value.trim() : "";
    if (!raw) return;
    if (postalNote) postalNote.textContent = "Looking that up…";
    try {
      origin = await DealerNet.fromPostal(raw);
      if (postalNote) {
        postalNote.textContent = origin.place
          ? origin.place + (origin.province ? ", " + origin.province : "")
          : "Found.";
        /* A rural district can be 100 km wide. If only the district
           resolved, say so, so a seller knows why the list looks off
           and that the full code fixes it. */
        if (origin.rural && origin.precision === "district") {
          postalNote.textContent += " — placed to the postal district only; the full six-character code gives an exact match.";
        }
        postalNote.classList.remove("is-error");
      }
      /* Offer the closest auction market, but never overwrite a
         choice the seller has already made themselves. */
      if (form.city && !form.city.value) {
        const m = nearestMarket(origin);
        if (m) form.city.value = m.slug;
      }
      if (picker) await picker.setOrigin(origin);
    } catch (e) {
      origin = null;
      if (postalNote) {
        postalNote.textContent = e.message || "We couldn't find that postal code.";
        postalNote.classList.add("is-error");
      }
    }
  }
  form.postal?.addEventListener("blur", resolvePostal);
  form.postal?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); form.postal.blur(); }
  });
  /* If the visitor already pinned a location in the header, the form
     starts from it instead of asking for the same thing twice. */
  const pinned = window.Locator ? Locator.get() : null;
  if (pinned) {
    if (form.postal && !form.postal.value && pinned.postal) form.postal.value = pinned.postal;
    if (form.city && !form.city.value && pinned.market) form.city.value = pinned.market.slug;
  }
  if (form.postal && form.postal.value) resolvePostal();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const reserve = Number(f.reserve) || 0;
    const startingBid = Number(f.startingBid) || 0;
    if (startingBid > reserve && reserve > 0) {
      alert("Your opening bid is above your reserve. Lower the opening bid, or raise the reserve.");
      return;
    }
    const closesAt = new Date(f.closesAt);
    if (!(closesAt.getTime() > Date.now())) {
      alert("Pick a closing time in the future.");
      return;
    }

    const est = V().estimateValue(f);
    const auction = Store.addAuction({
      make: f.make, model: f.model, trim: f.trim || "", year: Number(f.year),
      mileage: Number(f.mileage) || 0, condition: f.condition, city: f.city,
      postal: (f.postal || "").toUpperCase(),
      reserve, startingBid, closesAt: closesAt.toISOString(),
      description: f.description || `${f.year} ${f.make} ${f.model}. ${titleCase(String(f.condition).replace("-", " "))} condition, ${kms(f.mileage || 0)}.`,
      photo: null,
      estimate: { low: est.bidLow, high: est.bidHigh, tradeIn: est.tradeIn },
      name: f.name, email: f.email, phone: f.phone,
      seller: f.name || "Private seller",
    });

    /* Match the rooftops closest to this car and record who should
       be invited to bid. Matching is local and instant; delivery is
       a separate, deliberate step (see the invitation panel). */
    let matched = [];
    let invite = null;
    try {
      const from = origin || DealerNet.fromCity(f.city);
      matched = picked.length ? picked : (from ? await DealerNet.nearest(from, 10) : []);
      invite = Store.addInvite({
        auctionId: auction.id,
        vehicle: `${f.year} ${f.make} ${f.model}`,
        city: f.city,
        dealers: matched,
      });
    } catch (err) {
      // A dealer-data failure must never block the listing itself.
      console.warn("dealer matching unavailable:", err.message);
    }

    window.submitForm({
      _subject: `New auction: ${f.year} ${f.make} ${f.model}`, kind: "auction",
      vehicle: `${f.year} ${f.make} ${f.model}`, reserve, startingBid,
      closesAt: closesAt.toISOString(), name: f.name, email: f.email, phone: f.phone,
    });

    // Supply side: a listing created is the conversion that matters.
    const runDays = Math.round((closesAt.getTime() - Date.now()) / 86400000);
    window.Analytics?.track("auction_created", {
      city: f.city,
      make: String(f.make || "").toLowerCase(),
      reserve_band: window.Analytics.band(reserve),
      run_days: runDays,
      reserve_vs_estimate: reserve > est.bidHigh ? "above-range"
        : reserve < est.bidLow ? "below-range" : "in-range",
    });

    $("#sell-wrap").innerHTML = `
      <div class="success-card">
        <span class="eyebrow">Auction created</span>
        <h1>${f.year} ${keepCase(f.make)} ${keepCase(f.model)} is live.</h1>
        <p class="lead">Bidding opens at ${money(startingBid)} and closes ${closesAt.toLocaleString("en-CA", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(/\.$/, "")}. Nothing sells below your ${money(reserve)} reserve.</p>
        <dl class="succ-figs">
          <div><dt>Estimated to fetch</dt><dd>${money(est.bidLow)} – ${money(est.bidHigh)}</dd></div>
          <div><dt>Your reserve</dt><dd>${money(reserve)}</dd></div>
          <div><dt>Opening bid</dt><dd>${money(startingBid)}</dd></div>
        </dl>
        <div id="matched-dealers"></div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="auction.html?id=${auction.id}">View your auction</a>
          <a class="btn btn-ghost" href="dashboard.html">Go to dashboard</a>
        </div>
      </div>`;

    renderDealerPanel($("#matched-dealers"), matched, invite, f.city);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   Matched dealerships — who gets invited to bid on this car
   ============================================================ */
function renderDealerPanel(host, dealers, invite, citySlug) {
  if (!host) return;

  if (!dealers || !dealers.length) {
    host.innerHTML = `<div class="demo-note"><strong>Dealer matching unavailable.</strong>
      Your auction is live and accepting bids — we could not load the dealer network just now,
      so the invitation list will be built when it recovers.</div>`;
    return;
  }

  const furthest = Math.round(dealers[dealers.length - 1].km);
  const sellerCity = cityName(citySlug);
  const isLocal = (d) => d.city.toLowerCase() === sellerCity.toLowerCase();
  const local = dealers.filter(isLocal).length;
  host.innerHTML = `
    <section class="dealers-panel">
      <div class="dealers-head">
        <div>
          <span class="eyebrow">Invited to bid</span>
          <h2>${dealers.length} ${dealers.length === 1 ? "dealership" : "dealerships"} invited to bid</h2>
          <p class="muted">${local === dealers.length
            ? `All ten are in ${sellerCity} itself, ordered by size — the rooftops with the volume to bid seriously on a car like yours.`
            : local
            ? `${local} in ${sellerCity} itself, the rest within ${furthest} km.`
            : `Nearest first, out to ${furthest} km from ${sellerCity}.`}</p>
        </div>
        <span class="dealers-count"><b>${dealers.length}</b><em>matched</em></span>
      </div>

      <ol class="dealer-list">
        ${dealers.map((d, i) => `
          <li class="dealer">
            <span class="dealer-rank">${String(i + 1).padStart(2, "0")}</span>
            <span class="dealer-body">
              <strong>${d.name}</strong>
              <span class="dealer-meta">${d.city}, ${d.province}${d.postal ? " · " + d.postal : ""}</span>
            </span>
            <span class="dealer-contact">
              ${d.phone ? `<a href="tel:${d.phone.replace(/[^0-9+]/g, "")}" class="link-inline">${d.phone}</a>` : `<span class="muted small">no phone on file</span>`}
              ${d.website ? `<a href="https://${d.website}" target="_blank" rel="noopener" class="dealer-web">${d.website}</a>` : ""}
            </span>
            <span class="dealer-km">${isLocal(d) ? `<span class="dealer-here">in city</span>` : `${Math.round(d.km)}<em>km</em>`}</span>
          </li>`).join("")}
      </ol>

      <div class="dealers-foot">
        <p class="muted small">
          <strong>Status: matched, not yet sent.</strong>
          The list is built and saved${invite ? ` as <code>${invite.id}</code>` : ""}, but no invitation has
          been delivered yet. The dealer records carry phone numbers and websites, not email addresses,
          so automated dispatch needs a contact channel first — and commercial messages to Canadian
          businesses require consent under CASL. Until then this is a call list: these are the rooftops
          most likely to want your car.
        </p>
        <p class="muted small">
          Distances are measured to each dealership's city, not its street address — Canadian postal
          geography is proprietary and not in the open geocoder. Rooftops in your own city therefore
          tie, and are ordered by size. Street-level ranking needs a commercial geocoding pass.
        </p>
      </div>
    </section>`;
}

/* ============================================================
   Home page: live auction strip + quick estimate
   ============================================================ */
function homeAuctions() {
  /* Hero facts and the estimate preview are computed from the real
     book and the real engine — never hardcoded. A number on the
     home page that the tool then contradicts costs more trust than
     the number ever bought. */
  const live = Store.allAuctions().filter((a) => a.status === "live");

  const facts = $("#hero-facts");
  if (facts) {
    // Average gap between trade-in and mid-auction across the book.
    const gaps = live.map((a) => V().estimateValue(a).upside).filter((n) => n > 0);
    const avgGap = gaps.length ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length / 50) * 50 : null;
    const cities = new Set(live.map((a) => a.city)).size;
    facts.innerHTML = `
      <div class="fact"><span class="fact-n">${live.length}</span><span class="fact-l">Lots open now</span></div>
      ${avgGap ? `<div class="fact"><span class="fact-n">${money(avgGap)}</span><span class="fact-l">Avg. gain vs trade-in</span></div>` : ""}
      <div class="fact"><span class="fact-n">${cities || D.CITIES.length}</span><span class="fact-l">Cities bidding</span></div>`;
  }

  const preview = $("#est-preview");
  if (preview) {
    const car = { year: 2020, make: "Toyota", model: "RAV4", mileage: 68000, condition: "good" };
    const e = V().estimateValue(car);
    preview.innerHTML = `
      <span class="epv-label">${car.year} ${car.make} ${car.model} · ${kms(car.mileage)}</span>
      <div class="epv-row"><span>Dealer trade-in</span><b class="down">${money(e.tradeIn)}</b></div>
      <div class="epv-row hi"><span>Competitive bidding</span><b>${money(e.bidLow)} – ${money(e.bidHigh)}</b></div>
      <div class="epv-row"><span>Private sale ceiling</span><b>${money(e.privateHigh)}</b></div>
      <div class="epv-gain">+${money(e.upside)} <span>vs. trade-in</span></div>`;
  }

  /* Hero: the single closest-to-closing lot, as live proof. */
  const hero = $("#hero-auction");
  if (hero) {
    const soon = Store.allAuctions()
      .filter((a) => a.status === "live" && a.currentBid != null)
      .sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt))[0];
    if (soon) {
      const c = countdownParts(soon.closesAt);
      hero.innerHTML = `
        <a class="ha" href="auction.html?id=${soon.id}">
          ${soon.photo ? `<img src="${soon.photo}" alt="${soon.year} ${soon.make} ${soon.model}" />` : ""}
          <span class="ha-tag"><span class="live-dot"></span>Closing next</span>
          <span class="ha-panel">
            <span class="ha-car">${soon.year} ${soon.make} ${soon.model}</span>
            <span class="ha-row">
              <span><em>Current bid</em><b>${money(soon.currentBid)}</b></span>
              <span><em>Closes in</em><b class="${c.urgent ? "is-urgent" : ""}" data-closes="${soon.closesAt}">${c.text}</b></span>
            </span>
            <span class="ha-meta">${(soon.bids || []).length} bids · ${cityName(soon.city)} · ${soon.reserveMet ? "reserve met" : "reserve not met"}</span>
          </span>
        </a>`;
      startCountdowns(hero);
    }
  }

  const strip = $("#home-auctions");
  if (strip) {
    const live = Store.allAuctions()
      .filter((a) => a.status === "live")
      .sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt))
      .slice(0, 6);
    strip.innerHTML = live.map(auctionCard).join("");
    startCountdowns(strip);
  }

  // Hero quick-estimate — three fields, straight to the answer.
  const qf = $("#quick-value");
  qf?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(qf));
    window.Analytics?.track("estimate_started", { from: "hero", make: String(f.make || "").toLowerCase() });
    const u = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) u.set(k, v); });
    location.href = "value.html?" + u.toString();
  });

  // Live ticker of recent bidding activity — proof the room is full.
  const tick = $("#home-ticker");
  if (tick) {
    const recent = Store.allAuctions()
      .flatMap((a) => (a.bids || []).map((b) => ({ ...b, car: `${a.year} ${a.make} ${a.model}`, city: a.city })))
      .sort((x, y) => new Date(y.created) - new Date(x.created))
      .slice(0, 8);
    tick.innerHTML = recent.map((b) => `
      <span class="tk-item"><b>${money(b.amount)}</b> ${b.car} <span class="muted">· ${b.type === "dealer" ? "dealer" : "private"} bid · ${cityName(b.city)}</span></span>`).join("");
  }
}

/* ============================================================
   PAGE: Dashboard — your auctions, your bids, your watchlist
   ============================================================ */
function pageAuctionDashboard() {
  const all = Store.allAuctions();
  const mine = Store.userAuctions().map((a) => Store.getAuction(a.id)).filter(Boolean);
  const bids = Store.myBids();

  const stats = $("#stats");
  if (stats) {
    const bidsOnMine = mine.reduce((s, a) => s + (a.bids || []).length, 0);
    const topValue = mine.reduce((s, a) => s + (a.currentBid || 0), 0);
    stats.innerHTML = [
      statCard(mine.length, "Your auctions"),
      statCard(bidsOnMine, "Bids received"),
      statCard(bids.length, "Bids placed"),
      statCard(topValue ? money(topValue) : "—", "Current bid value"),
    ].join("");
  }

  /* — Your auctions — */
  const ma = $("#my-auctions");
  if (ma) {
    ma.innerHTML = mine.length ? mine.map((a) => {
      const c = countdownParts(a.closesAt);
      const top = [...(a.bids || [])].sort((x, y) => y.amount - x.amount)[0];
      return `
        <div class="row-card">
          <div class="grow">
            <strong>${a.year} ${a.make} ${a.model}</strong>
            <span class="rc-state ${a.status}">${a.status === "live" ? "Live" : a.status === "sold" ? "Sold" : "Reserve not met"}</span>
            <div class="muted small">
              ${a.currentBid != null ? `High bid ${money(a.currentBid)}` : "No bids yet"}
              · reserve ${money(a.reserve)}
              ${a.reserveMet ? '<span class="ok-tag">reserve met</span>' : ""}
              · ${a.status === "live" ? `closes in <span data-closes="${a.closesAt}">${c.text}</span>` : "closed"}
              · ${(a.bids || []).length} bids
            </div>
            ${top && a.status !== "live" && a.reserveMet ? `<div class="rc-win muted small">Won by <strong>${top.bidder}</strong> at ${money(top.amount)}. Contact details are exchanged at this point — wired to your inbox in the live product.</div>` : ""}
            ${a.status === "reserve-not-met" && top ? `<div class="rc-win muted small">High bid was ${money(top.amount)}, ${money(a.reserve - top.amount)} short of your reserve. You can still accept it, or relist with different terms.</div>` : ""}
          </div>
          <a class="btn btn-sm btn-ghost" href="auction.html?id=${a.id}">View</a>
        </div>`;
    }).join("") : `<p class="muted">No auctions yet. <a href="value.html" class="link">See what your car is worth →</a></p>`;
  }

  /* — Bids you've placed — */
  const mb = $("#my-bids");
  if (mb) {
    mb.innerHTML = bids.length ? bids.map((b) => {
      const a = all.find((x) => x.id === b.auctionId);
      if (!a) return "";
      const winning = a.currentBid === b.amount;
      return `
        <div class="row-card">
          <div class="grow">
            <strong>${a.year} ${a.make} ${a.model}</strong>
            <span class="rc-state ${winning ? "live" : ""}">${winning ? (a.status === "live" ? "High bid" : "Won") : "Outbid"}</span>
            <div class="muted small">Your bid ${money(b.amount)} · current ${money(a.currentBid)} · ${a.status === "live" ? `closes in <span data-closes="${a.closesAt}">—</span>` : "closed"}</div>
          </div>
          <a class="btn btn-sm btn-ghost" href="auction.html?id=${a.id}">View</a>
        </div>`;
    }).join("") : `<p class="muted">No bids yet. <a href="auctions.html" class="link">Browse live auctions →</a></p>`;
  }

  /* — Dealer invitations raised by your listings — */
  const mi = $("#my-invites");
  if (mi) {
    const invites = Store.invites();
    mi.innerHTML = invites.length ? invites.map((v) => `
      <div class="row-card invite-row">
        <div class="grow">
          <strong>${v.vehicle}</strong>
          <span class="rc-state ${v.status === "sent" ? "sold" : ""}">${v.status === "sent" ? "Sent" : "Matched"}</span>
          <div class="muted small">
            ${v.dealers.length} dealerships near ${cityName(v.city)}
            · built ${relTime(v.created)}
          </div>
          <details class="invite-detail">
            <summary>See the list</summary>
            <ol class="invite-dealers">
              ${v.dealers.map((d) => `<li><span>${d.name}</span><span class="muted small">${d.city}, ${d.province} · ${d.km} km</span></li>`).join("")}
            </ol>
          </details>
        </div>
        <a class="btn btn-sm btn-ghost" href="auction.html?id=${v.auctionId}">View lot</a>
      </div>`).join("")
      : `<p class="muted">No invitations yet. <a href="sell.html" class="link-inline">List a car →</a> and we'll match the ten closest dealerships to it.</p>`;
  }

  /* — Watchlist — */
  const mw = $("#my-watchlist");
  if (mw) {
    const watched = Store.watchlist().map((id) => all.find((a) => a.id === id)).filter(Boolean);
    mw.innerHTML = watched.length ? watched.map((a) => `
      <div class="row-card">
        <div class="grow">
          <strong>${a.year} ${a.make} ${a.model}</strong>
          <div class="muted small">${a.currentBid != null ? money(a.currentBid) : "No bids"} · ${a.status === "live" ? `closes in <span data-closes="${a.closesAt}">—</span>` : "closed"}</div>
        </div>
        <a class="btn btn-sm btn-ghost" href="auction.html?id=${a.id}">View</a>
      </div>`).join("") : `<p class="muted">Nothing on your watchlist yet.</p>`;
  }

  startCountdowns(document);

  $("#reset-demo")?.addEventListener("click", () => {
    if (confirm("Clear your demo auctions, bids and watchlist?")) {
      Store.resetAll(); location.reload();
    }
  });
}

/* ============================================================
   PAGE: City landing pages — live lots for that market
   ============================================================ */
function pageCity() {
  const grid = $("#city-auctions");
  if (!grid) return;
  const city = document.body.dataset.city;
  const note = $("#city-auctions-note");

  const live = Store.allAuctions()
    .filter((a) => a.status === "live" && (!city || a.city === city))
    .sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt))
    .slice(0, 3);

  if (live.length) {
    grid.innerHTML = live.map(auctionCard).join("");
    if (note) note.innerHTML = `<a class="link-inline" href="auctions.html?city=${city || ""}">See every live lot in ${cityName(city)} →</a>`;
    startCountdowns(grid);
  } else {
    // An empty market is a listing opportunity, not a dead end.
    grid.innerHTML = `<p class="muted empty-note">No lots open in ${cityName(city)} right now —
      <a class="link-inline" href="sell.html?city=${city || ""}">yours could be the next one</a>.</p>`;
    if (note) note.innerHTML = `<a class="link-inline" href="auctions.html">Browse auctions across Canada →</a>`;
  }
}

/* ============================================================
   PAGE: For dealers — figures computed from the live book
   ============================================================ */
function pageDealers() {
  const box = $("#dealer-stats");
  if (!box) return;
  const all = Store.allAuctions();
  const live = all.filter((a) => a.status === "live");
  const bidCounts = all.map((a) => (a.bids || []).length).filter((n) => n > 0);
  const avgBids = bidCounts.length
    ? (bidCounts.reduce((s, n) => s + n, 0) / bidCounts.length).toFixed(1)
    : "—";
  const cities = new Set(all.map((a) => a.city)).size;

  box.innerHTML = `
    <span class="epv-label">The book right now</span>
    <div class="epv-row"><span>Lots open</span><b>${live.length}</b></div>
    <div class="epv-row"><span>Cities covered</span><b>${cities || D.CITIES.length}</b></div>
    <div class="epv-row hi"><span>Avg. bids per lot</span><b>${avgBids}</b></div>
    <div class="epv-gain">$0 <span>to register</span></div>`;
}

window.pageDealers = pageDealers;
/* ============================================================
   Dealer page — one dealership, rendered from the bundle.
   ============================================================ */

/* Everything the export says about the business beyond its name
   and marques: what it does, how big it is, whether it is part of
   a group, the language it trades in, and what it specialises in.
   Only facts present in the data are shown; nothing is inferred
   for display that the profile did not record. */
function profileBlock(d) {
  const ROLE = { service: "Repair, collision or towing — not a car buyer", finance: "Financing and credit — not a car buyer",
    salvage: "Salvage and parts — buys wrecks, not retail cars", broker: "Broker or consignment", rental: "Rental, leasing or fleet — not a retail buyer",
    auction: "Auction house", media: "Marketing or media company — not a dealer" };
  const FOCUS = { ev: "Electric and hybrid", truck: "Trucks and commercial", classic: "Classic and collector", exotic: "Exotic",
    import: "Imports", performance: "Performance and motorsport", budget: "Budget and wholesale", premium: "Premium and luxury" };
  const facts = [];
  if (d.role !== "dealer") facts.push(["What it does", ROLE[d.role] || d.role]);
  facts.push(["Size", DealerNet.SIZE_LABEL[d.size] + (d.tollfree ? " · toll-free line" : "")]);
  facts.push(["Footprint", DealerNet.SITES_LABEL[d.sites] + (d.group ? " · part of " + d.group : "")]);
  if (d.brands.length) facts.push(["Marques", (d.multi ? "Multi-marque store · " : "") + d.brands.join(", ") +
    (d.confidence === "high" ? " · confirmed by website" : d.confidence === "low" ? " · read from a run-together name" : "")]);
  if (d.focus.length) facts.push(["Specialises in", d.focus.map((f) => FOCUS[f] || f).join(", ")]);
  if (d.french) facts.push(["Language", "Trades in French"]);
  return `<section class="dealer-profile">
    <span class="eyebrow">Profile</span>
    <dl class="dealer-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  </section>`;
}
async function pageDealer() {
  const host = $("#dealer-page");
  if (!host) return;
  const id = qs().get("id") || "";
  let d = null;
  try { d = await DealerNet.byId(id); } catch { d = null; }
  if (!d) {
    host.innerHTML = `<p class="muted">We couldn't find that dealership. <a class="link" href="/find-buyers.html">Browse the buyer map →</a></p>`;
    return;
  }
  const tier = { exotic: "Exotic marques", luxury: "Luxury marques", mainstream: "Franchised dealer" }[d.tier] || "";
  const kind = d.brands.length ? tier
    : d.spec === "other" ? "Not a retail car buyer"
    : d.spec ? d.spec.charAt(0).toUpperCase() + d.spec.slice(1) + " specialist"
    : "Independent used-car dealer";
  const here = window.Locator ? Locator.get() : null;
  const km = here ? DealerNet.haversine(here.lat, here.lon, d.lat, d.lon) : null;
  const m = (window.Locator && Locator.nearestMarket) ? Locator.nearestMarket(d.lat, d.lon) : null;
  const tel = d.phone ? d.phone.replace(/[^0-9+]/g, "") : "";
  const site = d.website ? "https://" + d.website.replace(/^https?:\/\//, "") : "";

  setSeo({
    title: `${d.name} — ${d.city}, ${d.province} | listyourcar.ca`,
    desc: `${d.name} in ${d.city}, ${d.province}: ${kind.toLowerCase()}${d.brands.length ? " carrying " + d.brands.join(", ") : ""}. Invite them to bid on your car.`,
    canonical: "https://listyourcar.ca/dealer.html?id=" + encodeURIComponent(d.id),
  });

  host.innerHTML = `
    <nav class="crumbs"><a href="/find-buyers.html">Find buyers</a> / ${d.city}, ${d.province}</nav>
    <span class="eyebrow">${kind}</span>
    <h1>${d.name}</h1>
    <p class="lead">${d.city}, ${d.province}${d.postal ? " · " + d.postal : ""}${km != null ? " · " + (km < 1 ? "under 1" : Math.round(km)) + " km from you" : ""}</p>
    <div class="dealer-grid">
      <dl class="dealer-facts">
        <div><dt>Phone</dt><dd>${tel ? `<a class="link-inline" href="tel:${tel}">${d.phone}</a>` : `<span class="muted">Not on file</span>`}</dd></div>
        <div><dt>Website</dt><dd>${site ? `<a class="link-inline" href="${site}" target="_blank" rel="noopener">${d.website}</a>` : `<span class="muted">Not on file</span>`}</dd></div>
        <div><dt>Marques</dt><dd>${d.brands.length ? d.brands.join(", ") : "None — buys across makes"}</dd></div>
        <div><dt>Location</dt><dd>${d.city}, ${d.province}${d.postal ? "<br>" + d.postal : ""}</dd></div>
        ${m ? `<div><dt>Auction market</dt><dd>${m.name} · ${m.km} km</dd></div>` : ""}
      </dl>
      ${profileBlock(d)}
      <aside class="dealer-cta">
        <span class="eyebrow">Sell to them</span>
        <h3>Put your car in front of ${d.name}.</h3>
        <p class="muted">List it, set your reserve, and they are invited to bid against every other buyer in range — until your closing time.</p>
        <a class="btn btn-primary" href="/sell.html">List my car</a>
        <a class="link" href="/find-buyers.html">See every buyer nearby →</a>
      </aside>
    </div>
    <p class="muted small dealer-note">Contact details come from the dealer network export and may be out of date. Placed by ${d.postal && /^[A-Za-z]0/.test(d.postal) ? "full postal code" : "postal district"}.</p>`;

  const ld = {
    "@context": "https://schema.org", "@type": "AutoDealer", name: d.name,
    address: { "@type": "PostalAddress", addressLocality: d.city, addressRegion: d.province, postalCode: d.postal || undefined, addressCountry: "CA" },
    ...(d.phone ? { telephone: d.phone } : {}), ...(site ? { url: site } : {}),
    ...(d.brands.length ? { brand: d.brands.map((b) => ({ "@type": "Brand", name: b })) } : {}),
  };
  const s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
}
window.pageDealer = pageDealer;

window.pageCity = pageCity;
window.pageModel = () => {}; // model pages are fully static
window.pageAuctionDashboard = pageAuctionDashboard;
window.pageValue = pageValue;
window.pageAuctions = pageAuctions;
window.pageAuction = pageAuction;
window.pageSell = pageSell;
window.homeAuctions = homeAuctions;
window.auctionCard = auctionCard;
window.startCountdowns = startCountdowns;
window.auctionMoney = money;
window.countdownParts = countdownParts;
