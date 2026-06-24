/* ============================================================
   listyourcar.ca — front-end app logic
   Dispatches per-page behaviour via <body data-page="...">.
   Depends on data.js (window.LYC_DATA) and store.js (window.Store).
   ============================================================ */

const D = window.LYC_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Formatting helpers ---------- */
const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtPrice = (n) => "$" + Number(n).toLocaleString("en-CA");
const fmtKm = (n) => Number(n).toLocaleString("en-CA") + " km";
const cityName = (slug) => (D.CITIES.find((c) => c.slug === slug)?.name) || slug || "Canada";
const titleOf = (l) => `${l.year} ${l.make} ${l.model}`;
const qs = () => new URLSearchParams(location.search);

function intentBadge(intent) {
  const map = {
    sale:   '<span class="badge badge-sale">For sale</span>',
    rental: '<span class="badge badge-rent">For rent</span>',
    both:   '<span class="badge badge-sale">For sale</span><span class="badge badge-rent">For rent</span>',
  };
  return map[intent] || "";
}

/* ---------- Listing card ---------- */
function listingCard(l) {
  const priceLine =
    l.intent === "rental"
      ? `<div class="price">${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>`
      : l.intent === "both"
      ? `<div class="price">${fmtPrice(l.price)} <span class="or">or</span> ${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>`
      : `<div class="price">${fmtPrice(l.price)}</div>`;
  return `
    <a class="car-card" href="listing.html?id=${encodeURIComponent(l.id)}">
      <div class="thumb">${l.emoji || "🚗"}<div class="badges">${intentBadge(l.intent)}</div></div>
      <div class="body">
        <h3>${titleOf(l)}</h3>
        ${priceLine}
        <p class="meta">${l.mileage ? fmtKm(l.mileage) + " &middot; " : ""}${cityName(l.city)}</p>
      </div>
    </a>`;
}
function renderInto(id, items, empty) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.length ? items.map(listingCard).join("") : `<p class="muted">${empty}</p>`;
}

/* ============================================================
   Shared chrome: nav toggle + footer year
   ============================================================ */
function initChrome() {
  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();

  const toggle = $(".nav-toggle");
  const links = $(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  // Inbox badge in nav
  const badge = $("#inbox-count");
  if (badge) {
    const n = Store.inquiries().filter((i) => !i.read).length + Store.bookings().length;
    if (n > 0) { badge.textContent = n; badge.hidden = false; }
  }
}

/* ============================================================
   PAGE: Home
   ============================================================ */
function pageHome() {
  renderInto("featured-listings", Store.allListings().slice(0, 4), "No listings yet.");
}

/* ============================================================
   PAGE: Browse
   ============================================================ */
function pageBrowse() {
  const form = $("#filter-form");
  const params = qs();

  // Pre-fill from URL (home search bar / local pages)
  if (form) {
    ["intent", "make", "model", "city", "price"].forEach((k) => {
      if (params.get(k) && form[k]) form[k].value = params.get(k);
    });
  }

  function apply() {
    const f = form ? Object.fromEntries(new FormData(form)) : {};
    const intent = f.intent || params.get("intent") || "";
    const make = (f.make || "").toLowerCase().trim();
    const model = (f.model || "").toLowerCase().trim();
    const city = (f.city || "").toLowerCase().trim();
    const maxPrice = f.price ? Number(f.price) : null;

    let items = Store.allListings().filter((l) => {
      if (intent === "sale" && !(l.intent === "sale" || l.intent === "both")) return false;
      if (intent === "rental" && !(l.intent === "rental" || l.intent === "both")) return false;
      if (make && !l.make.toLowerCase().includes(make)) return false;
      if (model && !l.model.toLowerCase().includes(model)) return false;
      if (city && l.city !== city) return false;
      if (maxPrice != null) {
        const p = l.intent === "rental" ? l.dailyRate : l.price;
        if (p > maxPrice) return false;
      }
      return true;
    });

    renderInto("listings", items, "No cars match your search. Try widening your filters.");
    const count = $("#results-count");
    if (count) count.textContent = `${items.length} ${items.length === 1 ? "listing" : "listings"} found`;
  }

  if (form) {
    form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
    form.addEventListener("reset", () => setTimeout(apply, 0));
    // Toggle price label when intent changes
    form.intent?.addEventListener("change", apply);
  }
  apply();
}

/* ============================================================
   PAGE: List your car (intent selector + dynamic flow)
   ============================================================ */
function pageList() {
  const form = $("#list-form");
  if (!form) return;

  const saleBlock = $("#sale-fields");
  const rentBlock = $("#rental-fields");
  const intentInputs = $$('input[name="intent"]');

  // Pre-select intent from URL (?intent=rental etc.)
  const wanted = qs().get("intent");
  if (wanted) {
    const r = intentInputs.find((i) => i.value === wanted);
    if (r) r.checked = true;
  }

  function syncIntent() {
    const v = (intentInputs.find((i) => i.checked) || {}).value || "sale";
    const showSale = v === "sale" || v === "both";
    const showRent = v === "rental" || v === "both";
    saleBlock.hidden = !showSale;
    rentBlock.hidden = !showRent;
    // required toggling
    $("#price").required = showSale;
    $("#dailyRate").required = showRent;
  }
  intentInputs.forEach((i) => i.addEventListener("change", syncIntent));
  syncIntent();

  // VIN decode via NHTSA vPIC (free, no key, CORS-enabled)
  let decodedVehicle = null;
  const vinBtn = $("#vin-decode");
  const vinStatus = $("#vin-status");
  const setVinStatus = (msg, kind) => {
    vinStatus.hidden = false;
    vinStatus.textContent = msg;
    vinStatus.className = "vin-status small " + (kind === "err" ? "vin-err" : kind === "ok" ? "vin-ok" : "muted");
  };
  vinBtn?.addEventListener("click", async () => {
    const vin = ($("#vin").value || "").trim();
    if (vin.length !== 17) { setVinStatus("Enter a full 17-character VIN to decode.", "err"); return; }
    vinBtn.disabled = true; setVinStatus("Decoding…");
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
      const data = await res.json();
      const r = (data.Results && data.Results[0]) || {};
      if (r.ErrorCode && r.ErrorCode !== "0" && !r.Make) {
        setVinStatus("Couldn't decode that VIN. Enter details manually.", "err");
      } else {
        if (r.Make) form.make.value = titleCase(r.Make);
        if (r.Model) form.model.value = r.Model;
        if (r.ModelYear) form.year.value = r.ModelYear;
        decodedVehicle = { vin, make: r.Make, model: r.Model, year: r.ModelYear, trim: r.Trim, bodyClass: r.BodyClass, fuel: r.FuelTypePrimary };
        setVinStatus(`Decoded: ${[r.ModelYear, titleCase(r.Make || ""), r.Model, r.Trim].filter(Boolean).join(" ")}`, "ok");
      }
    } catch {
      setVinStatus("Decode service unavailable. Enter details manually.", "err");
    } finally {
      vinBtn.disabled = false;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const listing = Store.addListing({
      intent: f.intent,
      vin: f.vin || null,
      decodedVehicle: decodedVehicle || null,
      make: f.make, model: f.model, year: Number(f.year),
      mileage: f.mileage ? Number(f.mileage) : null,
      city: f.city, condition: f.condition,
      description: f.description,
      name: f.name, email: f.email, phone: f.phone,
      // sale
      price: f.price ? Number(f.price) : null,
      // rental
      dailyRate: f.dailyRate ? Number(f.dailyRate) : null,
      weeklyRate: f.weeklyRate ? Number(f.weeklyRate) : null,
      monthlyRate: f.monthlyRate ? Number(f.monthlyRate) : null,
      deposit: f.deposit ? Number(f.deposit) : null,
      minAge: f.minAge ? Number(f.minAge) : null,
      availFrom: f.availFrom || null,
      availTo: f.availTo || null,
    });
    // Success screen
    $("#list-wrap").innerHTML = `
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h1>Your listing is live!</h1>
        <p class="lead">${titleOf(listing)} — ${intentBadge(listing.intent)}</p>
        <p>Next, crosspost it to other channels and manage every inquiry from your dashboard.</p>
        <div class="hero-actions center">
          <a class="btn btn-primary" href="listing.html?id=${listing.id}">View your listing</a>
          <a class="btn btn-outline" href="dashboard.html">Go to dashboard</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   PAGE: Listing detail (sale / rental templates)
   ============================================================ */
function pageListing() {
  const id = qs().get("id");
  const l = id && Store.getListing(id);
  const wrap = $("#listing-wrap");
  if (!wrap) return;
  if (!l) { wrap.innerHTML = `<p class="muted">Listing not found. <a href="browse.html">Browse all cars →</a></p>`; return; }

  const city = D.CITIES.find((c) => c.slug === l.city);
  const showSale = l.intent === "sale" || l.intent === "both";
  const showRent = l.intent === "rental" || l.intent === "both";

  const salePane = showSale ? `
    <div class="price-card">
      <div class="price-big">${fmtPrice(l.price)}</div>
      <p class="muted">Private sale price</p>
      <button class="btn btn-primary btn-block" data-contact="buy">Contact seller</button>
      <ul class="mini-checklist">
        <li>Run a CARFAX Canada history report</li>
        <li>${city ? city.note : "Check provincial lien/transfer rules"}</li>
      </ul>
    </div>` : "";

  const rentPane = showRent ? `
    <div class="price-card">
      <div class="price-big">${fmtPrice(l.dailyRate)}<span class="per">/day</span></div>
      <p class="muted">
        ${l.weeklyRate ? fmtPrice(l.weeklyRate) + "/wk &middot; " : ""}
        ${l.monthlyRate ? fmtPrice(l.monthlyRate) + "/mo &middot; " : ""}
        ${l.deposit ? fmtPrice(l.deposit) + " deposit" : ""}
      </p>
      <form id="booking-form" class="booking-form">
        <div class="form-row">
          <label>From<input type="date" name="start" required></label>
          <label>To<input type="date" name="end" required></label>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Request to book</button>
        <p class="form-note muted">Phase 1 is inquiry-based — the owner confirms availability with you directly.</p>
      </form>
      ${l.minAge ? `<p class="muted small">Renter requirements: ${l.minAge}+, valid licence, insurance confirmation.</p>` : ""}
    </div>` : "";

  wrap.innerHTML = `
    <a href="browse.html" class="link back">&larr; Back to browse</a>
    <div class="listing-grid">
      <div>
        <div class="listing-hero">${l.emoji || "🚗"}<div class="badges">${intentBadge(l.intent)}</div></div>
        <h1>${titleOf(l)}</h1>
        <p class="meta-row">${l.mileage ? fmtKm(l.mileage) + " &middot; " : ""}${cityName(l.city)}${l.condition ? " &middot; " + l.condition + " condition" : ""}</p>
        <h2>Description</h2>
        <p>${l.description || "No description provided."}</p>
        <h2>Details</h2>
        <table class="spec-table">
          <tr><th>Make</th><td>${l.make}</td><th>Model</th><td>${l.model}</td></tr>
          <tr><th>Year</th><td>${l.year}</td><th>Mileage</th><td>${l.mileage ? fmtKm(l.mileage) : "—"}</td></tr>
          <tr><th>City</th><td>${cityName(l.city)}</td><th>Listed by</th><td>${l.seller || "Private"}</td></tr>
        </table>
      </div>
      <aside class="listing-side">
        ${salePane}
        ${rentPane}
      </aside>
    </div>
    <dialog id="contact-dialog">
      <form method="dialog" id="contact-form">
        <h3>Contact about ${titleOf(l)}</h3>
        <label>Your name<input name="name" required></label>
        <label>Email<input type="email" name="email" required></label>
        <label>Message<textarea name="message" rows="4" required>Hi, is this ${titleOf(l)} still available?</textarea></label>
        <div class="hero-actions">
          <button class="btn btn-primary" value="send">Send</button>
          <button class="btn btn-outline" value="cancel" formnovalidate>Cancel</button>
        </div>
      </form>
    </dialog>`;

  // Sale inquiry
  const dialog = $("#contact-dialog");
  $$("[data-contact]").forEach((b) => b.addEventListener("click", () => dialog.showModal()));
  $("#contact-form")?.addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = Object.fromEntries(new FormData(e.target));
    Store.addInquiry({
      listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca",
      kind: "buyer", name: f.name, email: f.email, message: f.message,
    });
    window.submitForm({ _subject: `Inquiry: ${titleOf(l)}`, kind: "buyer", listing: titleOf(l), ...f });
    setTimeout(() => alert("Message sent! The seller will see it in their dashboard inbox."), 50);
  });

  // Rental booking request
  $("#booking-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const days = Math.max(1, Math.round((new Date(f.end) - new Date(f.start)) / 86400000) || 1);
    const total = days * l.dailyRate;
    Store.addBooking({
      listingId: l.id, listingTitle: titleOf(l),
      start: f.start, end: f.end, days, dailyRate: l.dailyRate,
      total, deposit: l.deposit || 0,
    });
    Store.addInquiry({
      listingId: l.id, listingTitle: titleOf(l), channel: "listyourcar.ca",
      kind: "renter", name: "Renter", email: "", message: `Booking request: ${f.start} → ${f.end} (${days} days, est. ${fmtPrice(total)})`,
    });
    window.submitForm({ _subject: `Booking request: ${titleOf(l)}`, kind: "renter", listing: titleOf(l), start: f.start, end: f.end, days, estTotal: total });
    e.target.innerHTML = `<div class="notice ok">Booking request sent for ${days} day(s) — est. <strong>${fmtPrice(total)}</strong>. The owner will confirm availability. <a href="dashboard.html">View in dashboard →</a></div>`;
  });
}

/* ============================================================
   PAGE: Dashboard (unified inbox + listings + rental history)
   ============================================================ */
function pageDashboard() {
  const listings = Store.userListings();
  const inquiries = Store.inquiries();
  const bookings = Store.bookings();

  // Stats
  const stats = $("#stats");
  if (stats) {
    const earnings = bookings.reduce((s, b) => s + (b.total || 0), 0);
    stats.innerHTML = `
      ${statCard(listings.length, "Active listings")}
      ${statCard(inquiries.filter((i) => !i.read).length, "Unread inquiries")}
      ${statCard(bookings.length, "Booking requests")}
      ${statCard(fmtPrice(earnings), "Est. booking value")}`;
  }

  // My listings
  const ml = $("#my-listings");
  if (ml) {
    ml.innerHTML = listings.length
      ? listings.map((l) => `
        <div class="row-card">
          <div class="thumb-sm">${l.emoji}</div>
          <div class="grow">
            <strong>${titleOf(l)}</strong> ${intentBadge(l.intent)}
            <div class="muted small">${cityName(l.city)} &middot; listed ${l.created}</div>
          </div>
          <a class="btn btn-sm btn-outline" href="listing.html?id=${l.id}">View</a>
        </div>`).join("")
      : `<p class="muted">No listings yet. <a href="list.html">List your car →</a></p>`;
  }

  // Unified inbox
  const inbox = $("#inbox");
  if (inbox) {
    inbox.innerHTML = inquiries.length
      ? inquiries.map((i) => `
        <div class="row-card ${i.read ? "" : "unread"}">
          <div class="grow">
            <strong>${i.name}</strong>
            <span class="chip chip-${i.kind}">${i.kind}</span>
            <span class="chip">${i.channel}</span>
            <div class="muted small">re: ${i.listingTitle} &middot; ${new Date(i.created).toLocaleDateString("en-CA")}</div>
            <p class="msg">${i.message}</p>
          </div>
        </div>`).join("")
      : `<p class="muted">No inquiries yet. Inquiries from every channel land here.</p>`;
    inquiries.forEach((i) => Store.markInquiryRead(i.id));
  }

  // Rental bookings / agreements
  const bk = $("#bookings");
  if (bk) {
    bk.innerHTML = bookings.length
      ? bookings.map((b) => `
        <div class="row-card">
          <div class="grow">
            <strong>${b.listingTitle}</strong> <span class="chip chip-renter">${b.status}</span>
            <div class="muted small">${b.start} → ${b.end} &middot; ${b.days} day(s) &middot; est. ${fmtPrice(b.total)}</div>
          </div>
          <a class="btn btn-sm btn-outline" href="agreement.html?booking=${b.id}">Generate agreement</a>
        </div>`).join("")
      : `<p class="muted">No booking requests yet.</p>`;
  }

  $("#reset-demo")?.addEventListener("click", () => {
    if (confirm("Clear all demo listings, inquiries, and bookings?")) {
      Store.resetAll(); location.reload();
    }
  });
}
function statCard(n, label) {
  return `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${label}</div></div>`;
}

/* ============================================================
   PAGE: Guides hub (content pillars)
   ============================================================ */
function pageGuides() {
  const wrap = $("#pillars");
  if (!wrap) return;
  wrap.innerHTML = D.PILLARS.map((p) => {
    const arts = D.ARTICLES.filter((a) => a.pillar === p.id);
    return `
      <section class="pillar">
        <div class="pillar-head">
          <span class="phase">${p.phase}</span>
          <h2>${p.title}</h2>
          <p class="muted">${p.blurb}</p>
        </div>
        <ul class="article-list">
          ${arts.map((a) => `<li><a href="article.html?slug=${a.slug}">${a.title}</a> <span class="muted small">${a.readMins} min</span></li>`).join("")}
        </ul>
      </section>`;
  }).join("");
}

/* ============================================================
   PAGE: Article (renders by ?slug=)
   ============================================================ */
function pageArticle() {
  const slug = qs().get("slug");
  const a = D.ARTICLES.find((x) => x.slug === slug);
  const wrap = $("#article-wrap");
  if (!wrap) return;
  if (!a) { wrap.innerHTML = `<p class="muted">Article not found. <a href="guides.html">All guides →</a></p>`; return; }

  document.title = a.title + " | listyourcar.ca";
  const metaEl = $('meta[name="description"]');
  if (metaEl) metaEl.setAttribute("content", a.meta);
  const pillar = D.PILLARS.find((p) => p.id === a.pillar);

  wrap.innerHTML = `
    <a href="guides.html" class="link back">&larr; All guides</a>
    <article class="article">
      <span class="phase">${pillar ? pillar.phase : ""}</span>
      <h1>${a.title}</h1>
      <p class="muted">${a.readMins} min read</p>
      ${a.sections.map((s) => `${s.h ? `<h2>${s.h}</h2>` : ""}<p>${s.p}</p>`).join("")}
      <div class="article-cta">
        <h3>Ready to list your car?</h3>
        <p>Sell it, rent it, or both — one listing, every channel.</p>
        <a class="btn btn-primary" href="list.html">List your car</a>
      </div>
    </article>
    <aside class="related">
      <h3>More in “${pillar ? pillar.title : "Guides"}”</h3>
      <ul class="article-list">
        ${D.ARTICLES.filter((x) => x.pillar === a.pillar && x.slug !== a.slug)
          .map((x) => `<li><a href="article.html?slug=${x.slug}">${x.title}</a></li>`).join("")}
      </ul>
    </aside>`;
}

/* ============================================================
   PAGE: Local landing pages (geo)
   ============================================================ */
function pageLocal() {
  const cs = qs().get("city");
  const intent = qs().get("intent") || "sale";
  const city = D.CITIES.find((c) => c.slug === cs) || D.CITIES[0];
  const wrap = $("#local-wrap");
  if (!wrap) return;

  const isRent = intent === "rental";
  const verb = isRent ? "rent out your car" : "sell your car";
  const Verb = isRent ? "Rent out your car" : "Sell your car";
  document.title = `${Verb} in ${city.name} | listyourcar.ca`;

  const related = D.ARTICLES.filter((a) => (isRent ? a.pillar === "rental" : ["channel", "price", "craft", "trust"].includes(a.pillar))).slice(0, 5);

  wrap.innerHTML = `
    <nav class="crumbs"><a href="index.html">Home</a> / <a href="guides.html">Guides</a> / ${Verb} in ${city.name}</nav>
    <h1>${Verb} in ${city.name}</h1>
    <p class="lead">List your car ${isRent ? "for rent" : "for sale"} in ${city.region}, ${city.province} — free to start, every inquiry in one inbox.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="list.html?intent=${intent}">List your car</a>
      <a class="btn btn-outline" href="browse.html?intent=${intent}&city=${city.slug}">Browse ${city.name} cars</a>
    </div>
    <div class="local-note"><strong>${city.name} note:</strong> ${city.note}</div>
    <h2>${isRent ? "Rental" : "Selling"} listings in ${city.name}</h2>
    <div class="card-grid" id="local-listings"></div>
    <h2>Helpful guides</h2>
    <ul class="article-list">
      ${related.map((a) => `<li><a href="article.html?slug=${a.slug}">${a.title}</a></li>`).join("")}
    </ul>`;

  const items = Store.allListings().filter((l) => {
    if (l.city !== city.slug) return false;
    if (isRent) return l.intent === "rental" || l.intent === "both";
    return l.intent === "sale" || l.intent === "both";
  });
  renderInto("local-listings", items, `No ${isRent ? "rental" : "sale"} listings in ${city.name} yet — be the first!`);
}

/* ============================================================
   PAGE: Rental agreement generator
   ============================================================ */
function pageAgreement() {
  const wrap = $("#agreement-wrap");
  if (!wrap) return;
  const bookingId = qs().get("booking");
  const booking = Store.bookings().find((b) => b.id === bookingId);
  const listing = booking && Store.getListing(booking.listingId);
  const today = new Date().toLocaleDateString("en-CA");

  if (!booking || !listing) {
    wrap.innerHTML = `<p class="muted">No booking selected. Generate an agreement from a booking in your <a href="dashboard.html">dashboard</a>.</p>`;
    return;
  }
  const city = D.CITIES.find((c) => c.slug === listing.city);
  const province = city ? city.province : "your province";

  wrap.innerHTML = `
    <div class="no-print hero-actions">
      <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
      <a class="btn btn-outline" href="dashboard.html">Back to dashboard</a>
    </div>
    <article class="agreement">
      <h1>Vehicle Rental Agreement</h1>
      <p class="muted">Generated by listyourcar.ca on ${today} &middot; Province: ${province}</p>
      <p>This agreement is made between the <strong>Owner</strong> (${listing.seller || "Owner"}) and the <strong>Renter</strong>, for the rental of the vehicle described below.</p>

      <h2>1. Vehicle</h2>
      <table class="spec-table">
        <tr><th>Vehicle</th><td>${titleOf(listing)}</td></tr>
        <tr><th>Location</th><td>${cityName(listing.city)}, ${province}</td></tr>
        <tr><th>Odometer at pickup</th><td>${listing.mileage ? fmtKm(listing.mileage) : "_____________"}</td></tr>
      </table>

      <h2>2. Rental period</h2>
      <table class="spec-table">
        <tr><th>Start date</th><td>${booking.start}</td><th>End date</th><td>${booking.end}</td></tr>
        <tr><th>Total days</th><td>${booking.days}</td><th>Daily rate</th><td>${fmtPrice(booking.dailyRate)}</td></tr>
      </table>

      <h2>3. Charges</h2>
      <table class="spec-table">
        <tr><th>Rental subtotal</th><td>${fmtPrice(booking.total)}</td></tr>
        <tr><th>Security deposit</th><td>${fmtPrice(booking.deposit || 0)} (refundable)</td></tr>
      </table>

      <h2>4. Renter requirements</h2>
      <ul>
        <li>Minimum age: ${listing.minAge || 21} years</li>
        <li>Valid driver's licence required (photographed at pickup)</li>
        <li>Renter confirms valid insurance / accepts owner's coverage terms</li>
      </ul>

      <h2>5. Insurance &amp; liability</h2>
      <p>The Owner confirms appropriate coverage is in place for this rental (e.g., OPCF 27 endorsement in Ontario or provincial equivalent). The Renter is responsible for damage, tolls, and fines incurred during the rental period, up to the terms agreed here.</p>

      <h2>6. Condition &amp; return</h2>
      <p>The vehicle is rented in its current condition. The Renter agrees to return it on the end date, at the agreed fuel level, in the same condition aside from normal wear.</p>

      <h2>7. Signatures</h2>
      <div class="sign-grid">
        <div><div class="sign-line"></div>Owner signature &middot; Date</div>
        <div><div class="sign-line"></div>Renter signature &middot; Date</div>
      </div>
      <p class="muted small">This is a prototype document template, not legal advice. Have province-specific agreements reviewed by a qualified professional before use.</p>
    </article>`;
}

/* ============================================================
   Demo form handler (contact / generic)
   ============================================================ */
function initDemoForms() {
  const f = document.getElementById("contact-page-form");
  if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    const payload = { _subject: "listyourcar.ca contact form", ...Object.fromEntries(new FormData(f)) };
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    const r = await window.submitForm(payload);
    if (btn) { btn.disabled = false; btn.textContent = "Send message"; }
    if (r.demo) {
      alert("Thanks! Demo mode — set FORM_ENDPOINT in js/config.js to receive submissions for real.");
    } else if (r.ok) {
      alert("Thanks! Your message has been sent.");
    } else {
      alert("Sorry, something went wrong sending your message. Please email hello@listyourcar.ca.");
      return;
    }
    f.reset();
  });
}

/* ============================================================
   Dispatch
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  initDemoForms();
  const page = document.body.dataset.page;
  ({
    home: pageHome,
    browse: pageBrowse,
    list: pageList,
    listing: pageListing,
    dashboard: pageDashboard,
    guides: pageGuides,
    article: pageArticle,
    local: pageLocal,
    agreement: pageAgreement,
  }[page] || (() => {}))();
});
